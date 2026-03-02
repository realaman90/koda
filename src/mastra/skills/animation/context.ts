import type { RequestContextLike } from './types';

export const getRequestContext = (ctx?: RequestContextLike): RequestContextLike | undefined => ctx;

export const getContextValue = <T>(ctx: RequestContextLike | undefined, key: string): T | undefined => {
  return ctx?.get(key) as T | undefined;
};

export const setContextValue = (ctx: RequestContextLike | undefined, key: string, value: unknown): void => {
  if (!ctx) return;
  ctx.set(key, value);
};
