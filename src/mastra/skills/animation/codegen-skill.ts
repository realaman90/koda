import { getContextValue, setContextValue } from './context';
import type { AnimationSkill, RequestContextLike } from './types';

export const RETRYABLE_UPSTREAM_RE = /other side closed|cannot connect to api|connection closed|websocket|fetch failed|econnreset|socket hang up|timed out|timeout|und_err_socket/i;
export const MAX_CODEGEN_TRANSPORT_FAILURES_PER_STREAM = 2;
export const CODEGEN_MAX_GENERATE_ATTEMPTS = 2;
export const CODEGEN_ATTEMPT_TIMEOUT_MS = 45_000;

export const isUpstreamTransportError = (message: string): boolean => RETRYABLE_UPSTREAM_RE.test(message.toLowerCase());

export const getCodegenTransportFailures = (ctx: RequestContextLike | undefined): number => {
  return (getContextValue<number>(ctx, 'codegenTransportFailures') ?? 0);
};

export const setCodegenTransportFailures = (ctx: RequestContextLike | undefined, value: number): void => {
  setContextValue(ctx, 'codegenTransportFailures', Math.max(0, value));
};

export const incrementCodegenTransportFailures = (ctx: RequestContextLike | undefined): number => {
  const next = getCodegenTransportFailures(ctx) + 1;
  setCodegenTransportFailures(ctx, next);
  return next;
};

export const buildTransportErrorSummary = (
  errorMessage: string,
  failureCount: number,
): string => {
  return `ERROR: Code generation failed: ${errorMessage}. Upstream LLM transport dropped (${failureCount}/${MAX_CODEGEN_TRANSPORT_FAILURES_PER_STREAM} failures this run). Retry the stream; if it repeats, switch model/provider.`;
};

export async function withUpstreamRetry<T>(
  ctx: RequestContextLike | undefined,
  generateFn: () => Promise<T>,
  onRetry?: (attempt: number, maxAttempts: number, backoffMs: number, errorMessage: string) => void,
  options?: {
    maxAttempts?: number;
    attemptTimeoutMs?: number;
    backoffBaseMs?: number;
  },
): Promise<T> {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? CODEGEN_MAX_GENERATE_ATTEMPTS);
  const attemptTimeoutMs = Math.max(10_000, options?.attemptTimeoutMs ?? CODEGEN_ATTEMPT_TIMEOUT_MS);
  const backoffBaseMs = Math.max(100, options?.backoffBaseMs ?? 1200);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const streamClosedBeforeAttempt = getContextValue<boolean>(ctx, 'streamClosed') === true;
    if (streamClosedBeforeAttempt) {
      throw new Error('Stream closed while waiting for upstream code generation.');
    }

    try {
      const result = await new Promise<T>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Upstream code generation timeout after ${attemptTimeoutMs}ms`));
        }, attemptTimeoutMs);

        generateFn()
          .then((value) => {
            clearTimeout(timeout);
            resolve(value);
          })
          .catch((error) => {
            clearTimeout(timeout);
            reject(error);
          });
      });
      return result;
    } catch (error) {
      lastError = error;
      const errorMsg = error instanceof Error ? error.message : String(error);
      const retryable = isUpstreamTransportError(errorMsg);
      const streamClosed = getContextValue<boolean>(ctx, 'streamClosed') === true;
      if (!retryable || streamClosed || attempt === maxAttempts) {
        throw error;
      }

      const backoffMs = Math.min(5000, backoffBaseMs * Math.pow(2, attempt - 1));
      onRetry?.(attempt, maxAttempts, backoffMs, errorMsg);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export const codegenSkill: AnimationSkill = {
  id: 'codegen',
  run: async (input) => {
    const action = input.action || 'preflight';
    const ctx = input.requestContext;

    if (action === 'success') {
      setCodegenTransportFailures(ctx, 0);
      return { ok: true, summary: 'Code generation state reset' };
    }

    if (action === 'transport_error') {
      const errorMessage = String(input.payload?.errorMessage || 'Unknown transport error');
      const failures = incrementCodegenTransportFailures(ctx);
      return {
        ok: false,
        retryable: failures < MAX_CODEGEN_TRANSPORT_FAILURES_PER_STREAM,
        fatal: failures >= MAX_CODEGEN_TRANSPORT_FAILURES_PER_STREAM,
        errorClass: 'UpstreamTransportError',
        summary: buildTransportErrorSummary(errorMessage, failures),
        updates: { codegenTransportFailures: failures },
      };
    }

    const failures = getCodegenTransportFailures(ctx);
    if (failures >= MAX_CODEGEN_TRANSPORT_FAILURES_PER_STREAM) {
      return {
        ok: false,
        fatal: true,
        errorClass: 'UpstreamTransportError',
        summary: `ERROR: Upstream LLM connectivity is unstable (${failures} transport failures in this run). Stop retrying this stream and ask the user to retry.`,
        updates: { codegenTransportFailures: failures },
      };
    }

    return {
      ok: true,
      summary: 'Code generation preflight passed',
      updates: { codegenTransportFailures: failures },
    };
  },
};
