import { useState, useEffect } from "react";
import { Skeleton } from "@amazecontinuityprojects/amazeui";
import { syncEngine } from "@/lib/sync-engine";
import { GraduationCap, ClipboardCheck, Landmark, Building, Trophy, IdCard, ChevronRight } from "lucide-react";

export default function ProfileStatusCards({
  creds,
  refreshKey,
  onCardClick,
}: {
  creds: any;
  refreshKey: number;
  onCardClick: (id: string) => void;
}) {
  const [whoami, setWhoami] = useState<any>(null);
  const [reg, setReg] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!creds) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        let w: any = null;
        if (refreshKey === 0) {
          try {
            const cached = localStorage.getItem("cache_whoami") || localStorage.getItem("uni_cc_generic_whoami:{}");
            if (cached) w = JSON.parse(cached);
          } catch {}
        }
        if (!w || refreshKey > 0) {
          try {
            w = await syncEngine.sync("whoami");
          } catch {
            w = null;
          }
          if (w && !w.error) {
            try {
              localStorage.setItem("cache_whoami", JSON.stringify(w));
            } catch {}
          }
        }
        if (cancelled) return;
        setWhoami(w);

        // registration schedule comes from unified FFCS op (single ffcs all call + adapters/distribution).
        // Mount reads the cache only — /api/ffcs costs a VTOP round trip, so it must never fire just
        // because the profile page mounted. An explicit refresh (refreshKey > 0) always fetches fresh.
        const readCachedReg = () => {
          try {
            const cachedReg =
              localStorage.getItem("cache_registration_schedule") ||
              localStorage.getItem("cache_registration-schedule");
            return cachedReg ? JSON.parse(cachedReg) : null;
          } catch {
            return null;
          }
        };
        let regRes: any = refreshKey === 0 ? readCachedReg() : null;
        if (refreshKey > 0) {
          try {
            const ffcsRes: any = await syncEngine.sync("ffcs", {});
            regRes = ffcsRes?.registrationSchedule || ffcsRes;
          } catch {
            regRes = readCachedReg();
          }
        }
        if (!cancelled) setReg(regRes);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, creds]);

  const ept = whoami?.eptSchedule ?? null;
  const day = whoami?.dayboarder ?? null;
  const rank = whoami?.ranks?.[0]?.rank != null ? String(whoami.ranks[0].rank) : null;
  const apaar = whoami?.apaar ?? null;
  const bank = whoami?.bank ?? null;

  const hasEpt = ept?.tables?.length > 0 && ept.tables.some((t: any) => t.rows?.length > 0);
  const hasReg = reg?.tables?.length > 0 && reg.tables.some((t: any) => t.rows?.length > 0);
  const hasBank = !!(
    bank?.name ||
    bank?.branch ||
    bank?.address ||
    (Array.isArray(bank?.fields) && bank.fields.some((f: any) => f?.value && String(f.value).trim().length > 0))
  );
  const hasDay = !!(
    day?.fields && Object.values(day.fields).some((f: any) => f?.value && String(f.value).trim().length > 0)
  );
  const hasApaar =
    apaar?.hasApaar === true ||
    (Array.isArray(apaar?.fields) && apaar.fields.length > 0) ||
    (Array.isArray(apaar?.tables) && apaar.tables.some((t: any) => t.rows?.length > 0));

  const eptCount = hasEpt ? ept.tables.reduce((sum: number, t: any) => sum + (t.rows?.length || 0), 0) : 0;

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="p-4 sm:p-5 rounded-[24px] border border-zinc-200/80 dark:border-zinc-800/80 card-surface space-y-3"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-2xl" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-4 w-28 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // These tiles identify a record, not a state; they share one neutral well and
  // the single accent. Semantic hues stay on the status badges below.
  const NEUTRAL_ICON_WELL = "bg-zinc-500/10 border-zinc-500/20 text-info";
  // Presence is signalled with the accent; an absent record stays neutral.
  // Green/amber are kept only where the value is genuinely a status.
  const ACCENT_BADGE = "bg-info/10 text-info border-info/20";
  const NEUTRAL_BADGE = "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700";
  const SUCCESS_BADGE = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
  const WARNING_BADGE = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";

  const cards = [
    {
      id: "ept",
      icon: GraduationCap,
      label: "EPT Schedule",
      subtitle: "English Proficiency Test",
      value: hasEpt ? `${eptCount} Scheduled Exam${eptCount > 1 ? "s" : ""}` : "No Active Exams",
      badgeColor: hasEpt ? ACCENT_BADGE : NEUTRAL_BADGE,
      iconBg: NEUTRAL_ICON_WELL,
    },
    {
      id: "reg",
      icon: ClipboardCheck,
      label: "Course Registration",
      subtitle: "Course selection schedule",
      value: hasReg ? "Schedule Active" : "Not Scheduled",
      badgeColor: hasReg ? ACCENT_BADGE : NEUTRAL_BADGE,
      iconBg: NEUTRAL_ICON_WELL,
    },
    {
      id: "bank",
      icon: Landmark,
      label: "Bank Details",
      subtitle: "Fee refund & direct deposit",
      value: hasBank ? "Verified & On File" : "Action Required",
      badgeColor: hasBank ? SUCCESS_BADGE : WARNING_BADGE,
      iconBg: NEUTRAL_ICON_WELL,
    },
    {
      id: "day",
      icon: Building,
      label: "Dayboarder Info",
      subtitle: "Non-hosteller campus status",
      value: hasDay ? "Profile Verified" : "Not Provided",
      badgeColor: hasDay ? SUCCESS_BADGE : WARNING_BADGE,
      iconBg: NEUTRAL_ICON_WELL,
    },
    {
      id: "apaar",
      icon: IdCard,
      label: "APAAR / ABC ID",
      subtitle: "Academic Bank of Credits",
      value: hasApaar ? "Linked to Portal" : "Not Linked",
      badgeColor: hasApaar ? ACCENT_BADGE : NEUTRAL_BADGE,
      iconBg: NEUTRAL_ICON_WELL,
    },
    rank
      ? {
          id: "rank",
          icon: Trophy,
          label: "VITEEE Entrance Rank",
          subtitle: "Merit examination rank",
          value: `AIR ${rank}`,
          badgeColor: ACCENT_BADGE,
          iconBg: NEUTRAL_ICON_WELL,
        }
      : null,
  ].filter(Boolean);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
      {cards.map((card: any) => {
        const isClickable = card.id !== "rank" && card.id !== "apaar";
        const Icon = card.icon;

        return (
          <button
            key={card.id}
            type="button"
            disabled={!isClickable}
            onClick={() => isClickable && onCardClick(card.id)}
            className={`p-4 sm:p-5 rounded-[24px] border border-zinc-200/80 dark:border-zinc-800/80 card-surface transition-all duration-200 flex items-center justify-between gap-3.5 group select-none text-left w-full ${
              isClickable
                ? "hover:bg-white dark:hover:bg-zinc-900 hover:border-info/40 dark:hover:border-info/40 cursor-pointer"
                : "cursor-default"
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className={`w-11 h-11 rounded-2xl ${card.iconBg} flex items-center justify-center shrink-0 border`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold font-outfit text-zinc-900 dark:text-white line-clamp-2">{card.label}</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate mt-0.5">{card.subtitle}</p>
                <div className="mt-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-sm font-bold border ${card.badgeColor}`}
                  >
                    {card.value}
                  </span>
                </div>
              </div>
            </div>

            {isClickable && (
              <div className="p-1 rounded-lg text-zinc-400 group-hover:text-info group-hover:translate-x-0.5 transition-all shrink-0">
                <ChevronRight className="w-4 h-4" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
