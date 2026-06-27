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
    return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  }
  if (b.includes("SENSE") || b.includes("ECE")) {
    return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  }
  if (b.includes("SELECT") || b.includes("EEE")) {
    return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
  }
  if (b.includes("SJT") || b.includes("VITS")) {
    return "bg-pink-500/10 text-pink-400 border-pink-500/20";
  }
  if (b.includes("LAW") || b.includes("SSL")) {
    return "bg-red-500/10 text-red-400 border-red-500/20";
  }
  if (b.includes("SASC") || b.includes("SCIENCE")) {
    return "bg-teal-500/10 text-teal-400 border-teal-500/20";
  }
  
  let hash = 0;
  for (let i = 0; i < b.length; i++) {
    hash = b.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "bg-blue-500/10 text-blue-400 border-blue-500/20",
    "bg-purple-500/10 text-purple-400 border-purple-500/20",
    "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    "bg-rose-500/10 text-rose-400 border-rose-500/20",
    "bg-orange-500/10 text-orange-400 border-orange-500/20",
    "bg-lime-500/10 text-lime-400 border-lime-500/20"
  ];
  return colors[Math.abs(hash) % colors.length];
}
