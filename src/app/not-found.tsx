"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HelpCircle } from "lucide-react";

export default function NotFoundPage() {
  const pathname = usePathname();

  return (
    <main className="min-h-screen w-full bg-slate-50 px-4 text-foreground transition-colors duration-300 dark:bg-[#03060F] flex items-center justify-center py-10">
      <div className="w-full max-w-xl animate-in fade-in duration-300">
        <Card className="w-full border-slate-200 bg-white/70 backdrop-blur-md shadow-2xl dark:border-neutral-900 dark:bg-neutral-950/40 rounded-3xl overflow-hidden relative text-center">
          {/* Subtle background gradient glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-full pointer-events-none -z-10" />

          <CardHeader className="pt-8">
            {/* Professional Search/404 Icon */}
            <div className="flex justify-center mb-6">
              <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-650 dark:text-indigo-400">
                <HelpCircle className="w-10 h-10 stroke-[2]" />
                <div className="absolute inset-0 rounded-full border border-indigo-500/35 animate-pulse duration-2000 pointer-events-none" />
              </div>
            </div>

            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500 font-[family-name:var(--font-outfit)]">Routing Error</p>
            <CardTitle className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white mt-1">Page not found</CardTitle>
            <CardDescription className="text-xs md:text-sm mt-2 text-slate-500 dark:text-gray-400 font-medium max-w-sm mx-auto leading-relaxed">
              The requested resource does not exist, has been moved, or may be temporary unavailable.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 px-6 md:px-8 pb-8">
            <div className="rounded-2xl border border-slate-205 dark:border-neutral-900 bg-slate-50/50 dark:bg-neutral-950/20 p-4 text-xs font-semibold text-slate-700 dark:text-gray-300 leading-relaxed text-left flex justify-between items-center">
              <span className="text-slate-455 dark:text-gray-550 font-bold uppercase tracking-wider text-[9px]">Requested path</span>
              <span className="font-mono text-slate-500 dark:text-gray-400 truncate max-w-[65%]">{pathname || "unknown"}</span>
            </div>

            <div className="flex justify-center gap-3">
              <Button asChild className="rounded-xl font-bold text-xs py-2 min-h-[38px] px-6 cursor-pointer">
                <Link href="/">Dashboard</Link>
              </Button>
              <Button variant="outline" onClick={() => window.history.back()} className="rounded-xl font-bold text-xs py-2 min-h-[38px] px-6 cursor-pointer">
                Go back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
