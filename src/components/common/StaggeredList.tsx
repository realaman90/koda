"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface StaggeredListProps {
  children: React.ReactNode;
  className?: string;
  delayChildren?: number;
  staggerChildren?: number;
  once?: boolean;
}

export function StaggeredList({
  children,
  className,
  delayChildren = 0,
  staggerChildren = 0.05,
  once = true
}: StaggeredListProps) {
  return (
    <motion.div
      className={cn("", className)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once }}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren,
            delayChildren
          }
        }
      }}
    >
      {children}
    </motion.div>
  );
}

export interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
}

export function StaggerItem({ children, className }: StaggerItemProps) {
  return (
    <motion.div
      className={cn("", className)}
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: { 
          opacity: 1, 
          y: 0,
          transition: {
            duration: 0.3,
            ease: [0.4, 0, 0.2, 1]
          }
        }
      }}
    >
      {children}
    </motion.div>
  );
}
