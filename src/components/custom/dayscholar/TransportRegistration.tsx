"use client";
import { useState } from "react";
import { API_BASE } from "../Main";
import { Bus, MapPin, CreditCard, QrCode, ExternalLink, User, GraduationCap, BookOpen, CheckCircle2, XCircle, Navigation, Loader2 } from "lucide-react";
import { LoadingSpinner } from "../shared";

interface TransportData {
  hasRegistration: boolean;
  registerNumber?: string;
  name?: string;
  programme?: string;
  branch?: string;
  routeSelected?: string;
  fpReference?: string;
  paymentStatus?: string;
  busRouteId?: string;
  qrCode?: string;
  pageCsrf?: string;
}

interface TransportRegistrationProps {
  data: TransportData | null;
  loading: boolean;
  loginToVTOP: () => Promise<{ cookies: string[]; authorizedID: string; csrf: string }>;
}

const CardShell = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`glass-card mb-5 ${className}`}>
    {children}
  </div>
);

const Field = ({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) => (
  <div className="flex items-start gap-3">
    {icon && <div className="mt-0.5 text-gray-400 dark:text-gray-500 midnight:text-gray-500 shrink-0">{icon}</div>}
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 midnight:text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 midnight:text-gray-200 break-words">{value || "—"}</p>
    </div>
  </div>
);

export default function TransportRegistration({ data, loading, loginToVTOP }: TransportRegistrationProps) {
  const [tracking, setTracking] = useState(false);

  const handleTrackBus = async () => {
    if (!data?.busRouteId) return;
    setTracking(true);
    try {
      const { cookies, authorizedID, csrf } = await loginToVTOP();
      const res = await fetch(`${API_BASE}/api/transport/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies, authorizedID, csrf, busRouteId: data.busRouteId }),
      });
      const result = await res.json();
      if (result.busUrl) {
        window.open(result.busUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      console.error("Track bus error:", err);
    } finally {
      setTracking(false);
    }
  };

  if (loading) {
    return (
      <CardShell>
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <LoadingSpinner size="lg" label="Loading transport details..." />
        </div>
      </CardShell>
    );
  }

  if (!data) {
    return null;
  }

  if (!data.hasRegistration) {
    return (
      <CardShell>
        <div className="flex flex-col items-center justify-center py-12 px-6">
          <div className="p-4 rounded-full bg-amber-50 dark:bg-amber-900/20 midnight:bg-amber-900/20 text-amber-500 mb-4">
            <Bus className="w-8 h-8" />
          </div>
          <p className="text-base font-semibold text-gray-800 dark:text-gray-200 midnight:text-gray-200 mb-1">No Bus Registration</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 midnight:text-gray-400 text-center max-w-sm">
            You are not currently registered for any bus route. Contact the transport office or register via VTOP.
          </p>
        </div>
      </CardShell>
    );
  }

  return (
    <div className="w-full">
      <CardShell>
        <div className="p-5">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 midnight:bg-blue-900/20 text-blue-600 dark:text-blue-400 midnight:text-blue-400">
              <Bus className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100">Transport Registration</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 midnight:text-gray-400">VTOP Transport Payment Details</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white/40 dark:bg-black/30 midnight:bg-white/5 rounded-2xl p-5 border border-white/50 dark:border-white/5 midnight:border-white/10">
              <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 midnight:text-gray-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                <User className="w-4 h-4" /> Student Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Register Number" value={data.registerNumber || ""} icon={<User className="w-4 h-4" />} />
                <Field label="Name" value={data.name || ""} />
                <Field label="Programme" value={data.programme || ""} icon={<GraduationCap className="w-4 h-4" />} />
                <Field label="Branch" value={data.branch || ""} icon={<BookOpen className="w-4 h-4" />} />
              </div>
            </div>

            <div className="bg-white/40 dark:bg-black/30 midnight:bg-white/5 rounded-2xl p-5 border border-white/50 dark:border-white/5 midnight:border-white/10">
              <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 midnight:text-gray-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Route & Payment
              </h3>
              <div className="space-y-4">
                <Field label="Route Selected" value={data.routeSelected || ""} icon={<MapPin className="w-4 h-4" />} />
                <Field label="FP Reference Number" value={data.fpReference || ""} icon={<CreditCard className="w-4 h-4" />} />
                <div className="flex items-center gap-3">
                  <CreditCard className="w-4 h-4 text-gray-400 dark:text-gray-500 midnight:text-gray-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 midnight:text-gray-500 uppercase tracking-wider">Payment Status</p>
                    <span className={`inline-flex items-center gap-1.5 mt-1 px-3 py-1 text-xs font-bold rounded-full ${
                      data.paymentStatus?.toLowerCase() === "paid"
                        ? "bg-green-50 dark:bg-green-900/20 midnight:bg-green-900/20 text-green-700 dark:text-green-400 midnight:text-green-400"
                        : "bg-red-50 dark:bg-red-900/20 midnight:bg-red-900/20 text-red-700 dark:text-red-400 midnight:text-red-400"
                    }`}>
                      {data.paymentStatus?.toLowerCase() === "paid" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {data.paymentStatus || "Unknown"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              {data.busRouteId && (
                <button
                  onClick={handleTrackBus}
                  disabled={tracking}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-bold rounded-xl transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                >
                  {tracking ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Navigation className="w-4 h-4" />
                  )}
                  {tracking ? "Tracking..." : "Track My Bus"}
                </button>
              )}

              <a
                href="https://vtopcc.vit.ac.in/vtop/transport/transportRegistration"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-white/60 dark:bg-slate-800/60 midnight:bg-white/10 border border-gray-200 dark:border-gray-700 midnight:border-white/20 text-gray-700 dark:text-gray-300 midnight:text-gray-300 text-sm font-bold rounded-xl hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all shadow-sm"
              >
                <ExternalLink className="w-4 h-4" />
                Open in VTOP
              </a>
            </div>
          </div>
        </div>
      </CardShell>

      {data.qrCode && (
        <CardShell>
          <div className="p-5">
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 midnight:text-gray-300 uppercase tracking-widest mb-4 flex items-center gap-2">
              <QrCode className="w-4 h-4" /> Daily Attendance QR
            </h3>
            <div className="flex justify-center">
              <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 midnight:border-white/10">
                <img
                  src={data.qrCode}
                  alt="Daily Attendance QR Code"
                  className="w-40 h-40 object-contain"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 midnight:text-gray-500 text-center mt-3">
              Scan this QR code on the bus for daily attendance
            </p>
          </div>
        </CardShell>
      )}
    </div>
  );
}
