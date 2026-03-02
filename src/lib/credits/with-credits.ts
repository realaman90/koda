/**
 * withCredits — Route wrapper HOF for credit-gated generation routes.
 *
 * 1. Authenticates user via Clerk (requireActor)
 * 2. Resolves plan via Clerk Billing `has()`
 * 3. Calculates credit cost from YAML config
 * 4. Atomically deducts credits (402 if insufficient)
 * 5. Runs the handler — refunds on failure
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { requireActor } from '@/lib/auth/actor';
import { isDevAuthBypassEnabled } from '@/lib/auth/dev-bypass';
import { getOrCreateBalance, deductCredits, refundCredits } from '@/lib/db/credit-queries';
import { getCreditCost, PLAN_KEYS, type GenerationType, type CreditCostParams } from './costs';

export interface WithCreditsOptions {
  type: GenerationType;
  /**
   * Extract cost params from the request body.
   * Defaults to `{ model: body.model }`.
   */
  getCostParams?: (body: Record<string, unknown>) => CreditCostParams;
}

type RouteHandler = (
  request: Request,
  context: { userId: string; planKey: string; creditCost: number }
) => Promise<Response>;

/**
 * Resolve the user's active Clerk Billing plan key.
 * Checks plans in priority order (highest first).
 */
async function resolvePlanKey(): Promise<string> {
  const { has } = await auth();
  if (!has) return 'free_user';

  for (const plan of PLAN_KEYS) {
    if (plan === 'free_user') continue;
    if (has({ plan })) return plan;
  }
  return 'free_user';
}

/**
 * Wrap a generation route handler with authentication and credit checks.
 *
 * Usage:
 * ```ts
 * export const POST = withCredits({ type: 'image' }, async (request, { userId, creditCost }) => {
 *   // ... existing handler logic (already authenticated) ...
 *   return NextResponse.json({ success: true, ... });
 * });
 * ```
 */
export function withCredits(options: WithCreditsOptions, handler: RouteHandler) {
  return async (request: Request): Promise<Response> => {
    // 1. Authenticate
    const actorResult = await requireActor();
    if (!actorResult.ok) return actorResult.response;
    const userId = actorResult.actor.user.id;

    // 2. Resolve plan
    const planKey = await resolvePlanKey();

    // 3. Ensure balance exists (handles monthly reset + plan sync)
    await getOrCreateBalance(userId, planKey);

    // 4. Parse body to calculate credit cost
    let body: Record<string, unknown> = {};
    try {
      // Clone request so the handler can also read the body
      body = await request.clone().json();
    } catch {
      // Body parse failure — let the handler deal with it
    }

    const costParams = options.getCostParams
      ? options.getCostParams(body)
      : { model: (body.model as string) || 'unknown' };

    const creditCost = getCreditCost(options.type, costParams);

    // Dev bypass: skip credit deduction entirely in development
    if (isDevAuthBypassEnabled()) {
      return handler(request, { userId, planKey, creditCost: 0 });
    }

    // 5. Atomic deduction
    const deductResult = await deductCredits(
      userId,
      creditCost,
      `${options.type}:${costParams.model}`,
      { model: costParams.model, duration: costParams.duration, generateAudio: costParams.generateAudio }
    );

    if (!deductResult.success) {
      return NextResponse.json(
        {
          error: 'INSUFFICIENT_CREDITS',
          message: `This generation costs ${creditCost} credits but you only have ${deductResult.balance}. Upgrade your plan for more credits.`,
          required: creditCost,
          balance: deductResult.balance,
        },
        { status: 402 }
      );
    }

    // 6. Run handler — refund on failure
    try {
      const response = await handler(request, { userId, planKey, creditCost });

      // If the handler returned an error status, refund
      if (!response.ok) {
        await refundCredits(
          userId,
          creditCost,
          `failed:${options.type}:${costParams.model}`,
          { status: response.status }
        );
      }

      return response;
    } catch (error) {
      // Handler threw — refund credits
      await refundCredits(
        userId,
        creditCost,
        `error:${options.type}:${costParams.model}`,
        { error: error instanceof Error ? error.message : String(error) }
      );
      throw error;
    }
  };
}
