import { openBillingPrompt } from '@/stores/billing-prompt-store';

export type ApiErrorPayload = {
  error?: unknown;
  message?: unknown;
  required?: unknown;
  balance?: unknown;
};

function asTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function buildCreditMessage(payload: ApiErrorPayload): string {
  const required = asFiniteNumber(payload.required);
  const balance = asFiniteNumber(payload.balance);
  if (required !== null && balance !== null) {
    return `You are out of credits. This action needs ${required} credits and you have ${balance}.`;
  }
  return 'You are out of credits. Please upgrade your plan to continue generating.';
}

function isInsufficientCredits(response: Response, payload: ApiErrorPayload | null): boolean {
  const errorCode = asTrimmedString(payload?.error);
  return response.status === 402 || errorCode === 'INSUFFICIENT_CREDITS';
}

function maybeOpenBillingPrompt(payload: ApiErrorPayload | null): void {
  if (typeof window === 'undefined') return;

  openBillingPrompt({
    message: asTrimmedString(payload?.message) ?? buildCreditMessage(payload ?? {}),
    required: asFiniteNumber(payload?.required),
    balance: asFiniteNumber(payload?.balance),
  });
}

export function handleInsufficientCreditsPayload(payload: ApiErrorPayload | null): string {
  const message = asTrimmedString(payload?.message) ?? buildCreditMessage(payload ?? {});
  maybeOpenBillingPrompt(payload);
  return message;
}

/**
 * Parse API error responses into a user-friendly message.
 * Handles credit-specific responses from withCredits() (402 + INSUFFICIENT_CREDITS).
 */
export async function getApiErrorMessage(response: Response, fallback: string): Promise<string> {
  let payload: ApiErrorPayload | null = null;

  try {
    payload = await response.clone().json() as ApiErrorPayload;
  } catch {
    payload = null;
  }

  if (isInsufficientCredits(response, payload)) {
    return handleInsufficientCreditsPayload(payload);
  }

  const message = asTrimmedString(payload?.message);
  if (message) return message;

  const error = asTrimmedString(payload?.error);
  if (error) return error;

  if (response.statusText?.trim()) return response.statusText.trim();
  return fallback;
}

export function normalizeApiErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return message === 'INSUFFICIENT_CREDITS'
    ? 'You are out of credits. Please upgrade your plan to continue generating.'
    : message;
}
