/**
 * Credit DB Queries
 *
 * Query functions for credit_balances and credit_transactions tables.
 * All functions are async and use the same getDatabaseAsync() pattern
 * as animation-queries.ts.
 */

import 'server-only';

import { randomUUID } from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { getDatabaseAsync } from './index';
import {
  creditBalances,
  creditTransactions,
  type CreditBalance,
} from './schema';
import { getPlanCredits, getInitialFreeCredits, FREE_TIER_CREDITS } from '@/lib/credits/costs';

// ── Helpers ──────────────────────────────────────────────────────────

/** Start of the current billing month (1st of month, 00:00 UTC) */
function currentPeriodStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// ── Balance Operations ───────────────────────────────────────────────

/**
 * Get or create a credit balance row for a user.
 * On first access, provisions with plan credits.
 */
export async function getOrCreateBalance(
  userId: string,
  planKey: string = 'free_user'
): Promise<CreditBalance> {
  const db = await getDatabaseAsync();

  // Try to fetch existing
  const [existing] = await db
    .select()
    .from(creditBalances)
    .where(eq(creditBalances.userId, userId))
    .limit(1);

  if (existing) {
    // Check if we need a monthly reset (new billing period)
    const periodStart = currentPeriodStart();
    if (existing.periodStart.getTime() < periodStart.getTime()) {
      const monthlyCredits = getPlanCredits(planKey);
      const now = new Date();
      await db
        .update(creditBalances)
        .set({
          balance: monthlyCredits,
          planKey,
          creditsPerMonth: monthlyCredits,
          periodStart,
          updatedAt: now,
        })
        .where(eq(creditBalances.userId, userId));

      // Log the reset
      await db.insert(creditTransactions).values({
        id: randomUUID(),
        userId,
        amount: monthlyCredits,
        balanceAfter: monthlyCredits,
        type: 'reset',
        reason: `monthly_reset:${planKey}`,
        createdAt: now,
      });

      return {
        ...existing,
        balance: monthlyCredits,
        planKey,
        creditsPerMonth: monthlyCredits,
        periodStart,
        updatedAt: now,
      };
    }

    // Plan changed (upgrade/downgrade) — reset balance to new allocation
    if (existing.planKey !== planKey) {
      const monthlyCredits = getPlanCredits(planKey);
      const now = new Date();
      const periodStart = now;
      await db
        .update(creditBalances)
        .set({
          balance: monthlyCredits,
          planKey,
          creditsPerMonth: monthlyCredits,
          periodStart,
          updatedAt: now,
        })
        .where(eq(creditBalances.userId, userId));

      // Log the plan change
      await db.insert(creditTransactions).values({
        id: randomUUID(),
        userId,
        amount: monthlyCredits,
        balanceAfter: monthlyCredits,
        type: 'reset',
        reason: `plan_change:${existing.planKey}→${planKey}`,
        createdAt: now,
      });

      return {
        ...existing,
        balance: monthlyCredits,
        planKey,
        creditsPerMonth: monthlyCredits,
        periodStart,
        updatedAt: now,
      };
    }

    return existing;
  }

  // First access — create with plan credits
  // For free users, apply early-user bonus if EARLY_USER_FREE_CREDITS is set
  const monthlyCredits = getPlanCredits(planKey);
  const initialCredits = planKey === 'free_user' ? getInitialFreeCredits() : monthlyCredits;
  const now = new Date();
  const newBalance: CreditBalance = {
    id: randomUUID(),
    userId,
    balance: initialCredits,
    planKey,
    creditsPerMonth: monthlyCredits,
    periodStart: currentPeriodStart(),
    lifetimeUsed: 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(creditBalances).values(newBalance);
  return newBalance;
}

/**
 * Atomically deduct credits. Returns the updated balance or null if insufficient.
 *
 * Uses `WHERE balance >= cost` to prevent going negative.
 */
export async function deductCredits(
  userId: string,
  cost: number,
  reason: string,
  metadata?: Record<string, unknown>
): Promise<{ success: true; balanceAfter: number } | { success: false; balance: number }> {
  const db = await getDatabaseAsync();

  // Atomic decrement with guard
  const result = await db
    .update(creditBalances)
    .set({
      balance: sql`balance - ${cost}`,
      lifetimeUsed: sql`lifetime_used + ${cost}`,
      updatedAt: new Date(),
    })
    .where(
      sql`${creditBalances.userId} = ${userId} AND ${creditBalances.balance} >= ${cost}`
    );

  // Check if the update affected a row
  const rowsAffected = (result as { rowsAffected?: number }).rowsAffected
    ?? (result as { changes?: number }).changes
    ?? 1; // SQLite drivers vary — fallback to success if can't determine

  if (rowsAffected === 0) {
    // Insufficient credits — get current balance for error message
    const [current] = await db
      .select()
      .from(creditBalances)
      .where(eq(creditBalances.userId, userId))
      .limit(1);
    return { success: false, balance: current?.balance ?? 0 };
  }

  // Get updated balance for the transaction log
  const [updated] = await db
    .select()
    .from(creditBalances)
    .where(eq(creditBalances.userId, userId))
    .limit(1);

  const balanceAfter = updated?.balance ?? 0;

  // Log the transaction
  await db.insert(creditTransactions).values({
    id: randomUUID(),
    userId,
    amount: -cost,
    balanceAfter,
    type: 'deduction',
    reason,
    metadata: metadata ? JSON.stringify(metadata) : null,
    createdAt: new Date(),
  });

  return { success: true, balanceAfter };
}

/**
 * Refund credits (reverse a failed deduction).
 */
export async function refundCredits(
  userId: string,
  amount: number,
  reason: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const db = await getDatabaseAsync();

  await db
    .update(creditBalances)
    .set({
      balance: sql`balance + ${amount}`,
      lifetimeUsed: sql`MAX(lifetime_used - ${amount}, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(creditBalances.userId, userId));

  const [updated] = await db
    .select()
    .from(creditBalances)
    .where(eq(creditBalances.userId, userId))
    .limit(1);

  await db.insert(creditTransactions).values({
    id: randomUUID(),
    userId,
    amount,
    balanceAfter: updated?.balance ?? 0,
    type: 'refund',
    reason,
    metadata: metadata ? JSON.stringify(metadata) : null,
    createdAt: new Date(),
  });
}

/**
 * Add credits (billing top-up or manual adjustment).
 */
export async function addCredits(
  userId: string,
  amount: number,
  reason: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const db = await getDatabaseAsync();

  await db
    .update(creditBalances)
    .set({
      balance: sql`balance + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(creditBalances.userId, userId));

  const [updated] = await db
    .select()
    .from(creditBalances)
    .where(eq(creditBalances.userId, userId))
    .limit(1);

  await db.insert(creditTransactions).values({
    id: randomUUID(),
    userId,
    amount,
    balanceAfter: updated?.balance ?? 0,
    type: 'topup',
    reason,
    metadata: metadata ? JSON.stringify(metadata) : null,
    createdAt: new Date(),
  });
}

/**
 * Reset monthly credits (no rollover). Sets balance to plan allocation.
 */
export async function resetMonthlyCredits(
  userId: string,
  planCredits: number
): Promise<void> {
  const db = await getDatabaseAsync();
  const now = new Date();

  await db
    .update(creditBalances)
    .set({
      balance: planCredits,
      creditsPerMonth: planCredits,
      periodStart: now,
      updatedAt: now,
    })
    .where(eq(creditBalances.userId, userId));

  await db.insert(creditTransactions).values({
    id: randomUUID(),
    userId,
    amount: planCredits,
    balanceAfter: planCredits,
    type: 'reset',
    reason: 'monthly_reset',
    createdAt: now,
  });
}
