import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      {icon && <div className="mb-4 text-gray-300  dark:text-gray-700">{icon}</div>}
      <h3 className="text-lg font-semibold text-gray-700  dark:text-gray-300">
        {title}
      </h3>
      {description && (
        <p className="mt-2 text-sm text-gray-400  dark:text-gray-500 max-w-xs">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
