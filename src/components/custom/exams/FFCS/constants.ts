import timetableSchema from "@/data/campus/chennai.json";

export const DAYS = [
  { id: "mon", name: "Monday" },
  { id: "tue", name: "Tuesday" },
  { id: "wed", name: "Wednesday" },
  { id: "thu", name: "Thursday" },
  { id: "fri", name: "Friday" },
];

export const COLORS = [
  "bg-blue-600", "bg-purple-600", "bg-emerald-500", "bg-red-600", 
  "bg-amber-500", "bg-pink-500", "bg-indigo-600", "bg-teal-500", "bg-orange-500",
  "bg-cyan-600", "bg-fuchsia-500", "bg-lime-500", "bg-rose-600", "bg-violet-600",
  "bg-sky-500", "bg-yellow-500", "bg-green-600", "bg-magenta-500"
];

export const COLOR_HEX_MAP: Record<string, string> = {
  "bg-blue-600": "#2563eb",
  "bg-purple-600": "#9333ea",
  "bg-emerald-500": "#10b981",
  "bg-red-600": "#dc2626",
  "bg-amber-500": "#f59e0b",
  "bg-pink-500": "#ec4899",
  "bg-indigo-600": "#4f46e5",
  "bg-teal-500": "#14b8a6",
  "bg-orange-500": "#f97316",
  "bg-cyan-600": "#0891b2",
  "bg-fuchsia-500": "#d946ef",
  "bg-lime-500": "#84cc16",
  "bg-rose-600": "#e11d48",
  "bg-violet-600": "#7c3aed",
  "bg-sky-500": "#0ea5e9",
  "bg-yellow-500": "#eab308",
  "bg-green-600": "#16a34a",
  "bg-magenta-500": "#d63384"
};

export const typeLabels: Record<string, string> = {
  SS: "Soft Skills",
  TH: "Theory Only",
  LO: "Lab Only",
  PJT: "Project",
  ETH: "Embedded Theory",
  ELA: "Embedded Lab",
  EPJ: "Embedded Project",
  OC: "Option Course",
  "ETH+ELA": "Embedded Theory and Lab",
  "TH+LO": "Theory + Lab"
};

