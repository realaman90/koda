import 'server-only';

import { randomUUID } from 'crypto';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { eq } from 'drizzle-orm';
import { getDatabaseAsync } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { emitLaunchMetric } from '@/lib/observability/launch-metrics';

type ClerkWebhookEvent = {
  type: string;
  data: {
    id: string;
    email_addresses?: Array<{ id: string; email_address: string }>;
    primary_email_address_id?: string;
    first_name?: string | null;
    last_name?: string | null;
    image_url?: string | null;
  };
};

function getPrimaryEmail(data: ClerkWebhookEvent['data']) {
  if (!data.email_addresses?.length) return null;

  if (data.primary_email_address_id) {
    const primary = data.email_addresses.find(
      (email) => email.id === data.primary_email_address_id
    );

    if (primary?.email_address) return primary.email_address;
  }

  return data.email_addresses[0]?.email_address ?? null;
}

export async function POST(req: Request) {
  const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

  if (!signingSecret) {
    emitLaunchMetric({
      metric: 'signup_completion',
      status: 'error',
      source: 'webhook',
      errorCode: 'missing_webhook_secret',
    });
    return NextResponse.json(
      { error: 'Missing CLERK_WEBHOOK_SIGNING_SECRET' },
      { status: 500 }
    );
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

  let evt: ClerkWebhookEvent;

  try {
    evt = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent;
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

  const db = await getDatabaseAsync();
  const now = new Date();

  if (evt.type === 'user.deleted') {
    await db.delete(users).where(eq(users.clerkUserId, evt.data.id));
    return NextResponse.json({ ok: true, action: 'deleted' });
  }

  if (evt.type === 'user.created' || evt.type === 'user.updated') {
    const email = getPrimaryEmail(evt.data);

    if (!email) {
      emitLaunchMetric({
        metric: 'signup_completion',
        status: 'error',
        source: 'webhook',
        errorCode: 'missing_email',
        metadata: { eventType: evt.type },
      });
      return NextResponse.json(
        { error: 'User payload missing email' },
        { status: 400 }
      );
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
      emitLaunchMetric({
        metric: 'signup_completion',
        status: 'success',
        source: 'webhook',
        metadata: { userId: evt.data.id },
      });
    }

    return NextResponse.json({ ok: true, action: 'upserted' });
  }

  return NextResponse.json({ ok: true, action: 'ignored' });
}
