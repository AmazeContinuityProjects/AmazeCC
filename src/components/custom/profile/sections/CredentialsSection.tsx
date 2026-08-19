"use client";

import React, { useState } from "react";
import {
  Key,
  RefreshCcw,
  User,
  Copy,
  Eye,
  EyeOff,
  Save,
  Lock,
  AlertCircle,
  CheckCircle,
  LogOut,
} from "lucide-react";
import { Button } from "@amazecontinuityprojects/amazeui";

interface CredentialsSectionProps {
  username: string;
  refreshingCreds: boolean;
  handleRefreshCreds: () => void;
  credAccounts: any[];
  changedUsername: string;
  setChangedUsername: (val: string) => void;
  changedPassword: string;
  setChangedPassword: (val: string) => void;
  setPassword: (val: string[]) => void;
  vtopOldPassword: string;
  setVtopOldPassword: (val: string) => void;
  vtopNewPassword: string;
  setVtopNewPassword: (val: string) => void;
  vtopConfirmPassword: string;
  setVtopConfirmPassword: (val: string) => void;
  passwordChangeLoading: boolean;
  passwordChangeError: string | null;
  passwordChangeSuccess: string | null;
  handleChangeVtopPassword: () => void;
  kohaCard: string;
  setKohaCard: (val: string) => void;
  kohaPassword: string;
  setKohaPassword: (val: string) => void;
  kohaSaved: boolean;
  saveKoha: () => void;
  handleLogOutRequest: () => void;
}

