"use client";

import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";

export function animateThemeCircularExpansion(
  event: React.MouseEvent<HTMLElement> | MouseEvent | null,
  newTheme: string,
  setTheme: (val: string) => void
) {
  if (typeof document === "undefined") {
    setTheme(newTheme);
    return;
  }

  // Fallback for browsers without View Transitions API
  if (!(document as any).startViewTransition) {
    setTheme(newTheme);
    return;
  }

  // Calculate click coordinates or default to screen center
  const x = event && "clientX" in event && event.clientX > 0 ? event.clientX : window.innerWidth / 2;
  const y = event && "clientY" in event && event.clientY > 0 ? event.clientY : window.innerHeight / 2;

  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  const transition = (document as any).startViewTransition(() => {
    // Synchronously mutate DOM root class before screenshot capture to prevent 1ms flash
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    setTheme(newTheme);
  });

  transition.ready.then(() => {
    document.documentElement.animate(
      [
        { clipPath: `circle(0px at ${x}px ${y}px)` },
        { clipPath: `circle(${endRadius}px at ${x}px ${y}px)` },
      ],
      {
        duration: 420,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        pseudoElement: "::view-transition-new(root)",
      }
    );
  });
}

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export default function ThemeToggle({ className = "", showLabel = false }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const targetTheme = isDark ? "light" : "dark";
    animateThemeCircularExpansion(e, targetTheme, setTheme);
  };

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.05 }}
      onClick={handleToggle}
      className={`relative inline-flex items-center justify-center p-2 rounded-2xl border transition-all cursor-pointer select-none group focus:outline-none ${
        isDark 
          ? "bg-zinc-900/90 border-zinc-800 text-amber-300 shadow-md hover:bg-zinc-850 hover:border-amber-400/40" 
          : "bg-white border-zinc-200 text-indigo-600 shadow-sm hover:bg-zinc-50 hover:border-indigo-300"
      } ${className}`}
      title={`Switch to ${isDark ? "Light" : "Dark"} mode`}
    >
      <div className="relative flex items-center justify-center gap-2 px-0.5">
        <motion.div
          key={theme}
          initial={{ rotate: -90, scale: 0.6, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="flex items-center justify-center"
        >
          {isDark ? (
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
