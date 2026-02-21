"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, MessageCircle, Wand2, FileText, Lightbulb } from "lucide-react";

interface FloatingActionButtonProps {
  onClick?: () => void;
  position?: "bottom-right" | "bottom-center";
  size?: "default" | "large";
  label?: string;
}

export function FloatingActionButton({
  onClick,
  position = "bottom-right",
  size = "default",
  label = "Open AI Assistant"
}: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = () => {
    setIsOpen(!isOpen);
    onClick?.();
  };

  const positionClasses = {
    "bottom-right": "bottom-6 right-6",
    "bottom-center": "bottom-6 left-1/2 -translate-x-1/2"
  };

  const buttonSizeClasses = {
    default: "w-14 h-14",
    large: "w-16 h-16"
  };

  const iconSizeClasses = {
    default: "w-6 h-6",
    large: "w-7 h-7"
  };

  const suggestions = [
    { icon: Wand2, label: "Suggest layout ideas" },
    { icon: Lightbulb, label: "Help with design" },
    { icon: FileText, label: "Write copy for this canvas" },
  ];

  return (
    <div className={`fixed ${positionClasses[position]} z-40`}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute bottom-20 right-0 w-80 bg-[var(--node-card-bg)] border border-[var(--node-card-border)] rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4)] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--node-card-border)]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#3b82f6]" />
                <span className="font-semibold text-[var(--text-primary)]">AI Assistant</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-[var(--node-card-bg-secondary)] transition-colors"
              >
                <X className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </div>
            
            {/* Greeting */}
            <div className="px-4 py-3">
              <p className="text-sm text-[var(--text-secondary)]">
                Hi! How can I help you today?
              </p>
            </div>
            
            {/* Suggestions */}
            <div className="px-4 pb-2 space-y-1">
              {suggestions.map((item, index) => (
                <button
                  key={index}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--node-card-bg-secondary)] transition-colors"
                >
                  <item.icon className="w-4 h-4 text-[#3b82f6]" />
                  {item.label}
                </button>
              ))}
            </div>
            
            {/* Input area */}
            <div className="px-4 py-3 border-t border-[var(--node-card-border)]">
              <div className="flex items-center gap-2 bg-[var(--node-card-bg-secondary)] rounded-lg px-3 py-2">
                <input
                  type="text"
                  placeholder="Type your message..."
                  className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                />
                <button className="p-1.5 rounded-md bg-[#3b82f6] text-white hover:bg-[#2563eb] transition-colors">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" />
                  </svg>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* FAB Button */}
      <motion.button
        onClick={handleClick}
        className={`${buttonSizeClasses[size]} rounded-full border-0 cursor-pointer flex items-center justify-center bg-[#3b82f6] shadow-[0_4px_14px_rgba(59,130,246,0.35)] hover:shadow-[0_6px_18px_rgba(59,130,246,0.4)] transition-shadow`}
        style={{
          boxShadow: isOpen 
            ? "0 6px 18px rgba(59, 130, 246, 0.4)"
            : "0 4px 14px rgba(59, 130, 246, 0.35)"
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        aria-label={label}
        aria-expanded={isOpen}
      >
        <motion.div
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          {isLoading ? (
            <div className={`${iconSizeClasses[size]} border-2 border-white border-t-transparent rounded-full animate-spin`} />
          ) : (
            <Sparkles className={`${iconSizeClasses[size]} text-white`} />
          )}
        </motion.div>
      </motion.button>
    </div>
  );
}
