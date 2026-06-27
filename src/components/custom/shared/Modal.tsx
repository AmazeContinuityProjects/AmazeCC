"use client";

import { useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen?: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
  className?: string;
  showClose?: boolean;
  noPadding?: boolean;
}

export default function Modal({
  isOpen = true,
  onClose,
  title,
  children,
  maxWidth = "max-w-md",
  className,
  showClose = true,
  noPadding = false,
}: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-background/70 " />
        <div
          className={cn(
            "relative w-full",
            maxWidth,
            "bg-surface-raised text-text-primary border border-border shadow-2xl rounded-3xl",
            "animate-fadeIn",
            className
          )}
        onClick={(e) => e.stopPropagation()}
      >
        {showClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-surface-secondary hover:bg-surface-hover transition-colors"
          >
            <X size={16} className="text-text-secondary" />
          </button>
        )}
        {title && (
          <div className="px-6 pt-5 pb-2">
            <h2 className="text-lg font-bold text-text-heading">
              {title}
            </h2>
          </div>
        )}
        <div className={cn(noPadding ? "" : "p-6", !title && !noPadding && "pt-6")}>{children}</div>
      </div>
    </div>
  );
}
