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
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        <div
          className={cn(
            "relative w-full",
            maxWidth,
            "glass-card",
            "animate-fadeIn",
            className
          )}
        onClick={(e) => e.stopPropagation()}
      >
        {showClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-gray-100 dark:bg-slate-700 midnight:bg-gray-900 hover:bg-gray-200 dark:hover:bg-slate-600 midnight:hover:bg-gray-800 transition-colors"
          >
            <X size={16} className="text-gray-500 dark:text-gray-400 midnight:text-gray-400" />
          </button>
        )}
        {title && (
          <div className="px-6 pt-5 pb-2">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100">
              {title}
            </h2>
          </div>
        )}
        <div className={cn(noPadding ? "" : "p-6", !title && !noPadding && "pt-6")}>{children}</div>
      </div>
    </div>
  );
}
