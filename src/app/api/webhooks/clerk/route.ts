import 'server-only';

import { randomUUID } from 'crypto';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { eq } from 'drizzle-orm';
import { getDatabaseAsync } from '@/lib/db';
import { users, creditBalances } from '@/lib/db/schema';
import { emitLaunchMetric } from '@/lib/observability/launch-metrics';
import { getOrCreateBalance, resetMonthlyCredits } from '@/lib/db/credit-queries';
import { getPlanCredits } from '@/lib/credits/costs';

// ── Event types ──────────────────────────────────────────────────────

// Generic envelope — event.type determines the shape of event.data
type WebhookEvent = { type: string; data: Record<string, any> };

// ── User helpers ─────────────────────────────────────────────────────

function getPrimaryEmail(data: Record<string, any>): string | null {
  const addresses = data.email_addresses as Array<{ id: string; email_address: string }> | undefined;
  if (!addresses?.length) return null;

  if (data.primary_email_address_id) {
    const primary = addresses.find((e) => e.id === data.primary_email_address_id);
    if (primary?.email_address) return primary.email_address;
  }

  return addresses[0]?.email_address ?? null;
}

async function resolveUserId(clerkUserId: string): Promise<string | null> {
  const db = await getDatabaseAsync();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);
  return user?.id ?? null;
}

async function updatePlanKey(userId: string, planKey: string): Promise<void> {
  const db = await getDatabaseAsync();
  const monthlyCredits = getPlanCredits(planKey);
  await db
    .update(creditBalances)
    .set({ planKey, creditsPerMonth: monthlyCredits, updatedAt: new Date() })
    .where(eq(creditBalances.userId, userId));
}

// ── Handlers ─────────────────────────────────────────────────────────

async function handleUserEvent(evt: WebhookEvent): Promise<NextResponse> {
  const db = await getDatabaseAsync();
  const now = new Date();

  if (evt.type === 'user.deleted') {
    await db.delete(users).where(eq(users.clerkUserId, evt.data.id));
    return NextResponse.json({ ok: true, action: 'deleted' });
  }

  const email = getPrimaryEmail(evt.data);
  if (!email) {
    emitLaunchMetric({
      metric: 'signup_completion',
      status: 'error',
      source: 'webhook',
      errorCode: 'missing_email',
      metadata: { eventType: evt.type },
    });
    return NextResponse.json({ error: 'User payload missing email' }, { status: 400 });
  }

  await db
    .insert(users)
    .values({
      id: randomUUID(),
      clerkUserId: evt.data.id,
      email,
      firstName: evt.data.first_name ?? null,
      lastName: evt.data.last_name ?? null,
      imageUrl: evt.data.image_url ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.clerkUserId,
      set: {
        email,
        firstName: evt.data.first_name ?? null,
        lastName: evt.data.last_name ?? null,
        imageUrl: evt.data.image_url ?? null,
        updatedAt: now,
      },
    });

  if (evt.type === 'user.created') {
    emitLaunchMetric({ metric: 'signup_completion', status: 'success', source: 'webhook', metadata: { userId: evt.data.id } });
    emitLaunchMetric({ metric: 'activation_signup', status: 'success', source: 'webhook', metadata: { userId: evt.data.id } });
  }

  return NextResponse.json({ ok: true, action: 'upserted' });
}

async function handleSubscriptionItemEvent(evt: WebhookEvent): Promise<NextResponse> {
  const clerkUserId: string = evt.data.payer_id;
  const userId = await resolveUserId(clerkUserId);
  if (!userId) {
    console.warn(`[clerk-billing] User not found for clerk_user_id: ${clerkUserId}`);
    return NextResponse.json({ received: true, warning: 'user_not_found' });
  }

  const planKey: string = evt.data.plan_id || 'free_user';
  const monthlyCredits = getPlanCredits(planKey);

  switch (evt.type) {
    case 'subscriptionItem.active':
    case 'subscriptionItem.updated': {
      // Plan activated or changed — reset credits to new allocation
      await resetMonthlyCredits(userId, monthlyCredits);
      await updatePlanKey(userId, planKey);
      console.log(`[clerk-billing] ${evt.type}: ${planKey} (${monthlyCredits} credits) for ${userId}`);
      break;
    }

    case 'subscriptionItem.canceled': {
      // Credits remain until period end
      console.log(`[clerk-billing] Plan cancelled for ${userId} — credits remain until period end`);
      break;
    }

    case 'subscriptionItem.ended': {
      // Period ended after cancel — downgrade to free
      const freeCredits = getPlanCredits('free_user');
      await resetMonthlyCredits(userId, freeCredits);
      await updatePlanKey(userId, 'free_user');
      console.log(`[clerk-billing] Plan ended for ${userId} — downgraded to free`);
      break;
    }

    default:
      console.log(`[clerk-billing] ${evt.type} for ${userId} (${planKey}) — no action`);
  }

  return NextResponse.json({ received: true });
}

async function handleSubscriptionEvent(evt: WebhookEvent): Promise<NextResponse> {
  const clerkUserId: string = evt.data.payer_id;
  const userId = await resolveUserId(clerkUserId);
  if (!userId) {
    console.warn(`[clerk-billing] User not found for clerk_user_id: ${clerkUserId}`);
    return NextResponse.json({ received: true, warning: 'user_not_found' });
  }

  switch (evt.type) {
    case 'subscription.created':
    case 'subscription.active': {
      const firstItem = evt.data.subscription_items?.[0];
      const planKey: string = firstItem?.plan_id || 'free_user';
      await getOrCreateBalance(userId, planKey);
      console.log(`[clerk-billing] ${evt.type}: provisioned for ${userId} (${planKey})`);
      break;
    }

    case 'subscription.pastDue': {
      console.log(`[clerk-billing] Subscription past due for ${userId}`);
      break;
    }

    default:
      console.log(`[clerk-billing] ${evt.type} for ${userId} — no action`);
  }

  return NextResponse.json({ received: true });
}

// ── Route ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

  if (!signingSecret) {
    emitLaunchMetric({
      metric: 'signup_completion',
      status: 'error',
      source: 'webhook',
      errorCode: 'missing_webhook_secret',
    });
    return NextResponse.json({ error: 'Missing CLERK_WEBHOOK_SIGNING_SECRET' }, { status: 500 });
  }

  const payload = await req.text();
  const headerPayload = await headers();

  const svixId = headerPayload.get('svix-id');
  const svixTimestamp = headerPayload.get('svix-timestamp');
  const svixSignature = headerPayload.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    emitLaunchMetric({
      metric: 'signup_completion',
      status: 'error',
      source: 'webhook',
      errorCode: 'missing_svix_headers',
    });
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  const wh = new Webhook(signingSecret);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as WebhookEvent;
  } catch (error) {
    emitLaunchMetric({
      metric: 'signup_completion',
      status: 'error',
      source: 'webhook',
      errorCode: 'invalid_webhook_signature',
      metadata: { message: String(error) },
    });
    return NextResponse.json(
      { error: 'Invalid webhook signature', details: String(error) },
      { status: 400 }
    );
  }

  console.log(`[clerk-webhook] Event: ${evt.type}`);

  // Route to the appropriate handler
  if (evt.type.startsWith('user.')) {
    return handleUserEvent(evt);
  }

  if (evt.type.startsWith('subscriptionItem.')) {
    return handleSubscriptionItemEvent(evt);
  }

  if (evt.type.startsWith('subscription.')) {
    return handleSubscriptionEvent(evt);
  }

  console.log(`[clerk-webhook] Unhandled event: ${evt.type}`);
  return NextResponse.json({ ok: true, action: 'ignored' });
}
