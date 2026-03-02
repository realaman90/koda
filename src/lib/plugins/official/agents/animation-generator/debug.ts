const DEBUG_STORAGE_KEY = 'ANIMATION_DEBUG';

export function isAnimationDebugEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_ANIMATION_DEBUG === '1') {
    return true;
  }

  if (typeof window !== 'undefined') {
    try {
      return window.localStorage.getItem(DEBUG_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  return false;
}

export function animationDebugLog(...args: unknown[]): void {
  if (isAnimationDebugEnabled()) {
    console.log(...args);
  }
}
