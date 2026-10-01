"use client";
import { useState } from "react";
import { api } from "@/lib/sync-engine";
import {
  Bus,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  QrCode,
  XCircle,
} from "lucide-react";
import { RouteContacts, RouteSection, StopsTimeline, routeTone } from "./routeParts";
import {
  EmptyPanel,
  KeyValue,
  ListRowText,
  ListSkeleton,
  ToneBadge,
} from "../shared/primitives";
import { TILE_CARD, TONE_ICON_TILE } from "@/lib/uiTokens";
import type { BusRoute, TransportData } from "@/types/transport";

interface TransportRegistrationProps {
  data: TransportData | null;
  loading: boolean;
  loginToVTOP: () => Promise<{ cookies: string[]; authorizedID: string; csrf: string }>;
  buses?: BusRoute[];
}

/**
 * "Which bus is mine", and how to ride it.
 *
 * This used to be a `solid-card` with its own hand-rolled payment pill and two
 * near-identical blocks copied from the route sheet. Payment is a status, so it
 * is a `ToneBadge` now; the contacts come from the shared `RouteContacts`; and
 * the three states (loading, not registered, registered) are `ListSkeleton` and
 * `EmptyPanel` rather than bespoke cards, so a student with no registration sees
 * the same empty treatment as everywhere else instead of a lone amber blob.
 */
export default function TransportRegistration({
  data,
  loading,
  loginToVTOP,
  buses,
}: TransportRegistrationProps) {
  const [tracking, setTracking] = useState(false);

  const handleTrackBus = async () => {
    if (!data?.busRouteId) return;
    setTracking(true);
    try {
      const { cookies, authorizedID, csrf } = await loginToVTOP();
      const result = (await api("transport/track", {
        method: "POST",
        body: { cookies, authorizedID, csrf, busRouteId: data.busRouteId },
      })) as any;
      if (result.busUrl) {
        window.open(result.busUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      console.error("Track bus error:", err);
    } finally {
      setTracking(false);
    }
  };

  if (loading) return <ListSkeleton rows={3} leading="dot" trailing />;
  if (!data) return null;

  if (!data.hasRegistration) {
    return (
      <EmptyPanel
        icon={<Bus className="h-7 w-7" />}
        tone="amber"
        title="No bus registration"
        description="You are not currently registered for any bus route. Register through VTOP, or contact the transport office if you think this is wrong."
      />
    );
  }

  const registeredRoute =
    buses && data.hasRegistration
      ? buses.find((b) => b.id === data.busRouteId || b.route === data.routeSelected)
      : undefined;

  const paid = data.paymentStatus?.toLowerCase() === "paid";

  return (
    <div className="space-y-6">
      <div className={TILE_CARD}>
        <div className="flex items-start justify-between gap-3">
          <ListRowText
            title={data.name || data.registerNumber || "Transport Registration"}
            titleTooltip={data.name || data.registerNumber}
            titleTag="h3"
            subtitle={[data.registerNumber, data.programme, data.branch]
              .filter(Boolean)
              .join(" · ")}
          />
          <ToneBadge
            tone={paid ? "emerald" : "red"}
            icon={
              paid ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )
            }
          >
            {data.paymentStatus || "Unknown"}
          </ToneBadge>
        </div>

        {/* The route the student is on. Falls back to the bare name from VTOP
            when the published list has no matching entry, rather than hiding
            the fact that we could not resolve it. */}
        {registeredRoute ? (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border-muted bg-surface-secondary dark:bg-background/50 p-3">
            <span
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border font-black text-sm font-outfit ${TONE_ICON_TILE[routeTone(registeredRoute.type)]}`}
            >
              {registeredRoute.id}
            </span>
            <ListRowText
              title={registeredRoute.route}
              subtitle={`${registeredRoute.type} bus${registeredRoute.busLocation ? ` · ${registeredRoute.busLocation}` : ""}`}
            />
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border-muted bg-surface-secondary dark:bg-background/50 p-3">
            <span
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border font-black text-sm font-outfit ${TONE_ICON_TILE.zinc}`}
            >
              ?
            </span>
            <ListRowText
              title={data.routeSelected || "Unknown route"}
              subtitle="Not in the published route list yet"
            />
          </div>
        )}

        {(data.fpReference || data.routeSelected) && (
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {data.fpReference && (
              <KeyValue label="Payment ref" value={data.fpReference} />
            )}
            {data.routeSelected && (
              <KeyValue label="Route" value={data.routeSelected} />
            )}
          </div>
        )}

        <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
          {data.busRouteId && (
            <button
              type="button"
              onClick={handleTrackBus}
              disabled={tracking}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-indigo-700 disabled:opacity-70 active:scale-[0.98]"
            >
              {tracking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Navigation className="h-4 w-4" />
              )}
              {tracking ? "Opening tracker…" : "Track my bus"}
            </button>
          )}
          <a
            href="https://vtopcc.vit.ac.in/vtop/transport/transportRegistration"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-border-strong bg-surface px-4 py-3 text-sm font-black text-text-heading transition-colors hover:bg-surface-secondary dark:hover:bg-surface-hover"
          >
            <ExternalLink className="h-4 w-4" />
            Open in VTOP
          </a>
        </div>
      </div>

      {registeredRoute && <RegisteredRoute route={registeredRoute} />}

      {data.qrCode && (
        <div className={TILE_CARD}>
          <div className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-black text-text-heading font-outfit tracking-tight">
              Daily attendance QR
            </h3>
          </div>
          <div className="mt-3 flex justify-center">
            <div className="rounded-2xl bg-white p-3 border border-border-muted">
              <img
                src={data.qrCode}
                alt="Daily attendance QR code"
                className="w-36 h-36 object-contain"
              />
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] font-medium text-text-muted">
            Scan this on the bus to mark your attendance.
          </p>
        </div>
      )}
    </div>
  );
}

/** The registered route's own contacts and stop list, under the registration. */
function RegisteredRoute({ route }: { route: BusRoute }) {
  const stops = route.stops || [];
  if (!route.driverPhone && !route.supervisorPhone && !route.driverInchargePhone && stops.length === 0) {
    return null;
  }

  return (
    <RouteSection title="Your route" icon={MapPin}>
      <div className="space-y-4">
        <RouteContacts route={route} />
        {stops.length > 0 && <StopsTimeline stops={stops} />}
      </div>
    </RouteSection>
  );
}
