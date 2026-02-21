"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GradientBorderCardProps {
  children: React.ReactNode;
  className?: string;
  animateOnHover?: boolean;
  variant?: "interactive" | "static" | "disabled";
  hoverDuration?: number;
}

export function GradientBorderCard({
  children,
  className,
  animateOnHover = true,
  variant = "interactive",
  hoverDuration = 300
}: GradientBorderCardProps) {
  if (variant === "disabled") {
    return (
      <div className={cn("rounded-xl bg-[var(--node-card-bg)] border border-[var(--node-card-border)]", className)}>
        {children}
      </div>
    );
  }

  if (variant === "static") {
    return (
      <div 
        className={cn(
          "relative rounded-xl bg-[var(--node-card-bg)] p-[2px]",
          className
        )}
        style={{
          background: `linear-gradient(var(--node-card-bg), var(--node-card-bg)) padding-box,
                       linear-gradient(135deg, var(--accent-amber), var(--accent-pink)) border-box`
        }}
      >
        <div className="rounded-[calc(0.75rem-2px)] bg-[var(--node-card-bg)] h-full">
          {children}
        </div>
      </div>
    );
  }

  // Interactive variant with hover animation
  return (
    <motion.div
      className={cn(
        "relative rounded-xl bg-[var(--node-card-bg)] border border-[var(--node-card-border)] overflow-hidden",
        className
      )}
      initial={false}
      animate={{ 
        borderColor: "rgba(245, 158, 11, 0)",
        boxShadow: "var(--node-card-shadow)"
      }}
      whileHover={{ 
        borderColor: "rgba(245, 158, 11, 0.5)",
        boxShadow: "var(--node-card-shadow-hover)"
      }}
      transition={{ 
        duration: hoverDuration / 1000,
        ease: "easeOut"
      }}
      style={{
        background: `linear-gradient(var(--node-card-bg), var(--node-card-bg)) padding-box,
                     linear-gradient(135deg, var(--accent-amber), var(--accent-pink)) border-box`
      }}
    >
      {/* Gradient border overlay on hover */}
      {animateOnHover && (
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          transition={{ duration: hoverDuration / 1000 }}
          style={{
            background: `linear-gradient(135deg, var(--accent-amber), var(--accent-pink))`,
            mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            maskComposite: "exclude",
            padding: "1px",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor"
          }}
        />
      )}
      <div className="relative rounded-xl bg-[var(--node-card-bg)] h-full">
        {children}
      </div>
    </motion.div>
  );
}
