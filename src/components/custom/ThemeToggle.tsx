"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Lightbulb, Sparkles } from "lucide-react";

export function safeThemeTransition(newTheme: string, setTheme: (val: string) => void) {
  if (typeof document !== "undefined" && (document as any).startViewTransition) {
    (document as any).startViewTransition(() => {
      setTheme(newTheme);
    });
  } else {
    setTheme(newTheme);
  }
}

interface ThemeToggleProps {
  className?: string;
  variant?: "icon" | "pill" | "lightbulb";
  showLabel?: boolean;
}

export default function ThemeToggle({ className = "", variant = "lightbulb", showLabel = false }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [isClicking, setIsClicking] = useState(false);
  const isDark = theme === "dark";

  const toggleTheme = () => {
    setIsClicking(true);
    setTimeout(() => setIsClicking(false), 500);
    const targetTheme = isDark ? "light" : "dark";
    safeThemeTransition(targetTheme, setTheme);
  };

  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      whileHover={{ scale: 1.05 }}
      onClick={toggleTheme}
      className={`relative inline-flex items-center justify-center p-2 rounded-2xl border transition-all cursor-pointer select-none group focus:outline-none ${
        isDark 
          ? "bg-zinc-900/90 border-zinc-800 text-amber-300 shadow-md hover:bg-zinc-850 hover:border-amber-400/40" 
          : "bg-white border-zinc-200 text-indigo-600 shadow-sm hover:bg-zinc-50 hover:border-indigo-300"
      } ${className}`}
      title={`Switch to ${isDark ? "Light" : "Dark"} mode`}
    >
      {/* Ambient glowing radial backdrop on click */}
      <AnimatePresence>
        {isClicking && (
          <motion.span
            initial={{ scale: 0.5, opacity: 0.8 }}
            animate={{ scale: 2.2, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className={`absolute inset-0 rounded-full pointer-events-none ${
              isDark ? "bg-amber-400/30" : "bg-indigo-500/30"
            }`}
          />
        )}
      </AnimatePresence>

      <div className="relative flex items-center justify-center gap-2 px-0.5">
        <motion.div
          key={theme}
          initial={{ rotate: -90, scale: 0.5, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0.5, opacity: 0 }}
          transition={{ type: "spring", stiffness: 350, damping: 22 }}
          className="flex items-center justify-center"
        >
          {variant === "lightbulb" ? (
            <div className="relative flex items-center justify-center">
              <Lightbulb className={`h-4.5 w-4.5 stroke-[2.2] transition-all ${
                isDark 
                  ? "fill-amber-400/20 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" 
                  : "fill-indigo-500/10 text-indigo-600"
              }`} />
              {isDark && (
                <motion.span
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute -top-1 -right-1 text-amber-400"
                >
                  <Sparkles size={8} />
                </motion.span>
              )}
            </div>
          ) : isDark ? (
            <Sun className="h-4.5 w-4.5 stroke-[2.2] text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
          ) : (
            <Moon className="h-4.5 w-4.5 stroke-[2.2] text-indigo-600" />
          )}
        </motion.div>

        {showLabel && (
          <span className="text-xs font-bold capitalize tracking-wide pr-1">
            {isDark ? "Light Mode" : "Dark Mode"}
          </span>
        )}
      </div>
    </motion.button>
  );
}
