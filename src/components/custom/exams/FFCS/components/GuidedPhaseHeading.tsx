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
  purple: { tile: "bg-purple-500/10 border-purple-500/20", text: "text-purple-400" },
  amber: { tile: "bg-amber-500/10 border-amber-500/20", text: "text-amber-400" },
  rose: { tile: "bg-rose-500/10 border-rose-500/20", text: "text-rose-400" },
  emerald: { tile: "bg-emerald-500/10 border-emerald-500/20", text: "text-emerald-400" },
};

export function GuidedPhaseHeading({
  variant = "hero",
  tone,
  icon,
  eyebrow,
  title,
  description,
}: GuidedPhaseHeadingProps) {
  const iconClasses = `w-12 h-12 rounded-2xl border flex items-center justify-center shadow-lg ${toneClasses[tone].tile} ${toneClasses[tone].text}`;

  if (variant === "portrait") {
    return (
      <div className="flex flex-col items-center gap-2 shrink-0">
        <div className={iconClasses}>{icon}</div>
        <h1 className="text-2xl sm:text-3xl font-black text-white font-outfit tracking-tight">
          {title}
        </h1>
        <p className="text-xs text-zinc-400 font-medium max-w-xs sm:max-w-md">{description}</p>
      </div>
    );
  }

  return (
    <>
      <div className={iconClasses}>{icon}</div>
      <div>
        <span className={`text-[10px] font-black uppercase tracking-wider font-outfit ${toneClasses[tone].text}`}>
          {eyebrow}
        </span>
        <h1 className="text-2xl lg:text-3xl font-black text-white font-outfit tracking-tight">
          {title}
        </h1>
      </div>
      <p className="text-xs text-zinc-400 font-medium leading-relaxed">{description}</p>
    </>
  );
}
