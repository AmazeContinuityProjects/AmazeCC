import timetableSchema from "@/app/data/chennai.json";

export const DAYS = [
  { id: "mon", name: "Monday" },
  { id: "tue", name: "Tuesday" },
  { id: "wed", name: "Wednesday" },
  { id: "thu", name: "Thursday" },
  { id: "fri", name: "Friday" },
];

export const COLORS = [
  "bg-blue-500", "bg-purple-500", "bg-green-500", "bg-red-500", 
  "bg-yellow-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500", "bg-orange-500"
];

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