export const typeColors: Record<string, { bg: string; text: string; border: string }> = {
  SS: { bg: "bg-teal-500/10 dark:bg-teal-400/10", text: "text-teal-600 dark:text-teal-400", border: "border-teal-500/30" },
  TH: { bg: "bg-blue-500/10 dark:bg-blue-400/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30" },
  LO: { bg: "bg-purple-500/10 dark:bg-purple-400/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/30" },
  PJT: { bg: "bg-pink-500/10 dark:bg-pink-400/10", text: "text-pink-600 dark:text-pink-400", border: "border-pink-500/30" },
  ETH: { bg: "bg-amber-500/10 dark:bg-amber-400/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/30" },
  ELA: { bg: "bg-indigo-500/10 dark:bg-indigo-400/10", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-500/30" },
  EPJ: { bg: "bg-rose-500/10 dark:bg-rose-400/10", text: "text-rose-600 dark:text-rose-400", border: "border-rose-500/30" },
  OC: { bg: "bg-emerald-500/10 dark:bg-emerald-400/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30" },
  "ETH+ELA": { bg: "bg-cyan-500/10 dark:bg-cyan-400/10", text: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-500/30" },
  "TH+LO": { bg: "bg-violet-500/10 dark:bg-violet-400/10", text: "text-violet-600 dark:text-violet-400", border: "border-violet-500/30" }
};

export const defaultColor = { bg: "bg-slate-500/10 dark:bg-slate-400/10", text: "text-slate-600 dark:text-slate-400", border: "border-slate-500/30" };

export const NEON_COLORS: Record<string, { bg: string; border: string; glow: string; text: string }> = {
  "bg-blue-600": { bg: "rgba(37, 99, 235, 0.16)", border: "rgba(59, 130, 246, 0.55)", glow: "rgba(59, 130, 246, 0.25)", text: "#93c5fd" },
  "bg-purple-600": { bg: "rgba(147, 51, 234, 0.16)", border: "rgba(168, 85, 247, 0.55)", glow: "rgba(168, 85, 247, 0.25)", text: "#d8b4fe" },
  "bg-emerald-500": { bg: "rgba(16, 185, 129, 0.16)", border: "rgba(52, 211, 153, 0.55)", glow: "rgba(52, 211, 153, 0.25)", text: "#6ee7b7" },
  "bg-red-600": { bg: "rgba(220, 38, 38, 0.16)", border: "rgba(248, 113, 113, 0.55)", glow: "rgba(248, 113, 113, 0.25)", text: "#fca5a5" },
  "bg-amber-500": { bg: "rgba(245, 158, 11, 0.16)", border: "rgba(251, 191, 36, 0.55)", glow: "rgba(251, 191, 36, 0.25)", text: "#fde68a" },
  "bg-pink-500": { bg: "rgba(236, 72, 153, 0.16)", border: "rgba(244, 114, 182, 0.55)", glow: "rgba(244, 114, 182, 0.25)", text: "#fbcfe8" },
  "bg-indigo-600": { bg: "rgba(79, 70, 229, 0.16)", border: "rgba(129, 140, 248, 0.55)", glow: "rgba(129, 140, 248, 0.25)", text: "#c7d2fe" },
  "bg-teal-500": { bg: "rgba(20, 184, 166, 0.16)", border: "rgba(45, 212, 191, 0.55)", glow: "rgba(45, 212, 191, 0.25)", text: "#99f6e4" },
  "bg-orange-500": { bg: "rgba(249, 115, 22, 0.16)", border: "rgba(251, 146, 60, 0.55)", glow: "rgba(251, 146, 60, 0.25)", text: "#fed7aa" },
  "bg-cyan-600": { bg: "rgba(8, 145, 178, 0.16)", border: "rgba(34, 211, 238, 0.55)", glow: "rgba(34, 211, 238, 0.25)", text: "#a5f3fc" },
  "bg-fuchsia-500": { bg: "rgba(217, 70, 239, 0.16)", border: "rgba(232, 121, 249, 0.55)", glow: "rgba(232, 121, 249, 0.25)", text: "#f5d0fe" },
  "bg-lime-500": { bg: "rgba(132, 204, 22, 0.16)", border: "rgba(163, 230, 53, 0.55)", glow: "rgba(163, 230, 53, 0.25)", text: "#d9f99d" },
  "bg-rose-600": { bg: "rgba(225, 29, 72, 0.16)", border: "rgba(251, 113, 133, 0.55)", glow: "rgba(251, 113, 133, 0.25)", text: "#fecdd3" },
  "bg-violet-600": { bg: "rgba(124, 58, 237, 0.16)", border: "rgba(167, 139, 250, 0.55)", glow: "rgba(167, 139, 250, 0.25)", text: "#ddd6fe" },
  "bg-sky-500": { bg: "rgba(14, 165, 233, 0.16)", border: "rgba(56, 189, 248, 0.55)", glow: "rgba(56, 189, 248, 0.25)", text: "#bae6fd" },
  "bg-yellow-500": { bg: "rgba(234, 179, 8, 0.16)", border: "rgba(250, 204, 21, 0.55)", glow: "rgba(250, 204, 21, 0.25)", text: "#fef08a" },
  "bg-green-600": { bg: "rgba(22, 163, 74, 0.16)", border: "rgba(74, 222, 128, 0.55)", glow: "rgba(74, 222, 128, 0.25)", text: "#bbf7d0" },
  "bg-magenta-500": { bg: "rgba(214, 51, 132, 0.16)", border: "rgba(244, 114, 182, 0.55)", glow: "rgba(244, 114, 182, 0.25)", text: "#fbcfe8" }
};

export interface CourseBadgeProps {
  className: string;
  style?: React.CSSProperties;
}

/**
 * Returns UI tokens for course badges.
 * When `isModern` is true, returns a glowing neon translucent badge.
 * When `isModern` is false, returns the classic solid bright pill.
 */
export function getCourseBadgeProps(
  colorClassOrHex?: string,
  isModern: boolean = true
): CourseBadgeProps {
  if (!isModern) {
    return {
      className: `px-2.5 py-1 rounded-lg ${colorClassOrHex || "bg-blue-600"} text-white text-xs font-bold shadow-sm shrink-0`,
    };
  }

  const token = (colorClassOrHex && NEON_COLORS[colorClassOrHex]) || null;
  if (token) {
    return {
      className: "px-2.5 py-1 rounded-lg text-xs font-black tracking-wide shrink-0 transition-all border shadow-xs",
      style: {
        backgroundColor: token.bg,
        borderColor: token.border,
        color: "#ffffff",
        boxShadow: `0 0 10px ${token.glow}`,
      },
    };
  }

  const colorHex =
    (colorClassOrHex && COLOR_HEX_MAP[colorClassOrHex]) ||
    (colorClassOrHex?.startsWith("#") ? colorClassOrHex : "#2563eb");

  return {
    className: "px-2.5 py-1 rounded-lg text-xs font-black tracking-wide shrink-0 transition-all border shadow-xs",
    style: {
      backgroundColor: `${colorHex}26`,
      borderColor: `${colorHex}88`,
      color: "#ffffff",
      boxShadow: `0 0 10px ${colorHex}35`,
    },
  };
}
