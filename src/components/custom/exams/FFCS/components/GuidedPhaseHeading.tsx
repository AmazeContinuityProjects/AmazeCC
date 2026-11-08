import type { ReactNode } from "react";

type GuidedPhaseTone = "indigo" | "purple" | "amber" | "rose" | "emerald";

interface GuidedPhaseHeadingProps {
  variant?: "hero" | "portrait";
  tone: GuidedPhaseTone;
  icon: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  description: ReactNode;
}

const toneClasses: Record<GuidedPhaseTone, { tile: string; text: string }> = {
  indigo: { tile: "bg-indigo-500/10 border-indigo-500/20", text: "text-indigo-400" },
  purple: { tile: "bg-course-3/10 border-course-3/20", text: "text-course-3" },
  amber: { tile: "bg-warn-soft border-warn/20", text: "text-warn" },
  rose: { tile: "bg-danger-soft border-danger/20", text: "text-danger" },
  emerald: { tile: "bg-ok-soft border-ok/20", text: "text-ok" },
};

export function GuidedPhaseHeading({
  variant = "hero",
  tone,
  icon,
  eyebrow,
  title,
  description,
}: GuidedPhaseHeadingProps) {
  const iconClasses = `w-12 h-12 rounded-md border flex items-center justify-center shadow-lg ${toneClasses[tone].tile} ${toneClasses[tone].text}`;

  if (variant === "portrait") {
    return (
      <div className="flex flex-col items-center gap-2 shrink-0">
        <div className={iconClasses}>{icon}</div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-ink font-outfit tracking-tight">
          {title}
        </h1>
        <p className="text-xs text-muted font-medium max-w-xs sm:max-w-md">{description}</p>
      </div>
    );
  }

  return (
    <>
      <div className={iconClasses}>{icon}</div>
      <div>
        <span className={`text-[11px] font-semibold font-outfit ${toneClasses[tone].text}`}>
          {eyebrow}
        </span>
        <h1 className="text-2xl lg:text-3xl font-semibold text-ink font-outfit tracking-tight">
          {title}
        </h1>
      </div>
      <p className="text-xs text-muted font-medium leading-relaxed">{description}</p>
    </>
  );
}
