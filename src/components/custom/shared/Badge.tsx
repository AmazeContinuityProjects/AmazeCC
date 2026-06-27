import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "purple";
  size?: "sm" | "md";
}

const variants = {
  default: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 midnight:bg-gray-800 midnight:text-gray-300",
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 midnight:bg-emerald-900/20 midnight:text-emerald-300",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 midnight:bg-amber-900/20 midnight:text-amber-300",
  danger: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 midnight:bg-red-900/20 midnight:text-red-300",
  info: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 midnight:bg-blue-900/20 midnight:text-blue-300",
  purple: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 midnight:bg-purple-900/20 midnight:text-purple-300",
};

const sizes = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-xs",
};

export default function Badge({
  children,
  className,
  variant = "default",
  size = "sm",
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  );
}
