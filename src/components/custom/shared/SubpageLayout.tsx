import { ChevronLeft } from "lucide-react";
import BackButton from "./BackButton";

interface SubpageLayoutProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export default function SubpageLayout({
  title,
  subtitle,
  onBack,
  action,
  children,
  className,
}: SubpageLayoutProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Mobile header */}
      <div className="flex items-center justify-between w-full md:hidden mb-4 px-4">
        <div className="flex items-center gap-3 min-w-0">
          <BackButton onClick={onBack} className="flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xl font-black font-[family-name:var(--font-outfit)] text-text-heading truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-text-secondary truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action && <div className="flex-shrink-0 ml-2">{action}</div>}
      </div>

      {/* Desktop header */}
      <div className="hidden md:flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BackButton onClick={onBack} />
          <div>
            <h1 className="text-2xl md:text-3xl font-black font-[family-name:var(--font-outfit)] text-text-heading leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-text-secondary mt-1">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>

      <div className={className}>{children}</div>
    </div>
  );
}