export default function CredentialsSection({
  username,
  refreshingCreds,
  handleRefreshCreds,
  credAccounts,
  changedUsername,
  setChangedUsername,
  changedPassword,
  setChangedPassword,
  setPassword,
  vtopOldPassword,
  setVtopOldPassword,
  vtopNewPassword,
  setVtopNewPassword,
  vtopConfirmPassword,
  setVtopConfirmPassword,
  passwordChangeLoading,
  passwordChangeError,
  passwordChangeSuccess,
  handleChangeVtopPassword,
  kohaCard,
  setKohaCard,
  kohaPassword,
  setKohaPassword,
  kohaSaved,
  saveKoha,
  handleLogOutRequest,
}: CredentialsSectionProps) {
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});
  const [showAppPassword, setShowAppPassword] = useState(false);

  const toggleShow = (idx: number) => {
    setShowPasswords((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      {/* VTOP Session & Account Header Card */}
      <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white font-outfit">
                VTOP Authentication Session
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Authorized user: <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{username}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRefreshCreds}
            disabled={refreshingCreds}
            className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold transition-colors cursor-pointer"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${refreshingCreds ? "animate-spin" : ""}`} />
            <span>{refreshingCreds ? "Syncing..." : "Sync Portal Keys"}</span>
          </button>
        </div>
      </div>

      {/* App Saved Portals Grid */}
      {credAccounts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-1">
            Linked Portal Accounts
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {credAccounts.map((row: any, idx: number) => {
              const accountName = row.account || "Portal Account";
              const userName = row.username || "";
              const pass = row.defaultCredentials || "";
              const url = row.url || "";

              return (
                <div
                  key={idx}
                  className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 space-y-4 shadow-2xs"
                >
                  <div className="flex items-center gap-3 pb-3 border-b border-zinc-150 dark:border-zinc-800/80">
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-xs text-zinc-900 dark:text-white truncate font-outfit">
                        {accountName}
                      </h4>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-850">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                          Username
                        </p>
                        <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate font-mono text-xs mt-0.5">
                          {userName || "N/A"}
                        </p>
                      </div>
                      {userName && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(userName)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors"
                          title="Copy Username"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {pass && (
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-850">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                            Password
                          </p>
                          <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate font-mono text-xs mt-0.5 tracking-wider">
                            {showPasswords[idx] ? pass : "••••••••••••"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleShow(idx)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-500 transition-colors"
                            title={showPasswords[idx] ? "Hide" : "Show"}
                          >
                            {showPasswords[idx] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(pass)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors"
                            title="Copy Password"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {url && url !== "-" && (
                      <div className="text-[11px] truncate">
                        <span className="text-zinc-400 font-semibold">URL: </span>
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                          {url}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Local App Stored Credentials */}
      <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 space-y-4 shadow-2xs">
        <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white font-outfit">
          Stored Portal Logins
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Saved locally and encrypted in your device storage for instant autofill and auto-login
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
              VTOP Registration / Username
            </label>
            <input
              type="text"
              value={changedUsername}
              onChange={(e) => setChangedUsername(e.target.value)}
              className="w-full text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-950/50 px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
              VTOP Password
            </label>
            <div className="relative">
              <input
                type={showAppPassword ? "text" : "password"}
                value={changedPassword}
                onChange={(e) => setChangedPassword(e.target.value)}
                className="w-full text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-950/50 px-3 py-2.5 pr-10 rounded-xl border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowAppPassword(!showAppPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-1 cursor-pointer"
              >
                {showAppPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <Button
            size="sm"
            onClick={() => {
              setPassword([changedUsername, changedPassword]);
              alert("Credentials saved locally!");
            }}
            disabled={!changedUsername || !changedPassword}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" /> Save Stored Credentials
          </Button>
        </div>
      </div>

      {/* Change VTOP Portal Password */}
      <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 space-y-4 shadow-2xs">
        <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white font-outfit">
          Change VTOP Portal Password
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Remotely update your password on VIT's official VTOP servers
        </p>

        <div className="space-y-3 max-w-md">
          <input
            type="password"
            value={vtopOldPassword}
            onChange={(e) => setVtopOldPassword(e.target.value)}
            placeholder="Current VTOP Password"
            className="w-full text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-950/50 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
          <input
            type="password"
            value={vtopNewPassword}
            onChange={(e) => setVtopNewPassword(e.target.value)}
            placeholder="New Password (min 6 chars)"
            className="w-full text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-950/50 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
          <input
            type="password"
            value={vtopConfirmPassword}
            onChange={(e) => setVtopConfirmPassword(e.target.value)}
            placeholder="Confirm New Password"
            className="w-full text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-950/50 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />

          {passwordChangeError && (
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 p-3 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{passwordChangeError}</span>
            </div>
          )}

          {passwordChangeSuccess && (
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 p-3 rounded-xl">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{passwordChangeSuccess}</span>
            </div>
          )}

          <Button
            size="sm"
            onClick={handleChangeVtopPassword}
            disabled={passwordChangeLoading || !vtopOldPassword || !vtopNewPassword || !vtopConfirmPassword}
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold"
          >
            <Lock className="w-3.5 h-3.5 mr-1.5" />
            {passwordChangeLoading ? "Updating VTOP..." : "Submit Password Change"}
          </Button>
        </div>
      </div>

      {/* Koha Library Card Login */}
      <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 space-y-4 shadow-2xs">
        <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white font-outfit">
          Koha Library Card
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Library membership credentials used to query books, reserves, and due dates
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
          <input
            type="text"
            value={kohaCard}
            onChange={(e) => setKohaCard(e.target.value)}
            placeholder="Card Number (e.g. 22BCE1234)"
            className="w-full text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-950/50 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
          <input
            type="password"
            value={kohaPassword}
            onChange={(e) => setKohaPassword(e.target.value)}
            placeholder="Library Password"
            className="w-full text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-950/50 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>

        <Button
          size="sm"
          onClick={saveKoha}
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
        >
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {kohaSaved ? "Saved!" : "Save Library Credentials"}
        </Button>
      </div>

      {/* Session Security & Log Out */}
      <div className="bg-red-50/50 dark:bg-red-950/20 rounded-2xl border border-red-200/80 dark:border-red-900/40 p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 shrink-0">
            <LogOut className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-red-900 dark:text-red-200 font-outfit">
              Sign Out & End Session
            </h3>
            <p className="text-xs text-red-700/80 dark:text-red-400/80">
              Clear your active session and cookies on this device
            </p>
          </div>
        </div>
        <div className="pt-2">
          <Button
            size="sm"
            onClick={handleLogOutRequest}
            className="bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" /> Log Out Now
          </Button>
        </div>
      </div>
    </div>
  );
}
