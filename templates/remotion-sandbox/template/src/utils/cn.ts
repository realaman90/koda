import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes — standard shadcn/ui pattern */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
