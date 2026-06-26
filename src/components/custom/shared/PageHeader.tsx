import { cn } from "@/lib/utils";

interface PageHeaderProps {
  icon?: React.ReactNode;
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export default function PageHeader({
  icon,
  title,
  meta,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "bg-info-surface/60 border-b border-x border-border rounded-b-2xl py-4.5 px-6 shadow-sm flex flex-row items-center justify-between gap-4 -mx-4 md:-mx-6 mb-6 relative z-10",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5 z-10 min-w-0">
        <h1 className="text-lg sm:text-xl md:text-2xl font-black font-[family-name:var(--font-outfit)] tracking-tight text-text-heading flex items-center gap-2.5 min-w-0">
          {icon}
          <span className="truncate">{title}</span>
        </h1>
        {meta}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 z-10 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
