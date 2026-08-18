import { useState, useEffect } from "react";
import { Skeleton } from "@amazecontinuityprojects/amazeui";
import { API_BASE } from "../Main";
import {
  GraduationCap,
  ClipboardCheck,
  Landmark,
  Building,
  Trophy,
  IdCard,
  ChevronRight,
} from "lucide-react";

export default function ProfileStatusCards({
  creds,
  refreshKey,
  onCardClick,
}: {
  creds: any;
  refreshKey: number;
  onCardClick: (id: string) => void;
}) {
  const [ept, setEpt] = useState<any>(null);
  const [reg, setReg] = useState<any>(null);
  const [bank, setBank] = useState<any>(null);
  const [day, setDay] = useState<any>(null);
  const [rank, setRank] = useState<string | null>(null);
  const [apaar, setApaar] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!creds) return;

    if (refreshKey === 0) {
      const cachedEpt = localStorage.getItem("cache_ept_schedule");
      const cachedReg = localStorage.getItem("cache_registration_schedule");
      const cachedBank = localStorage.getItem("cache_bank_info");
      const cachedDay = localStorage.getItem("cache_dayboarder");
      const cachedCred = localStorage.getItem("cache_credentials");
      const cachedApaar = localStorage.getItem("cache_apaarid");
      if (cachedEpt && cachedReg && cachedBank && cachedDay && cachedCred) {
        try {
          const eptRes = JSON.parse(cachedEpt);
          const regRes = JSON.parse(cachedReg);
          const bankRes = JSON.parse(cachedBank);
          const dayRes = JSON.parse(cachedDay);
          const credRes = JSON.parse(cachedCred);
          setEpt(eptRes);
          setReg(regRes);
          setBank(bankRes);
          setDay(dayRes);
          const rankVal = credRes?.ranks?.[0]?.rank;
          if (rankVal) setRank(String(rankVal));
          if (cachedApaar)
            try {
              setApaar(JSON.parse(cachedApaar));
            } catch (e) {}
          setLoading(false);
          return;
        } catch (e) {}
      }
    }

    setLoading(true);
    const { cookies, authorizedID, csrf } = creds;
    Promise.all([
      fetch(`${API_BASE}/api/ept-schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies, authorizedID, csrf }),
      }).then((r) => r.json()),
      fetch(`${API_BASE}/api/registration-schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies, authorizedID, csrf }),
      }).then((r) => r.json()),
      fetch(`${API_BASE}/api/dayboarder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies, authorizedID, csrf }),
      }).then((r) => r.json()),
      fetch(`${API_BASE}/api/me`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies, authorizedID, csrf }),
      })
        .then((r) => r.json())
        .catch(() => ({ success: false })),
    ])
      .then(([eptRes, regRes, dayRes, meRes]) => {
        setEpt(eptRes);
        setReg(regRes);
        setDay(dayRes);
        const identity = meRes?.identity || {};
        setBank(identity.bank ?? null);
        setApaar(identity.apaar ?? null);
        const rankVal = identity.ranks?.[0]?.rank;
        if (rankVal) setRank(String(rankVal));
        localStorage.setItem("cache_apaarid", JSON.stringify(identity.apaar || { hasApaar: false }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refreshKey, creds]);

  const hasEpt = ept?.tables?.length > 0 && ept.tables.some((t: any) => t.rows?.length > 0);
  const hasReg = reg?.tables?.length > 0 && reg.tables.some((t: any) => t.rows?.length > 0);
  const hasBank =
    !!bank &&
    (bank?.name ||
      bank?.branch ||
      bank?.address ||
      (Array.isArray(bank?.fields) && bank.fields.length > 0) ||
      (bank?.fields && typeof bank.fields === "object" &&
        Object.values(bank.fields).some((f: any) => f?.value && f.value.length > 0)));
  const hasDay =
    day?.fields && Object.values(day.fields).some((f: any) => f.value && f.value.length > 0);
  const apaarFormFilled =
    (Array.isArray(apaar?.fields) && apaar.fields.length > 0) ||
    (apaar?.formFields
      ? Object.values(apaar.formFields).some(
          (v: any) => v && v.length > 4 && v !== "-" && !String(v).startsWith("0")
        )
      : false);
  const hasApaar =
    apaar?.hasApaar === true ||
    (apaar?.keyValuePairs && Object.keys(apaar.keyValuePairs).length > 0) ||
    (apaar?.tables && apaar.tables.some((t: any) => t.rows.length > 0)) ||
    apaarFormFilled;

  const eptCount = hasEpt
    ? ept.tables.reduce((sum: number, t: any) => sum + (t.rows?.length || 0), 0)
    : 0;

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="p-4 sm:p-5 rounded-[22px] border border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 shadow-2xs space-y-3"
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
            className={`p-4 sm:p-5 rounded-[22px] border border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/80 shadow-2xs transition-all duration-200 flex items-center justify-between gap-3.5 group select-none text-left w-full ${
              isClickable
                ? "hover:bg-white dark:hover:bg-zinc-900 hover:shadow-md hover:border-indigo-500/40 dark:hover:border-indigo-500/40 cursor-pointer"
                : "cursor-default"
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className={`w-11 h-11 rounded-2xl ${card.iconBg} flex items-center justify-center shrink-0 border`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black font-outfit text-zinc-900 dark:text-white truncate">
                  {card.label}
                </p>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                  {card.subtitle}
                </p>
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
