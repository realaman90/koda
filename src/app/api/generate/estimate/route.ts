import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/auth/actor';
import { getCurrentCreditBalance } from '@/lib/credits/server-balance';
import { estimateImageCompareModels, normalizeImageCompareModels } from '@/lib/compare/estimate';
import { MAX_COMPARE_MODELS } from '@/lib/types';

export async function POST(request: Request) {
  const actorResult = await requireActor();
  if (!actorResult.ok) return actorResult.response;

  try {
    const body = await request.json() as { models?: string[] };
    const rawModels = Array.isArray(body.models) ? body.models : [];

    if (rawModels.length < 2) {
      return NextResponse.json(
        { error: 'Select at least 2 models to compare.' },
        { status: 400 }
      );
    }

    if (rawModels.length > MAX_COMPARE_MODELS) {
      return NextResponse.json(
        { error: `You can compare up to ${MAX_COMPARE_MODELS} models at a time.` },
        { status: 400 }
      );
    }

    const models = normalizeImageCompareModels(rawModels);
    const estimate = estimateImageCompareModels(models);
    const balance = await getCurrentCreditBalance(actorResult.actor.user.id);

    return NextResponse.json({
      ...estimate,
      balance: balance.balance,
      hasSufficientCredits: balance.balance >= estimate.totalCredits,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Compare estimate failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
