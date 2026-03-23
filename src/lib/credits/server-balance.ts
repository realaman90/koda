import { auth } from '@clerk/nextjs/server';
import { PLAN_KEYS } from './costs';
import { getOrCreateBalance } from '../db/credit-queries';

export async function resolvePlanKey(): Promise<string> {
  const { has } = await auth();
  if (!has) return 'free_user';

  for (const plan of PLAN_KEYS) {
    if (plan === 'free_user') continue;
    if (has({ plan })) return plan;
  }
  return 'free_user';
}

export async function getCurrentCreditBalance(userId: string) {
  const planKey = await resolvePlanKey();
  return getOrCreateBalance(userId, planKey);
}
