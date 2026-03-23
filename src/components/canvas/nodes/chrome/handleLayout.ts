export function getPromptHeavyInputHandleTop(
  index: number,
  options?: {
    start?: number;
    gap?: number;
  }
) {
  const start = options?.start ?? 110;
  const gap = options?.gap ?? 48;
  return start + index * gap;
}
