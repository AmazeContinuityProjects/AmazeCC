"use client";
import { useState } from "react";
import { API_BASE } from "../Main";
import { Bus, MapPin, CreditCard, QrCode, ExternalLink, CheckCircle2, XCircle, Navigation, Loader2, Phone, Shield, Clock, ChevronRight } from "lucide-react";
import { LoadingSpinner } from "../shared";

import type { BusRoute, TransportData } from '@/types/transport';

interface TransportRegistrationProps {
  data: TransportData | null;
  loading: boolean;
  loginToVTOP: () => Promise<{ cookies: string[]; authorizedID: string; csrf: string }>;
  buses?: BusRoute[];
}

const CardShell = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`solid-card mb-5 ${className}`}>
    {children}
  </div>
);

export default function TransportRegistration({ data, loading, loginToVTOP, buses }: TransportRegistrationProps) {
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

  const registeredRoute = data?.hasRegistration && buses
    ? buses.find(b => b.id === data.busRouteId || b.route === data.routeSelected)
    : undefined;

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
          <div className="p-4 rounded-full bg-amber-50  dark:bg-amber-900/20 text-amber-500 mb-4">
            <Bus className="w-8 h-8" />
          </div>
          <p className="text-base font-semibold text-gray-800  dark:text-gray-200 mb-1">No Bus Registration</p>
          <p className="text-sm text-gray-500  dark:text-gray-400 text-center max-w-sm">
            You are not currently registered for any bus route. Contact the transport office or register via VTOP.
          </p>
        </div>
      </CardShell>
    );
  }

  return (
    <div className="w-full">
      <CardShell>
        <div className="p-5 space-y-5">

          {/* Header — Student Identity + Route Badge */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-gray-900  dark:text-gray-100 truncate">
                {data.name || data.registerNumber || 'Transport Registration'}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                {data.registerNumber && (
                  <span className="text-xs text-gray-500  dark:text-gray-400">{data.registerNumber}</span>
                )}
                {data.programme && (
                  <span className="text-xs text-gray-500  dark:text-gray-400">{data.programme}</span>
                )}
                {data.branch && (
                  <span className="text-xs text-gray-500  dark:text-gray-400">{data.branch}</span>
                )}
              </div>
            </div>
            <div className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${
              data.paymentStatus?.toLowerCase() === "paid"
                ? "bg-green-50  dark:bg-green-900/20 text-green-700  dark:text-green-400"
                : "bg-red-50  dark:bg-red-900/20 text-red-700  dark:text-red-400"
            }`}>
              {data.paymentStatus?.toLowerCase() === "paid" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              {data.paymentStatus || "Unknown"}
            </div>
          </div>

          {/* Route Card */}
          {registeredRoute ? (
            <RegisteredRouteCard route={registeredRoute} />
          ) : (
            <div className="bg-white/40  dark:bg-white/5 rounded-2xl p-4 border border-white/50 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-400 font-black text-sm leading-none">
                  ?
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900  dark:text-white">{data.routeSelected || 'Unknown Route'}</p>
                  <p className="text-[11px] text-gray-500  dark:text-gray-400">Route details unavailable</p>
                </div>
              </div>
            </div>
          )}

          {/* Payment Info */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            {data.fpReference && (
              <span className="flex items-center gap-1.5 text-gray-500  dark:text-gray-400">
                <CreditCard size={12} />
                Ref: {data.fpReference}
              </span>
            )}
            {data.routeSelected && (
              <span className="flex items-center gap-1.5 text-gray-500  dark:text-gray-400">
                <MapPin size={12} />
                {data.routeSelected}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
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
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-white/60  dark:bg-white/10 border border-gray-200  dark:border-white/20 text-gray-700  dark:text-gray-300 text-sm font-bold rounded-xl hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all shadow-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Open in VTOP
            </a>
          </div>

          {/* QR Code */}
          {data.qrCode && (
            <div className="bg-white/40  dark:bg-white/5 rounded-2xl p-4 border border-white/50 dark:border-white/10">
              <h3 className="text-[11px] font-bold text-gray-500  dark:text-gray-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                <QrCode className="w-3.5 h-3.5" /> Daily Attendance QR
              </h3>
              <div className="flex justify-center">
                <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100  dark:border-white/10">
                  <img
                    src={data.qrCode}
                    alt="Daily Attendance QR Code"
                    className="w-32 h-32 object-contain"
                  />
                </div>
              </div>
              <p className="text-[11px] text-gray-400  dark:text-gray-500 text-center mt-2">
                Scan this QR code on the bus for daily attendance
              </p>
            </div>
          )}
        </div>
      </CardShell>
    </div>
  );
}

function RegisteredRouteCard({ route }: { route: BusRoute }) {
  const stops = (route.stops || []).sort((a, b) => a.stopOrder - b.stopOrder);

  return (
    <div className="bg-white/40  dark:bg-white/5 rounded-2xl border border-white/50 dark:border-white/10 overflow-hidden">
      {/* Route header */}
      <div className="flex items-center gap-3 p-4 border-b border-white/50 dark:border-white/10">
        <div className={`p-2 rounded-xl bg-white/50 dark:bg-white/5 shadow-sm border border-white/20 dark:border-white/10 font-black text-sm leading-none ${
          route.type === 'AC'
            ? 'bg-blue-500/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border-blue-500/20'
            : 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/20'
        }`}>
          #{route.id}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900  dark:text-white truncate">{route.route}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] uppercase tracking-widest font-bold ${
              route.type === 'AC' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {route.type} Bus
            </span>
            {route.busLocation && (
              <>
                <span className="text-[10px] text-gray-300 dark:text-gray-600">|</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">{route.busLocation}</span>
              </>
            )}
          </div>
        </div>
        <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 shrink-0" />
      </div>

      <div className="p-4 space-y-3">
        {/* Contacts */}
        <div className="space-y-2">
          {(route.driverName || route.driverPhone) && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/60 dark:bg-white/5 border border-white/50 dark:border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shrink-0">
                  <Phone size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Driver</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{route.driverName || 'Driver'}</p>
                </div>
              </div>
              {route.driverPhone && (
                <a href={`tel:${route.driverPhone}`} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-xs font-bold shrink-0">
                  <Phone size={12} /> Call
                </a>
              )}
            </div>
          )}

          {(route.supervisorName || route.supervisorPhone) && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/60 dark:bg-white/5 border border-white/50 dark:border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 shrink-0">
                  <Shield size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Supervisor</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{route.supervisorName || 'Supervisor'}</p>
                </div>
              </div>
              {route.supervisorPhone && (
                <a href={`tel:${route.supervisorPhone}`} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors text-xs font-bold shrink-0">
                  <Phone size={12} /> Call
                </a>
              )}
            </div>
          )}

          {(route.driverInchargeName || route.driverInchargePhone) && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/60 dark:bg-white/5 border border-white/50 dark:border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 shrink-0">
                  <Phone size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Driver Incharge</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{route.driverInchargeName || 'Incharge'}</p>
                </div>
              </div>
              {route.driverInchargePhone && (
                <a href={`tel:${route.driverInchargePhone}`} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors text-xs font-bold shrink-0">
                  <Phone size={12} /> Call
                </a>
              )}
            </div>
          )}
        </div>

        {/* Stops — Timeline */}
        {stops.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-gray-500  dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1">
              <Clock size={11} /> Stops
            </p>
            <div className="relative">
              {stops.map((s, i) => (
                <div key={i} className="flex items-start gap-3 pb-0.5 last:pb-0">
                  <div className="shrink-0 w-12 text-right">
                    {s.pickupTime && (
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 leading-3">{s.pickupTime}</span>
                    )}
                  </div>
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`w-2 h-2 rounded-full mt-[3px] ${i === 0 ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                    {i !== stops.length - 1 && <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />}
                  </div>
                  <div className="pb-3 last:pb-0 min-w-0 flex-1">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-5">{s.stopName}</span>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
