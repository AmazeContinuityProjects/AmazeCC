import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { Button as BaseButton, type ButtonProps as BaseButtonProps } from "@amazecontinuityprojects/amazeui";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success" | "default" | "destructive" | "outline" | "link";
  size?: "sm" | "md" | "lg" | "default" | "icon";
  loading?: boolean;
  icon?: React.ReactNode;
  asChild?: boolean;
}

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
  // Map size from AmazeCC (md) to AmazeUI (default)
  const mappedSize = size === "md" ? "default" : size;

  return (
    <BaseButton
      className={cn("font-semibold rounded-xl", className)}
      variant={variant as any}
      size={mappedSize as any}
      disabled={disabled || loading}
      {...(props as any)}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </BaseButton>
  );
}
