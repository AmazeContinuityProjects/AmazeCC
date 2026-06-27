import { AlertCircle, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorDisplayProps {
  message: string;
  variant?: "error" | "warning";
  className?: string;
  onRetry?: () => void;
}

const icons = {
  error: XCircle,
  warning: AlertTriangle,
};

const styles = {
  error: "error-banner",
  warning: "warning-banner",
};

export default function ErrorDisplay({
  message,
  variant = "error",
  className,
  onRetry,
}: ErrorDisplayProps) {
  const Icon = icons[variant];
  return (
    <div className={cn(styles[variant], "mb-5", className)}>
      <Icon className="w-4 h-4 shrink-0" />
      <span
        className="flex-1"
        dangerouslySetInnerHTML={{ __html: message }}
      />
      {onRetry && (
        <button
          onClick={onRetry}
          className="ml-auto text-sm font-medium underline hover:no-underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}
