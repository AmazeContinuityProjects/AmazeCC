"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/sync-engine";
import { Car, Clock, Clock3, MapPin, Users } from "lucide-react";
import { getLocalTrips } from "./cabShareFallback";
import { ListRowText } from "../../shared/primitives";
import { TILE } from "@/lib/uiTokens";

/**
 * The three ride states a student can be in, as one tone entry each.
 *
 * Colour is the only thing that separates them at a glance, so it lives in one
 * map rather than being retyped per card: amber is waiting on someone else,
 * violet is waiting on you, blue is settled.
 */
const MATCH_TONE = {
  pendingOutbound: "amber",
  pendingInbound: "violet",
  accepted: "blue",
} as const;

const MATCH_SURFACE = {
  amber: "border-amber-500/20 bg-amber-500/10",
  violet: "border-violet-500/20 bg-violet-500/10",
  blue: "border-blue-500/20 bg-blue-500/10",
} as const;

const MATCH_INK = {
  amber: "text-amber-700 dark:text-amber-400",
  violet: "text-violet-700 dark:text-violet-400",
  blue: "text-blue-700 dark:text-blue-400",
} as const;

const MATCH_WELL = {
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
} as const;

type MatchKind = keyof typeof MATCH_TONE;

const MATCH_COPY: Record<MatchKind, { title: string; icon: typeof Car }> = {
  pendingOutbound: { title: "Approval Pending", icon: Clock3 },
  pendingInbound: { title: "Pending Requests", icon: Users },
  accepted: { title: "Upcoming Ride Match", icon: Car },
};

