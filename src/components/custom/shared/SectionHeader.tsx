import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export default function SectionHeader({
  icon,
  title,
  subtitle,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4", className)}>
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {subtitle && (
          <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
