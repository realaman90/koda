"use client";

import { cn } from "@/lib/utils";

interface GradientBorderCardProps {
  children: React.ReactNode;
  className?: string;
  animateOnHover?: boolean;
  variant?: "interactive" | "static" | "disabled";
}

/**
 * Legacy compatibility wrapper.
 *
 * NOTE: Gradient styling has been removed per unified design spec.
 * This component now renders neutral tokenized surfaces only.
 */
export function GradientBorderCard({
  children,
  className,
  animateOnHover = true,
  variant = "interactive",
}: GradientBorderCardProps) {
  const interactive = animateOnHover && variant === "interactive";

  return (
    <div
      className={cn(
        "rounded-xl bg-[var(--node-card-bg)] border border-[var(--node-card-border)]",
        interactive && "transition-all hover:border-[var(--node-card-border-hover)] hover:shadow-[var(--node-card-shadow-hover)]",
        variant === "disabled" && "opacity-70",
        className
      )}
      style={{ boxShadow: "var(--node-card-shadow)" }}
    >
      {children}
    </div>
  );
}
