"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle } from "lucide-react";

type ErrorWithDigest = Error & { digest?: string };

type RuntimeInfo = {
  href: string;
  userAgent: string;
  language: string;
  platform: string;
  online: boolean;
  referrer: string;
  timestamp: string;
};

type ErrorDiagnosticCardProps = {
  title: string;
  description: string;
  error?: ErrorWithDigest;
  onRetry?: () => void;
};

export default function ErrorDiagnosticCard({
  title,
  description,
  error,
  onRetry,
}: ErrorDiagnosticCardProps) {
  const [copied, setCopied] = useState(false);
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null);

  useEffect(() => {
    setRuntimeInfo({
      href: window.location.href,
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      online: navigator.onLine,
      referrer: document.referrer || "none",
      timestamp: new Date().toISOString(),
    });
  }, []);

  const report = useMemo(() => {
    return {
      title,
      description,
      error: {
        name: error?.name ?? "UnknownError",
        message: error?.message ?? "Unknown client-side exception",
        digest: error?.digest ?? "none",
        stack: error?.stack ?? "stack unavailable",
      },
      runtime: runtimeInfo,
    };
  }, [description, error, runtimeInfo, title]);

  const copyReport = async () => {
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen w-full bg-slate-50 px-4 text-foreground transition-colors duration-300 dark:bg-[#03060F] flex items-center justify-center py-10">
      <div className="w-full max-w-2xl animate-in fade-in duration-300">
        <Card className="w-full border-slate-200 bg-white/70 backdrop-blur-md shadow-2xl dark:border-neutral-900 dark:bg-neutral-950/40 rounded-3xl overflow-hidden relative">
          {/* Subtle background gradient glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-bl-full pointer-events-none -z-10" />
          
          <CardHeader className="text-center pt-8">
            {/* Professional Alert Icon */}
            <div className="flex justify-center mb-6">
              <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-455 animate-pulse">
                <AlertCircle className="w-10 h-10 stroke-[2]" />
                <div className="absolute inset-0 rounded-full border border-rose-500/30 animate-ping duration-2000 pointer-events-none" />
              </div>
            </div>
            
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500 font-[family-name:var(--font-outfit)]">System Diagnostic</p>
            <CardTitle className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white mt-1 leading-snug">{title}</CardTitle>
            <CardDescription className="text-xs md:text-sm mt-2 text-slate-500 dark:text-gray-400 font-medium max-w-md mx-auto leading-relaxed">{description}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 px-6 md:px-8 pb-8">
            <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-4 pt-2">
              {onRetry ? (
                <Button onClick={onRetry} variant="default" className="rounded-xl font-bold text-xs py-2 min-h-[38px] cursor-pointer">
                  Try again
                </Button>
              ) : (
                <Button onClick={() => window.location.reload()} variant="default" className="rounded-xl font-bold text-xs py-2 min-h-[38px] cursor-pointer">
                  Reload page
                </Button>
              )}
              {onRetry && (
                <Button onClick={() => window.location.reload()} variant="secondary" className="rounded-xl font-bold text-xs py-2 min-h-[38px] cursor-pointer">
                  Reload page
                </Button>
              )}
              <Button asChild variant="outline" className="rounded-xl font-bold text-xs py-2 min-h-[38px] cursor-pointer">
                <Link href="/">Dashboard</Link>
              </Button>
              <Button onClick={copyReport} variant="outline" className={`rounded-xl font-bold text-xs py-2 min-h-[38px] cursor-pointer transition-all ${copied ? "text-emerald-500 border-emerald-500 bg-emerald-500/5" : ""}`}>
                {copied ? "Copied Report" : "Copy Report"}
              </Button>
            </div>

            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="w-full justify-start bg-slate-100 dark:bg-neutral-900/50 p-1 rounded-xl">
                <TabsTrigger value="summary" className="text-xs font-bold rounded-lg px-4 py-1.5">Summary</TabsTrigger>
                <TabsTrigger value="technical" className="text-xs font-bold rounded-lg px-4 py-1.5">Technical Report</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="mt-4 focus-visible:outline-none">
                <div className="grid gap-3 rounded-2xl border border-slate-200/60 dark:border-neutral-900 bg-slate-50/50 dark:bg-neutral-950/20 p-4 text-xs font-semibold text-slate-700 dark:text-gray-300 leading-relaxed">
                  <p className="flex justify-between border-b border-slate-100 dark:border-neutral-900/50 pb-2">
                    <span className="text-slate-400 dark:text-gray-500 font-bold uppercase tracking-wider text-[9px]">Error Message</span>
                    <span className="truncate max-w-[70%] font-extrabold text-slate-900 dark:text-white">{error?.message ?? "Unknown client-side exception"}</span>
                  </p>
                  <p className="flex justify-between border-b border-slate-100 dark:border-neutral-900/50 pb-2">
                    <span className="text-slate-400 dark:text-gray-500 font-bold uppercase tracking-wider text-[9px]">Digest Hash</span>
                    <span className="font-mono text-[10px] text-slate-500">{error?.digest ?? "none"}</span>
                  </p>
                  <p className="flex justify-between border-b border-slate-100 dark:border-neutral-900/50 pb-2">
                    <span className="text-slate-400 dark:text-gray-500 font-bold uppercase tracking-wider text-[9px]">Source Route</span>
                    <span className="truncate max-w-[70%] font-mono text-[10px] text-slate-500">{runtimeInfo?.href ?? "collecting..."}</span>
                  </p>
                  <p className="flex justify-between border-b border-slate-100 dark:border-neutral-900/50 pb-2">
                    <span className="text-slate-400 dark:text-gray-500 font-bold uppercase tracking-wider text-[9px]">Timestamp</span>
                    <span className="font-medium">{runtimeInfo?.timestamp ? new Date(runtimeInfo.timestamp).toLocaleString() : "collecting..."}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-slate-400 dark:text-gray-500 font-bold uppercase tracking-wider text-[9px]">Connection Status</span>
                    <span className={runtimeInfo?.online ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>
                      {runtimeInfo ? (runtimeInfo.online ? "Online" : "Offline") : "collecting..."}
                    </span>
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="technical" className="mt-4 focus-visible:outline-none">
                <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-2xl border border-slate-200 dark:border-neutral-900 bg-slate-50/50 dark:bg-neutral-950/20 p-4 text-[10px] font-mono leading-relaxed text-slate-650 dark:text-gray-400">
                  {JSON.stringify(report, null, 2)}
                </pre>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
