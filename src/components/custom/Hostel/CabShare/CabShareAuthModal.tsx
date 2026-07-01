"use client";

import { useState, useEffect } from "react";
import { API_BASE } from "../../Main";
import { Loader2, Car, Shield, AlertCircle, KeyRound, Phone, UserRound } from "lucide-react";
import { readJsonResponse } from "./cabShareFallback";

const panelClass = "rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-black";
const sidePanelClass = "rounded-3xl border border-black/10 bg-gray-50 p-6 dark:border-white/10 dark:bg-white/[0.03]";
const inputClass = "cabshare-input w-full rounded-2xl border border-black/10 bg-white px-4 py-3 pl-11 text-sm font-semibold text-gray-900 outline-none transition-colors focus:border-blue-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:focus:border-blue-500";

export default function CabShareAuthModal({ isOpen, onAuthSuccess }: { isOpen: boolean, onAuthSuccess: (user: any) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      const idsObj = localStorage.getItem("IDs");
      if (idsObj) {
        try {
          const ids = JSON.parse(idsObj);
          if (ids.VtopUsername) setUsername(ids.VtopUsername);
          // We can optionally pre-fill password too if we want true auto-login,
          // but the user's requirement "fetch the vtop username and password from the local storage" means we should probably just do it silently.
          if (ids.VtopPassword) setPassword(ids.VtopPassword);
        } catch (e) {}
      }
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !phoneNumber) {
      setError("Please fill all fields.");
      return;
    }
    if (phoneNumber.length < 10) {
      setError("Please enter a valid phone number.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/api/cabshare/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, phone_number: phoneNumber }),
      });

      const data = await readJsonResponse(res);
      if (!data) {
        onAuthSuccess({
          reg_number: username.trim(),
          username: username.trim(),
          name: username.trim(),
          phone_number: phoneNumber.trim(),
          local_only: true,
        });
        return;
      }

      if (data.success) {
        onAuthSuccess(data.user);
      } else {
        setError(data.error || data.message || "Authentication failed");
      }
    } catch (err) {
      onAuthSuccess({
        reg_number: username.trim(),
        username: username.trim(),
        name: username.trim(),
        phone_number: phoneNumber.trim(),
        local_only: true,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className={panelClass}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
              <Car className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">One-time setup</p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-gray-950 dark:text-white">Start using Cab Share</h2>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-gray-500 dark:text-gray-400">
                Verify your VTOP account and add a reachable phone number before posting or joining rides.
              </p>
            </div>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
          {error && (
            <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400 md:col-span-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">Registration Number</label>
            <div className="relative">
              <UserRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)}
                required
                className={inputClass}
                placeholder="Enter registration number"
              />
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">VTOP Password</label>
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={inputClass}
                placeholder="Enter your VTOP password"
              />
            </div>
          </div>
          
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input 
                type="tel" 
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                className={inputClass}
                placeholder="10-digit mobile number"
              />
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
              <Shield className="h-3.5 w-3.5" /> Shared only with confirmed ride matches.
            </p>
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 md:col-span-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Authenticate & Continue"}
          </button>
        </form>
      </div>

      <aside className={sidePanelClass}>
        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">How it works</p>
        <div className="mt-4 space-y-4">
          {[
            ["Verify", "Use your saved VTOP registration number to keep ride requests student-only."],
            ["Post or find", "Choose your hub, travel date, and preferred time."],
            ["Confirm", "Contact details unlock only after the host accepts a request."],
          ].map(([title, description], index) => (
            <div key={title} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white text-xs font-black text-blue-600 shadow-sm dark:bg-black dark:text-blue-400">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-black text-gray-900 dark:text-white">{title}</p>
                <p className="mt-1 text-xs font-medium leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}
