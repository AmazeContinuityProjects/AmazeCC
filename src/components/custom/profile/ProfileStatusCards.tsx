"use client";
import { useState, useEffect } from "react";
import { Skeleton } from "@amazecontinuityprojects/amazeui";
import { API_BASE } from "../Main";
import { GraduationCap, ClipboardCheck, Landmark, Building, Trophy, IdCard } from "lucide-react";

export default function ProfileStatusCards({ creds, refreshKey, onCardClick }: { creds: any; refreshKey: number; onCardClick: (id: string) => void }) {
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
          if (cachedApaar) try { setApaar(JSON.parse(cachedApaar)); } catch (e) {}
          setLoading(false);
          return;
        } catch (e) {}
      }
    }

    setLoading(true);
    const { cookies, authorizedID, csrf } = creds;
    Promise.all([
      fetch(`${API_BASE}/api/ept-schedule`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cookies, authorizedID, csrf }) }).then(r => r.json()),
      fetch(`${API_BASE}/api/registration-schedule`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cookies, authorizedID, csrf }) }).then(r => r.json()),
      fetch(`${API_BASE}/api/bank-info`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cookies, authorizedID, csrf }) }).then(r => r.json()),
      fetch(`${API_BASE}/api/dayboarder`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cookies, authorizedID, csrf }) }).then(r => r.json()),
      fetch(`${API_BASE}/api/credentials`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cookies, authorizedID, csrf }) }).then(r => r.json()),
      fetch(`${API_BASE}/api/apaarid`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cookies, authorizedID, csrf }) }).then(r => r.json()).catch(() => ({ success: false })),
    ])
      .then(([eptRes, regRes, bankRes, dayRes, credRes, apaarRes]) => {
        setEpt(eptRes);
        setReg(regRes);
        setBank(bankRes);
        setDay(dayRes);
        setApaar(apaarRes);
        const rankVal = credRes?.ranks?.[0]?.rank;
        if (rankVal) setRank(String(rankVal));
        localStorage.setItem("cache_apaarid", JSON.stringify(apaarRes));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refreshKey, creds]);

  const statCard = "solid-card p-4 flex flex-col items-center justify-center text-center min-h-[100px]";

  const hasEpt = ept?.tables?.length > 0 && ept.tables.some((t: any) => t.rows?.length > 0);
  const hasReg = reg?.tables?.length > 0 && reg.tables.some((t: any) => t.rows?.length > 0);
  const hasBank = bank?.bankDetails !== null || (bank?.fields && Object.values(bank.fields).some((f: any) => f.value && f.value.length > 0));
  const hasDay = day?.fields && Object.values(day.fields).some((f: any) => f.value && f.value.length > 0);
  const apaarFormFilled = apaar?.formFields ? Object.values(apaar.formFields).some((v: any) => v && v.length > 4 && v !== '-' && !String(v).startsWith('0')) : false;
  const hasApaar = apaar?.hasApaar === true || (apaar?.keyValuePairs && Object.keys(apaar.keyValuePairs).length > 0) || (apaar?.tables && apaar.tables.some((t: any) => t.rows.length > 0)) || apaarFormFilled;

  const eptCount = hasEpt ? ept.tables.reduce((sum: number, t: any) => sum + (t.rows?.length || 0), 0) : 0;

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className={statCard}>
            <Skeleton className="h-4 w-16 rounded mb-2" />
            <Skeleton className="h-6 w-20 rounded" />
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
      value: hasEpt ? `${eptCount} Exam${eptCount > 1 ? "s" : ""}` : "No EPT",
      color: hasEpt ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500",
      iconBg: hasEpt ? "bg-blue-50 dark:bg-blue-900/30" : "bg-gray-100 dark:bg-gray-800",
    },
    {
      id: "reg",
      icon: ClipboardCheck,
      label: "Registration",
      value: hasReg ? "Available" : "No Data",
      color: hasReg ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-gray-500",
      iconBg: hasReg ? "bg-emerald-50 dark:bg-emerald-900/30" : "bg-gray-100 dark:bg-gray-800",
    },
    {
      id: "bank",
      icon: Landmark,
      label: "Bank Info",
      value: hasBank ? "Filled" : "Not Filled",
      color: hasBank ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
      iconBg: hasBank ? "bg-emerald-50 dark:bg-emerald-900/30" : "bg-amber-50 dark:bg-amber-900/30",
    },
    {
      id: "day",
      icon: Building,
      label: "Dayboarder",
      value: hasDay ? "Filled" : "Not Filled",
      color: hasDay ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
      iconBg: hasDay ? "bg-emerald-50 dark:bg-emerald-900/30" : "bg-amber-50 dark:bg-amber-900/30",
    },
    {
      id: "apaar",
      icon: IdCard,
      label: "APAAR ID",
      value: hasApaar ? "Uploaded" : "Not Uploaded",
      color: hasApaar ? "text-purple-600 dark:text-purple-400" : "text-gray-400 dark:text-gray-500",
      iconBg: hasApaar ? "bg-purple-50 dark:bg-purple-900/30" : "bg-gray-100 dark:bg-gray-800",
    },
    rank ? {
      id: "rank",
      icon: Trophy,
      label: "VITEE Rank",
      value: rank,
      color: "text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-50 dark:bg-amber-900/30",
    } : null,
  ].filter(Boolean);

  const clickableCard = `${statCard} cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300`;

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
      {cards.map((card: any) => (
        <div key={card.id} onClick={() => card.id !== "rank" && card.id !== "apaar" && onCardClick(card.id)} className={`${clickableCard} ${card.id === "rank" || card.id === "apaar" ? "cursor-default" : ""}`}>
          <div className={`p-1.5 rounded-lg ${card.iconBg} mb-2`}>
            <card.icon className={`w-4 h-4 ${card.color}`} />
          </div>
          <span className="text-[10px] font-semibold text-gray-400  dark:text-gray-500 uppercase tracking-wider mb-1">{card.label}</span>
          <span className={`text-sm font-bold ${card.color}`}>{card.value}</span>
        </div>
      ))}
    </div>
  );
}
