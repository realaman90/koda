import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/auth/actor';
import { getCurrentCreditBalance } from '@/lib/credits/server-balance';

export async function GET() {
  const actorResult = await requireActor();
  if (!actorResult.ok) return actorResult.response;

  const userId = actorResult.actor.user.id;
  const balance = await getCurrentCreditBalance(userId);

  return NextResponse.json({
    balance: balance.balance,
    planKey: balance.planKey,
    creditsPerMonth: balance.creditsPerMonth,
    lifetimeUsed: balance.lifetimeUsed,
    periodStart: balance.periodStart,
  });
}
