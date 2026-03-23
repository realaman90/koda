import { headers as nextHeaders } from 'next/headers';

const DEV_BYPASS_VALUES = new Set(['1', 'true', 'yes', 'on']);

export const DEV_AUTH_BYPASS_HEADER = 'x-dev-auth-bypass-token';
export const DEV_AUTH_BYPASS_INTERNAL_HEADER = 'x-koda-dev-auth-bypass';

let didWarnDevBypass = false;

function parseBooleanEnv(value: string | undefined) {
  if (!value) return false;
  return DEV_BYPASS_VALUES.has(value.trim().toLowerCase());
}

export function isDevAuthBypassEnabled() {
  return process.env.NODE_ENV === 'development' && parseBooleanEnv(process.env.DEV_AUTH_BYPASS);
}

export function getDevAuthBypassToken() {
  const value = process.env.DEV_AUTH_BYPASS_TOKEN?.trim();
  return value ? value : null;
}

export function warnDevAuthBypassEnabled(source: 'middleware' | 'server-auth') {
  if (!isDevAuthBypassEnabled() || didWarnDevBypass) {
    return;
  }

  didWarnDevBypass = true;
  console.warn(
    `[auth] DEV_AUTH_BYPASS is enabled in development (${source}). This bypass is blocked outside NODE_ENV=development.`
  );
}

export function isBypassTokenValid(inputToken: string | null) {
  const expectedToken = getDevAuthBypassToken();

  if (!expectedToken) {
    return true;
  }

  return Boolean(inputToken && inputToken === expectedToken);
}

export function isApiDevBypassRequestAllowed(requestHeaders: Headers) {
  if (!isDevAuthBypassEnabled()) {
    return false;
  }

  return isBypassTokenValid(requestHeaders.get(DEV_AUTH_BYPASS_HEADER));
}

export async function isServerDevBypassAllowed() {
  if (!isDevAuthBypassEnabled()) {
    return false;
  }

  const headerStore = await nextHeaders();

  if (headerStore.get(DEV_AUTH_BYPASS_INTERNAL_HEADER) !== '1') {
    return false;
  }

  return isBypassTokenValid(headerStore.get(DEV_AUTH_BYPASS_HEADER));
}