export default function CabShareMatchCard() {
  const [acceptedMatch, setAcceptedMatch] = useState<any>(null);
  const [pendingJoins, setPendingJoins] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  const loadFromLocal = (user: any) => {
    const localTrips = getLocalTrips();
    const myName = user.name || user.reg_number;
    // My pending requests: trips I did NOT post that have a pending request from me
    const myLocalReqs: any[] = [];
    localTrips.forEach((trip: any) => {
      if (trip.reg_number === user.reg_number || trip.reg_number === user.username) return;
      (trip.requests || []).forEach((req: any) => {
        if (req.name === myName && req.status === 'pending') {
          myLocalReqs.push({
            trip_id: trip.trip_id,
            hub_name: trip.hub_name,
            preferred_time: trip.preferred_time,
            owner_name: trip.name,
            match_status: 'pending',
          });
        }
      });
    });
    setPendingJoins(myLocalReqs);

    // Incoming local requests: trips I posted that have pending requests from others
    const myLocalIncoming: any[] = [];
    localTrips.forEach((trip: any) => {
      if (trip.reg_number === user.reg_number || trip.reg_number === user.username) {
        (trip.requests || []).forEach((req: any) => {
          if (req.status === 'pending') {
            myLocalIncoming.push({ ...req, trip });
          }
        });
      }
    });
    setPendingRequests(myLocalIncoming);
  };

  useEffect(() => {
    const userStr = localStorage.getItem("cabshare_user");
    if (!userStr) return;

    try {
      const user = JSON.parse(userStr);
      if (!user || !user.reg_number) return;

      api(`cabshare/trips/me?reg_number=${user.reg_number}`, { parse: "raw" })
        .then((res) => (res as Response).json())
        .then(data => {
          if (data.success) {
            // Accepted match (confirmed ride)
            const acceptedJoin = data.joined_trips?.find((t: any) => t.match_status === 'accepted');
            if (acceptedJoin) {
              setAcceptedMatch({ ...acceptedJoin, role: 'passenger' });
            } else {
              const activePost = data.my_trips?.find((t: any) => t.status === 'active' && t.requests && t.requests.some((r:any)=>r.status==='accepted'));
              if (activePost) {
                setAcceptedMatch({ ...activePost, role: 'host' });
              }
            }

            // Pending join requests (I requested to join, waiting for host)
            const pendingReqs = (data.joined_trips || []).filter((t: any) => t.match_status === 'pending');
            setPendingJoins(pendingReqs);

            // Pending incoming requests (someone wants to join my ride)
            const incomingReqs: any[] = [];
            (data.my_trips || []).forEach((trip: any) => {
              (trip.requests || []).forEach((req: any) => {
                if (req.status === 'pending') {
                  incomingReqs.push({ ...req, trip });
                }
              });
            });
            setPendingRequests(incomingReqs);
          }
        })
        .catch(() => loadFromLocal(user));

      // Also try local fallback regardless (covers local_only users)
      if (user.local_only) {
        loadFromLocal(user);
      }
    } catch(e) {}
  }, []);

  if (!acceptedMatch && pendingJoins.length === 0 && pendingRequests.length === 0) return null;

  /**
   * One state card. The old version painted a solid 600-weight block, which
   * broke the app's one-surface-per-card rule and read as an alert rather than
   * as information; a tinted `TILE` keeps the card language and still leads with
   * the tone.
   */
  const MatchCard = ({
    kind,
    sub,
    children,
  }: {
    kind: MatchKind;
    sub: React.ReactNode;
    children: React.ReactNode;
  }) => {
    const { title, icon: Icon } = MATCH_COPY[kind];
    const tone = MATCH_TONE[kind];
    return (
      <div className={`${TILE} ${MATCH_SURFACE[tone]} gap-3 p-4`}>
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${MATCH_WELL[tone]}`}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className={`text-sm font-black font-outfit tracking-tight ${MATCH_INK[tone]}`}>{title}</h3>
            <p className="text-[11px] font-medium text-text-secondary dark:text-text-muted mt-0.5">{sub}</p>
          </div>
        </div>
        {children}
      </div>
    );
  };

  const MetaRow = ({
    left,
    right,
  }: {
    left: React.ReactNode;
    right?: React.ReactNode;
  }) => (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface/70 border border-border-muted px-3 py-2.5">
      {left}
      {right}
    </div>
  );

  const PlaceLine = ({ hub, time }: { hub?: React.ReactNode; time?: React.ReactNode }) => (
    <>
      <p className="flex items-center gap-1 text-xs font-bold text-text-heading">{hub}</p>
      {time ? (
        <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-text-secondary dark:text-text-muted">
          {time}
        </p>
      ) : null}
    </>
  );

  return (
    <div className="space-y-3">
      {/* Pending - My requests waiting for host approval */}
      {pendingJoins.map(trip => (
        <MatchCard
          key={trip.trip_id}
          kind="pendingOutbound"
          sub="Your ride request is waiting for the host to respond."
        >
          <MetaRow
            left={
              <PlaceLine
                hub={<><MapPin className="h-3.5 w-3.5" /> {trip.hub_name}</>}
                time={<><Clock className="h-3.5 w-3.5" /> {trip.preferred_time}</>}
              />
            }
            right={
              <div className="text-right">
                <p className="text-[11px] font-medium text-text-muted">Host</p>
                <p className="text-xs font-black text-text-heading">{trip.owner_name}</p>
              </div>
            }
          />
        </MatchCard>
      ))}

      {/* Pending - Incoming requests (host side) */}
      {pendingRequests.length > 0 && (
        <MatchCard
          kind="pendingInbound"
          sub={`${pendingRequests.length} student${pendingRequests.length > 1 ? 's' : ''} want${pendingRequests.length === 1 ? 's' : ''} to join your ride${pendingRequests.length > 1 ? 's' : ''}.`}
        >
          <div className="space-y-2">
            {pendingRequests.map((req, i) => (
              <MetaRow
                key={req.match_id || i}
                left={
                  <ListRowText
                    title={req.name}
                    subtitle={req.trip?.hub_name ? <><MapPin className="h-3 w-3" /> {req.trip.hub_name}</> : undefined}
                  />
                }
                right={
                  <span className="shrink-0 text-[11px] font-bold text-text-secondary dark:text-text-muted">
                    <Clock className="h-3 w-3" /> {req.trip?.preferred_time}
                  </span>
                }
              />
            ))}
          </div>
        </MatchCard>
      )}

      {/* Accepted match (confirmed ride) */}
      {acceptedMatch && (
        <MatchCard
          kind="accepted"
          sub={`You have a confirmed ${acceptedMatch.role === 'host' ? 'passenger' : 'ride'}!`}
        >
          <MetaRow
            left={
              <PlaceLine
                hub={<><MapPin className="h-3.5 w-3.5" /> {acceptedMatch.hub_name}</>}
                time={<><Clock className="h-3.5 w-3.5" /> {acceptedMatch.preferred_time}</>}
              />
            }
            right={
              <div className="text-right">
                <p className="text-[11px] font-medium text-text-muted">Contact</p>
                <p className="text-xs font-black text-text-heading">
                  {acceptedMatch.role === 'host' ? acceptedMatch.requests.find((r:any)=>r.status==='accepted')?.phone_number : acceptedMatch.owner_phone}
                </p>
              </div>
            }
          />
        </MatchCard>
      )}
    </div>
  );
}
