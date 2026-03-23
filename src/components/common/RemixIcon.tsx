'use client';

import type { SVGProps } from 'react';

export function RemixIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M9 5h6a4 4 0 0 1 4 4v7" />
      <polyline points="15 12 19 16 23 12" />
      <path d="M15 19H9a4 4 0 0 1-4-4V8" />
      <polyline points="9 12 5 8 1 12" />
      <line x1="12" y1="9" x2="12" y2="15" />
      <line x1="9" y1="12" x2="15" y2="12" />
    </svg>
  );
}
