import { cn } from "@/lib/utils";

interface InfoRowProps {
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  iconClassName?: string;
}

export default function InfoRow({
  icon,
  children,
  className,
  iconClassName,
}: InfoRowProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("text-gray-400 dark:text-gray-500 midnight:text-gray-500 flex-shrink-0", iconClassName)}>
        {icon}
      </div>
      <div className="text-sm text-gray-700 dark:text-gray-300 midnight:text-gray-300">
        {children}
      </div>
    </div>
  );
}
