import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

const variants = {
  primary:
    "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98]",
  secondary:
    "bg-gray-100 dark:bg-slate-800 midnight:bg-gray-800 hover:bg-gray-200 dark:hover:bg-slate-700 midnight:hover:bg-gray-700 text-gray-700 dark:text-gray-200 midnight:text-gray-200 border border-gray-200 dark:border-gray-700 midnight:border-gray-700",
  ghost:
    "bg-transparent hover:bg-gray-100 dark:hover:bg-slate-800/50 midnight:hover:bg-gray-800/50 text-gray-600 dark:text-gray-300 midnight:text-gray-300",
  danger:
    "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/25 active:scale-[0.98]",
  success:
    "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/25 active:scale-[0.98]",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-5 py-2.5 text-sm gap-2",
  lg: "px-8 py-3.5 text-base gap-2.5",
};

export default function Button({
  children,
  className,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
