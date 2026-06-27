import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
  variant?: "default" | "glass" | "gradient" | "outline";
  gradient?: string;
}

export default function Card({
  children,
  className,
  onClick,
  hover = false,
  variant = "default",
  gradient,
}: CardProps) {
  const base =
    "rounded-2xl transition-all duration-300";

  const variants = {
    default:
      "bg-surface text-text-primary border border-border shadow-sm",
    glass:
      "solid-card",
    gradient: gradient
      ? `border-none text-white shadow-md ${gradient}`
      : "bg-gradient-to-r from-blue-600 to-indigo-600 border-none text-white shadow-md",
    outline:
      "border border-border bg-transparent text-text-primary",
  };

  const hoverClasses = hover
    ? "hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
    : onClick
      ? "cursor-pointer"
      : "";

  return (
    <div
      onClick={onClick}
      className={cn(
        base,
        variants[variant],
        hoverClasses,
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  );
}
