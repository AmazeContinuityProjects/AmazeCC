import { useState, useEffect } from "react";
import { Skeleton } from "@amazecontinuityprojects/amazeui";
import { api, syncEngine } from "@/lib/sync-engine";
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
          if (!w) {
            try {
              w = await api("whoami", { method: "POST", auth: "vtop" } as any);
            } catch {}
          }
          if (w && !w.error) {
            try {
              localStorage.setItem("cache_whoami", JSON.stringify(w));
            } catch {}
          }
        }
        if (cancelled) return;
        setWhoami(w);

        // registration schedule now comes from unified /api/ffcs
        let regRes: any = null;
        if (refreshKey === 0) {
          try {
            const cachedReg =
              localStorage.getItem("cache_registration_schedule") ||
              localStorage.getItem("cache_registration-schedule");
            if (cachedReg) regRes = JSON.parse(cachedReg);
          } catch {}
        }
        if (!regRes || refreshKey > 0) {
          const ffcsRes = await api("ffcs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cookies: creds.cookies,
              authorizedID: creds.authorizedID,
              csrf: creds.csrf,
              section: "registration",
            }),
          }).catch(() => null);
          regRes = ffcsRes?.registrationSchedule || ffcsRes;
          if (regRes) {
            try {
              localStorage.setItem("cache_registration_schedule", JSON.stringify(regRes));
            } catch {}
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
            className="p-4 sm:p-5 rounded-[24px] border border-zinc-200/80 dark:border-zinc-800/80 card-surface shadow-2xs space-y-3"
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

  const cards = [
    {
      id: "ept",
      icon: GraduationCap,
      label: "EPT Schedule",
      subtitle: "English Proficiency Test",
      value: hasEpt ? `${eptCount} Scheduled Exam${eptCount > 1 ? "s" : ""}` : "No Active Exams",
      color: hasEpt ? "text-blue-600 dark:text-blue-400" : "text-zinc-500 dark:text-zinc-400",
      badgeColor: hasEpt
        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700",
      iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },
    {
      id: "reg",
      icon: ClipboardCheck,
      label: "Course Registration",
      subtitle: "Course selection schedule",
      value: hasReg ? "Schedule Active" : "Not Scheduled",
      color: hasReg ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400",
      badgeColor: hasReg
        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700",
      iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    },
    {
      id: "bank",
      icon: Landmark,
      label: "Bank Details",
      subtitle: "Fee refund & direct deposit",
      value: hasBank ? "Verified & On File" : "Action Required",
      color: hasBank ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
      badgeColor: hasBank
        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    },
    {
      id: "day",
      icon: Building,
      label: "Dayboarder Info",
      subtitle: "Non-hosteller campus status",
      value: hasDay ? "Profile Verified" : "Not Provided",
      color: hasDay ? "text-indigo-600 dark:text-indigo-400" : "text-amber-600 dark:text-amber-400",
      badgeColor: hasDay
        ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      iconBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    },
    {
      id: "apaar",
      icon: IdCard,
      label: "APAAR / ABC ID",
      subtitle: "Academic Bank of Credits",
      value: hasApaar ? "Linked to Portal" : "Not Linked",
      color: hasApaar ? "text-purple-600 dark:text-purple-400" : "text-zinc-500 dark:text-zinc-400",
      badgeColor: hasApaar
        ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700",
      iconBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    },
    rank
      ? {
          id: "rank",
          icon: Trophy,
          label: "VITEEE Entrance Rank",
          subtitle: "Merit examination rank",
          value: `AIR ${rank}`,
          color: "text-amber-600 dark:text-amber-400",
          badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
          iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
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
            className={`p-4 sm:p-5 rounded-[24px] border border-zinc-200/80 dark:border-zinc-800/80 card-surface shadow-2xs transition-all duration-200 flex items-center justify-between gap-3.5 group select-none text-left w-full ${
              isClickable
                ? "hover:bg-white dark:hover:bg-zinc-900 hover:shadow-md hover:border-indigo-500/40 dark:hover:border-indigo-500/40 cursor-pointer"
                : "cursor-default"
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className={`w-11 h-11 rounded-2xl ${card.iconBg} flex items-center justify-center shrink-0 border`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black font-outfit text-zinc-900 dark:text-white truncate">{card.label}</p>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">{card.subtitle}</p>
                <div className="mt-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${card.badgeColor}`}
                  >
                    {card.value}
                  </span>
                </div>
              </div>
            </div>

            {isClickable && (
              <div className="p-1 rounded-lg text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0">
                <ChevronRight className="w-4 h-4" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
