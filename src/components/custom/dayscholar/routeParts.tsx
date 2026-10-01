"use client";
import { Phone, Shield, UserCircle2 } from "lucide-react";
import type { ElementType, ReactNode } from "react";
import { ListRowText, SectionHeader, ToneBadge } from "../shared/primitives";
import { LIST_ROW, LIST_SHELL, TONE_ICON_TILE } from "@/lib/uiTokens";
import type { BusPlacement, BusRoute, BusStop } from "@/types/transport";

/**
 * AC and non-AC are the only two classes of bus on campus, and they are the
 * whole reason this page has a colour at all: an AC bus is the scarce, more
 * expensive seat. One map means the list row, the detail sheet and the
 * registration card cannot disagree about which is which.
 */
export const routeTone = (type?: string) => (type === "AC" ? "sky" : "emerald");

/** The `#id · name · AC · location` block, in every place a route is named. */
export function RouteIdentity({
  route,
  right,
}: {
  route: BusRoute;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span
        className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border font-black text-sm font-outfit ${TONE_ICON_TILE[routeTone(route.type)]}`}
      >
        {route.id}
      </span>
      <ListRowText
        title={route.route}
        titleTooltip={route.route}
        right={
          right ?? (
            <span className="flex items-center gap-2 shrink-0">
              <ToneBadge tone={routeTone(route.type)}>{route.type}</ToneBadge>
              {route.busLocation ? (
                <span className="text-[11px] font-medium text-text-secondary dark:text-text-muted truncate max-w-32">
                  {route.busLocation}
                </span>
              ) : null}
            </span>
          )
        }
      />
    </div>
  );
}

/**
 * The three people a stranded dayscholar calls, in one list.
 *
 * These were two hand-typed blocks — one in the route sheet, one in the
 * registration card — differing only in their container. They are the same
 * information about the same three people, so they are now one component; a
 * fourth role added to `BusRoute` shows up in both places for free.
 */
const CONTACTS: {
  key: keyof BusRoute;
  fallback: string;
  icon: ReactNode;
  tone: string;
}[] = [
  { key: "driverName", fallback: "Driver", icon: <Phone className="h-4 w-4" />, tone: "sky" },
  { key: "supervisorName", fallback: "Supervisor", icon: <Shield className="h-4 w-4" />, tone: "violet" },
  { key: "driverInchargeName", fallback: "In-charge", icon: <UserCircle2 className="h-4 w-4" />, tone: "amber" },
];

export function RouteContacts({ route }: { route: BusRoute }) {
  const people = CONTACTS.flatMap(({ key, fallback, icon, tone }) => {
    const name = route[key] as string | undefined;
    const phoneKey = key.replace("Name", "Phone") as keyof BusRoute;
    const phone = route[phoneKey] as string | undefined;
    if (!name && !phone) return [];
    return [{ name, phone, fallback, icon, tone }];
  });

  if (people.length === 0) return null;

  return (
    <div className={LIST_SHELL}>
      {people.map((p) => (
        <div key={p.fallback} className={LIST_ROW}>
          <span
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${TONE_ICON_TILE[p.tone]}`}
          >
            {p.icon}
          </span>
          <ListRowText title={p.name || p.fallback} subtitle={p.fallback} />
          {p.phone ? (
            <a
              href={`tel:${p.phone}`}
              aria-label={`Call ${p.name || p.fallback}`}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black transition-colors ${TONE_ICON_TILE[p.tone]}`}
            >
              <Phone className="h-3 w-3" />
              Call
            </a>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/**
 * Stops in pickup order, with the time at each.
 *
 * The spine is drawn with a border on the dot column rather than an absolutely
 * positioned connector, so the last stop needs no special case and a stop with
 * no time still lines up.
 */
export function StopsTimeline({
  stops,
  limit,
}: {
  stops: BusStop[];
  /** The sheet is height-constrained; the registration card shows all of them. */
  limit?: number;
}) {
  const ordered = [...stops].sort((a, b) => a.stopOrder - b.stopOrder);
  const shown = limit ? ordered.slice(0, limit) : ordered;
  if (shown.length === 0) return null;

  return (
    <div className={LIST_SHELL}>
      {shown.map((stop, i) => {
        const isFirst = i === 0;
        const isLast = i === shown.length - 1 && !limit;
        return (
          <div key={`${stop.stopOrder}-${stop.stopName}`} className="flex items-start gap-3 py-2.5 px-4">
            <span className="shrink-0 w-11 text-right text-[10px] font-black font-outfit text-text-heading pt-0.5">
              {stop.pickupTime || "—"}
            </span>
            <span className="flex flex-col items-center shrink-0 self-stretch">
              <span
                className={`mt-1 w-2 h-2 rounded-full shrink-0 ${isFirst ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"}`}
              />
              {!isLast && <span className="w-px flex-1 my-0.5 bg-border-muted" />}
            </span>
            <span className="text-xs font-semibold text-text-heading leading-5 min-w-0 flex-1">
              {stop.stopName}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Placement zones with their dispersal times — the dayscholar's actual question. */
export function PlacementZones({ placements }: { placements: BusPlacement[] }) {
  if (!placements.length) return null;

  return (
    <div className={LIST_SHELL}>
      {placements.map((p, i) => (
        <div key={`${p.zone}-${i}`} className={LIST_ROW}>
          <span className="shrink-0 w-16 text-center">
            <span className="block text-base font-black font-outfit text-text-heading leading-none">
              {p.dispersalTime}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">
              dispersal
            </span>
          </span>
          <ListRowText title={p.zone} subtitle="Placement zone" />
        </div>
      ))}
    </div>
  );
}

/** Section heading + list, the shape every grouped list on the page uses. */
export function RouteSection({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: ElementType;
  count?: number;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <SectionHeader icon={icon} title={title} count={count} />
      {children}
    </div>
  );
}
