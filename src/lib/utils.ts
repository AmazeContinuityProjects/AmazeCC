import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function getAssetPath(path: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/+$/, "") || "";
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${cleanPath}`;
}

export function getMinimalMessage(message: string): string {
  if (!message) return "";
  
  const lines = message.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return "";
  
  const isReload = message.toLowerCase().includes("reload");
  const fetchedCount = lines.filter(l => l.startsWith("✅") || l.includes("✅")).length;
  const totalDetails = isReload ? 8 : 14;
  
  let currentAction = lines[lines.length - 1];
  currentAction = currentAction.replace(/^✅\s*/, "").replace(/^❌\s*/, "");
  
  if (currentAction.toLowerCase().includes("loaded successfully") || currentAction.toLowerCase().includes("all data loaded")) {
    return `All details loaded successfully! (${fetchedCount}/${totalDetails})`;
  }
  if (currentAction.toLowerCase().includes("failed") || currentAction.startsWith("❌")) {
    return currentAction;
  }
  
  return `${currentAction} (${fetchedCount}/${totalDetails} details fetched)`;
}

export function getBatchColorClass(batch: string): string {
  const b = batch.trim().toUpperCase();
  if (b.includes("BCE") || b.includes("CSE") || b.includes("SCOPE")) {
    return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
  }
  if (b.includes("SMEC") || b.includes("MECH") || b.includes("BMH")) {
    return "bg-warn-soft text-warn border-warn/20";
  }
  if (b.includes("SENSE") || b.includes("ECE")) {
    return "bg-ok-soft text-ok border-ok/20";
  }
  if (b.includes("SELECT") || b.includes("EEE")) {
    return "bg-warn-soft text-warn border-warn/20";
  }
  if (b.includes("SJT") || b.includes("VITS")) {
    return "bg-course-7/10 text-course-7 border-course-7/20";
  }
  if (b.includes("LAW") || b.includes("SSL")) {
    return "bg-danger-soft text-danger border-danger/20";
  }
  if (b.includes("SASC") || b.includes("SCIENCE")) {
    return "bg-course-1/10 text-course-1 border-course-1/20";
  }
  
  let hash = 0;
  for (let i = 0; i < b.length; i++) {
    hash = b.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "bg-accent-soft text-accent border-accent/20",
    "bg-course-3/10 text-course-3 border-course-3/20",
    "bg-course-1/10 text-course-1 border-course-1/20",
    "bg-danger-soft text-danger border-danger/20",
    "bg-course-2/10 text-course-2 border-course-2/20",
    "bg-course-6/10 text-course-6 border-course-6/20"
  ];
  return colors[Math.abs(hash) % colors.length];
}
