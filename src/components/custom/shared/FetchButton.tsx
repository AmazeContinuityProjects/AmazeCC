import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface FetchButtonProps {
  children?: React.ReactNode;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  variant?: "primary" | "success" | "danger" | "gradient" | "ghost";
  size?: "sm" | "md";
  icon?: React.ReactNode;
}

export default function FetchButton({
  children,
  onClick,
  loading = false,
  disabled = false,
  className,
  variant = "primary",
  size = "md",
  icon,
  type = "button",
  ...props
}: FetchButtonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const sizeClasses = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";

  const variants = {
    primary:
      "bg-blue-600 hover:bg-blue-700 text-white shadow-sm border border-blue-700",
    success:
      "bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/20",
    danger:
      "bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/20",
    gradient:
      "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg",
    ghost:
      "bg-transparent hover:bg-gray-100 dark:hover:bg-slate-700 midnight:hover:bg-gray-800 text-gray-700 dark:text-gray-300 midnight:text-gray-300 border border-transparent",
  };

  return (
      <button
        onClick={onClick}
        type={type}
        disabled={disabled || loading}
        className={cn(
          "flex items-center gap-2 rounded-lg font-medium transition-all duration-300",
          sizeClasses,
          variants[variant],
          (disabled || loading) && "opacity-50 cursor-not-allowed",
          className
        )}
        {...props}
      >
      {loading ? <Loader2 size={size === "sm" ? 14 : 16} className="animate-spin" /> : icon || null}
      {children}
    </button>
  );
}
