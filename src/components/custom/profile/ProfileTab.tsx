"use client";
import { useState, useEffect, useRef } from "react";
import ProfilePage from "../header/ProfilePage";
import GenericApiView, { clearApiCache } from "../Exams/GenericApiView";
import ProfileSubTabs from "./ProfileSubTabs";
import { Skeleton } from "@amazecontinuityprojects/amazeui";
import { Card, Badge, Modal } from "../shared";
import { RefreshCcw, Eye, EyeOff, Save, CheckCircle, AlertCircle, User, Clock, Copy, Lock, BookOpen } from "lucide-react";
import { API_BASE } from "../Main";

interface ProfileTabProps {
  onOpenShortcutsHelp?: () => void;
  activeProfileSubTab: string;
  setActiveProfileSubTab: (val: string) => void;
  isLoggedIn: boolean;
  loginToVTOP: () => Promise<{ cookies: string[]; authorizedID: string; csrf: string }>;
  currSemesterID: string;
  setCurrSemesterID: (val: string) => void;
  handleLogin: any;
  setIsReloading: any;
  handleLogOutRequest: any;
  password: string[];
  username: string;
  setPassword: (val: string[]) => void;
  decimalValues: boolean;
  setDecimalValues: (val: boolean) => void;
  isDayscholarWithBus: boolean;
  setIsDayscholarWithBus: (val: boolean) => void;
  residentialStatus: string;
  setResidentialStatus: (val: "hosteller" | "dayscholar") => void;
  friendlyName: string;
  setFriendlyName: (val: string) => void;
  calendarType: any;
  setCalendarType: (val: any) => void;
  hideMobileHeader: boolean;
  setHideMobileHeader: (val: boolean) => void;
  reloadAllData: boolean;
  setReloadAllData: (val: boolean) => void;
  settings: any;
  setSettings: (val: any) => void;
}

function useCredentialSection(loginToVTOP: () => Promise<any>) {
  const [creds, setCreds] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { loginToVTOP().then(setCreds).catch(() => {}); }, []);

  return {
    creds,
    refreshKey,
    setRefreshKey,
    reload: () => { clearApiCache(); setRefreshKey(k => k + 1); }
  };
}

function ChangeDetector({ endpoint, creds }: { endpoint: string; creds: any }) {
  const [changed, setChanged] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (!creds || checkedRef.current) return;
    checkedRef.current = true;
    const cacheKey = `cache_${endpoint.replace(/-/g, "_")}`;
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return;
    try {
      const res = JSON.parse(cached);
      if (!res || res.success === false) return;
      const key = `_prev_${endpoint}`;
      const stored = localStorage.getItem(key);
      if (stored && stored !== cached) setChanged(true);
      localStorage.setItem(key, cached);
    } catch (e) {}
  }, [creds]);

  if (!changed) return null;
  return <Badge variant="warning" size="sm">Updated</Badge>;
}

const SectionShell = ({ title, icon: Icon, children }: { title: string; icon?: any; children: React.ReactNode }) => (
  <Card variant="glass" className="overflow-hidden mb-5">
    <div className="p-5">
      {title && (
        <h4 className="text-sm font-semibold text-gray-500  dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4" />}
          {title}
        </h4>
      )}
      {children}
    </div>
  </Card>
);

export default function ProfileTab(props: ProfileTabProps) {
  const { activeProfileSubTab, setActiveProfileSubTab, loginToVTOP, username, password, setPassword, ...profilePageProps } = props;
  const { creds, refreshKey, setRefreshKey, reload } = useCredentialSection(loginToVTOP);
  const [showPassword, setShowPassword] = useState(false);
  const [changedUsername, setChangedUsername] = useState("");
  const [changedPassword, setChangedPassword] = useState("");
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const regAutoChecked = useRef(false);

  useEffect(() => {
    if (activeProfileSubTab !== "info" || !creds) return;
    setChangedUsername(username);
    setChangedPassword(Array.isArray(password) ? password[0] : password);
  }, [activeProfileSubTab, creds, username, password]);

  useEffect(() => {
    if (!creds || regAutoChecked.current) return;
    regAutoChecked.current = true;
    const cached = localStorage.getItem("cache_registration_schedule");
    if (!cached) return;
    try {
      const res = JSON.parse(cached);
      if (!res || res.success === false) return;
      const key = "_prev_registration-schedule";
      const stored = localStorage.getItem(key);
      if (stored && stored !== cached) {
        const lastRead = localStorage.getItem("_reg_update_read");
        if (!lastRead || Date.now() - Number(lastRead) > 60000) {
          setActiveModal("reg");
        }
      }
      localStorage.setItem(key, cached);
    } catch (e) {}
  }, [creds]);

  const handleSaveAppLogins = () => {
    if (changedUsername && changedPassword) {
      setPassword([changedUsername, changedPassword]);
    }
  };

  const closeModal = () => setActiveModal(null);

  return (
    <div className="animate-fadeIn w-full max-w-7xl mx-auto">

      <div className="mt-4">
        {activeProfileSubTab === "info" && (
          <div className="space-y-6">
            <ProfilePage {...profilePageProps} loginToVTOP={loginToVTOP} username={username} password={password} setPassword={setPassword} creds={creds} refreshKey={refreshKey} onCardClick={setActiveModal} onCredentialsClick={() => setActiveProfileSubTab("credentials")} onReload={reload} mode="info" />
          </div>
        )}

        {activeProfileSubTab === "settings" && (
          <div className="space-y-6">
            <ProfilePage {...profilePageProps} loginToVTOP={loginToVTOP} username={username} password={password} setPassword={setPassword} creds={creds} refreshKey={refreshKey} onCardClick={setActiveModal} onCredentialsClick={() => setActiveProfileSubTab("credentials")} onReload={reload} mode="settings" />
          </div>
        )}


        {activeProfileSubTab === "credentials" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900  dark:text-gray-100">Your Credentials</h2>
              <button onClick={() => reload()} className="p-2.5 rounded-full bg-blue-50  dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-slate-700 transition-colors" title="Reload">
                <RefreshCcw className="w-5 h-5" />
              </button>
            </div>
            {creds && <CredentialsContent creds={creds} refreshKey={refreshKey} username={username} password={password} setPassword={setPassword} loginToVTOP={loginToVTOP} />}
          </div>
        )}
      </div>

      {/* Modals */}
      {activeModal === "ept" && creds && (
        <Modal isOpen onClose={closeModal} title="EPT Schedule" maxWidth="max-w-2xl">
          <GenericApiView endpoint="ept-schedule" title="" creds={creds} refreshKey={refreshKey} />
        </Modal>
      )}
      {activeModal === "reg" && creds && (
        <Modal isOpen onClose={closeModal} title="Registration Schedule" maxWidth="max-w-sm">
          <RegistrationModalContent creds={creds} onClose={closeModal} />
        </Modal>
      )}
      {activeModal === "bank" && creds && (
        <Modal isOpen onClose={closeModal} title="Bank Information" maxWidth="max-w-md">
          <BankDayStatusModal endpoint="bank-info" title="Bank Info" creds={creds} />
        </Modal>
      )}
      {activeModal === "day" && creds && (
        <Modal isOpen onClose={closeModal} title="Dayboarder Information" maxWidth="max-w-md">
          <BankDayStatusModal endpoint="dayboarder" title="Dayboarder Info" creds={creds} />
        </Modal>
      )}

    </div>
  );
}

function RegistrationModalContent({ creds, onClose }: { creds: any; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [hasData, setHasData] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const { cookies, authorizedID, csrf } = creds;
    fetch(`${API_BASE}/api/registration-schedule`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cookies, authorizedID, csrf }),
    })
      .then(r => r.json())
      .then(res => {
        const hasContent = res?.tables?.length > 0 && res.tables.some((t: any) => t.rows?.length > 0);
        setHasData(hasContent);
        if (hasContent) {
          let foundDate = "";
          let foundTime = "";

          // Approach 1: keyValuePairs (clean for vertical label-value tables)
          if (res?.keyValuePairs?.date) foundDate = res.keyValuePairs.date;
          if (res?.keyValuePairs?.fromTime) {
            const to = res.keyValuePairs.toTime ? ` - ${res.keyValuePairs.toTime}` : "";
            foundTime = res.keyValuePairs.fromTime + to;
          }

          // Approach 2: vertical table — rows have labels in headers[0], values in col1
          if (!foundDate || !foundTime) {
            const rows = res.tables[0].rows || [];
            const h = res.tables[0].headers?.[0] || "Registration Details";
            for (const row of rows) {
              const label = typeof row === "object" ? (row[h] || "") : "";
              const val = typeof row === "object" ? (row["col1"] || "") : "";
              if (!foundDate && /date/i.test(label)) foundDate = val;
              if (!foundTime && /from.?time|to.?time|time/i.test(label)) {
                foundTime = foundTime ? `${foundTime} - ${val}` : val;
              }
            }
          }

          // Approach 3: standard horizontal table — find date/time column headers
          if (!foundDate || !foundTime) {
            const firstRow = res.tables[0].rows?.[0];
            const headers = res.tables[0].headers || [];
            if (!foundDate) {
              const idx = headers.findIndex((h: string) => /date/i.test(h));
              if (idx >= 0) {
                foundDate = String(typeof firstRow === "object" ? (firstRow[headers[idx]] || firstRow[idx] || "") : firstRow[idx] || "");
              }
            }
            if (!foundTime) {
              const idx = headers.findIndex((h: string) => /time|session/i.test(h));
              if (idx >= 0) {
                foundTime = String(typeof firstRow === "object" ? (firstRow[headers[idx]] || firstRow[idx] || "") : firstRow[idx] || "");
              }
            }
          }

          setDate(foundDate);
          setTime(foundTime);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const handleMarkRead = () => {
    localStorage.setItem("_reg_update_read", Date.now().toString());
    onClose();
  };

  if (loading) return <Skeleton className="h-20 w-full rounded-xl" />;

  if (error || !hasData) {
    return (
      <div className="flex flex-col items-center text-center py-4 space-y-3">
        <div className="p-3 rounded-full bg-amber-50 dark:bg-amber-900/30">
          <Clock className="w-8 h-8 text-amber-500" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">No registration schedule available</p>
        <button onClick={onClose} className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">Close</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center py-4 space-y-4">
      <div className="p-4 rounded-full bg-blue-50  dark:bg-blue-900/30">
        <Clock className="w-10 h-10 text-blue-600  dark:text-blue-400" />
      </div>
      <div>
        <p className="text-lg font-bold text-gray-900  dark:text-gray-100">Registration Scheduled</p>
        <p className="text-sm text-gray-500  dark:text-gray-400 mt-1">
          {date && <span>Date: {date}</span>}
          {date && time && <span>{" • "}</span>}
          {time && <span>Time: {time}</span>}
          {!date && !time && <span>Your registration is available</span>}
        </p>
      </div>
      <button onClick={handleMarkRead} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
        Mark as Read
      </button>
    </div>
  );
}

function BankDayStatusModal({ endpoint, title, creds }: { endpoint: string; title: string; creds: any }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const { cookies, authorizedID, csrf } = creds;
    fetch(`${API_BASE}/api/${endpoint}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cookies, authorizedID, csrf }),
    }).then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-24 w-full rounded-2xl" />;

  const hasContent = data?.tables?.length > 0 || (data?.keyValuePairs && Object.keys(data.keyValuePairs).length > 0);

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl">
      {hasContent ? (
        <>
          <div className="p-3 rounded-full bg-emerald-100  dark:bg-emerald-900/30 text-emerald-600  dark:text-emerald-400">
            <CheckCircle className="w-8 h-8" />
          </div>
          <div>
            <p className="font-semibold text-emerald-700  dark:text-emerald-300 text-lg">{title} Filled</p>
            <p className="text-sm text-emerald-600/70  dark:text-emerald-400/70">Your {title.toLowerCase()} has been submitted successfully</p>
          </div>
        </>
      ) : (
        <>
          <div className="p-3 rounded-full bg-gray-100  dark:bg-gray-700 text-gray-400">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <p className="font-semibold text-gray-700  dark:text-gray-300 text-lg">{title} Not Filled</p>
            <p className="text-sm text-gray-500  dark:text-gray-400">No {title.toLowerCase()} found in the system</p>
          </div>
        </>
      )}
    </div>
  );
}

function CredentialsContent({ creds, refreshKey, username, password, setPassword, loginToVTOP }: { creds: any; refreshKey: number; username: string; password: string[]; setPassword: (val: string[]) => void; loginToVTOP: () => Promise<any> }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [changedUsername, setChangedUsername] = useState("");
  const [changedPassword, setChangedPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});
  const [showAppPassword, setShowAppPassword] = useState(false);
  const [vtopOldPassword, setVtopOldPassword] = useState("");
  const [vtopNewPassword, setVtopNewPassword] = useState("");
  const [vtopConfirmPassword, setVtopConfirmPassword] = useState("");
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [kohaCard, setKohaCard] = useState("");
  const [kohaPassword, setKohaPassword] = useState("");
  const [kohaSaved, setKohaSaved] = useState(false);

  useEffect(() => {
    setKohaCard(localStorage.getItem("koha_card") || "");
    setKohaPassword(localStorage.getItem("koha_password") || "");
  }, []);

  const saveKoha = () => {
    localStorage.setItem("koha_card", kohaCard);
    localStorage.setItem("koha_password", kohaPassword);
    setKohaSaved(true);
    setTimeout(() => setKohaSaved(false), 2000);
  };

  const toggleShow = (idx: number) => setShowPasswords(p => ({ ...p, [idx]: !p[idx] }));

  const copyToClipboard = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch {}
  };

  const handleChangeVtopPassword = async () => {
    setPasswordChangeError(null);
    setPasswordChangeSuccess(null);
    if (!vtopOldPassword || !vtopNewPassword || !vtopConfirmPassword) {
      setPasswordChangeError("All fields are required");
      return;
    }
    if (vtopNewPassword !== vtopConfirmPassword) {
      setPasswordChangeError("New passwords do not match");
      return;
    }
    if (vtopNewPassword.length < 6) {
      setPasswordChangeError("New password must be at least 6 characters");
      return;
    }
    setPasswordChangeLoading(true);
    try {
      const { cookies, authorizedID, csrf } = await loginToVTOP();
      const res = await fetch(`${API_BASE}/api/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies, authorizedID, csrf, oldPassword: vtopOldPassword, newPassword: vtopNewPassword, confirmNewPassword: vtopConfirmPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setPasswordChangeSuccess("VTOP password changed successfully!");
        setVtopOldPassword("");
        setVtopNewPassword("");
        setVtopConfirmPassword("");
      } else {
        setPasswordChangeError(data.error || data.message || "Failed to change password");
      }
    } catch (err: any) {
      setPasswordChangeError(err.message || "Network error");
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    clearApiCache();
    const { cookies, authorizedID, csrf } = creds;
    if (authorizedID === "DEMO123") {
      await new Promise(resolve => setTimeout(resolve, 300));
      setData({
        credentials: [
          {
            account: "VTOP Student Portal",
            username: "22BCE1234",
            defaultCredentials: "demo-password-vtop",
            url: "https://vtop.vit.ac.in",
            venueDate: "Active Session",
            seatLocation: "N/A"
          },
          {
            account: "Koha Library Card",
            username: "22BCE1234",
            defaultCredentials: "demo-password-koha",
            url: "http://opac.vit.ac.in",
            venueDate: "N/A",
            seatLocation: "N/A"
          }
        ]
      });
      setRefreshing(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/credentials`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies, authorizedID, csrf }),
      });
      const fresh = await res.json();
      setData(fresh);
    } catch (e) {
      console.error("Refresh failed", e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setChangedUsername(username);
    setChangedPassword(Array.isArray(password) ? password[0] : password);

    const { cookies, authorizedID, csrf } = creds;
    if (authorizedID === "DEMO123") {
      setData({
        credentials: [
          {
            account: "VTOP Student Portal",
            username: "22BCE1234",
            defaultCredentials: "demo-password-vtop",
            url: "https://vtop.vit.ac.in",
            venueDate: "Active Session",
            seatLocation: "N/A"
          },
          {
            account: "Koha Library Card",
            username: "22BCE1234",
            defaultCredentials: "demo-password-koha",
            url: "http://opac.vit.ac.in",
            venueDate: "N/A",
            seatLocation: "N/A"
          }
        ]
      });
      setLoading(false);
      return;
    }

    if (refreshKey === 0) {
      const cached = localStorage.getItem("cache_credentials");
      if (cached) {
        try {
          setData(JSON.parse(cached));
          setLoading(false);
          return;
        } catch (e) {}
      }
    }

    fetch(`${API_BASE}/api/credentials`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cookies, authorizedID, csrf }),
    }).then(r => r.json()).then(res => {
      if (res?.credentials || res?.ranks || res?.tables) {
        setData(res);
      } else {
        console.warn("Credentials API returned unexpected format:", res);
      }
    }).catch((e) => console.error("Credentials fetch error:", e)).finally(() => setLoading(false));
  }, [refreshKey, creds, username, password]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
      </div>
    );
  }

  const accounts = data?.credentials ||
    data?.tables?.[0]?.rows?.map((r: any) => {
      const h = data.tables[0].headers || [];
      return { account: r[h[0]] || "", username: r[h[1]] || "", defaultCredentials: r[h[2]] || "", url: r[h[3]] || "", venueDate: r[h[4]] || "", seatLocation: r[h[5]] || "" };
    }) ||
    [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end mb-2">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50  dark:bg-blue-900/30 text-blue-600  dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-all text-sm font-semibold disabled:opacity-50"
        >
          <RefreshCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {accounts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {accounts.map((row: any, idx: number) => {
            const accountName = row.account || "";
            const userName = row.username || "";
            const pass = row.defaultCredentials || "";
            const url = row.url || "";
            const venueDate = row.venueDate || "";
            const seat = row.seatLocation || "";
            return (
              <div key={idx} className="relative group solid-card hover:shadow-lg transition-shadow">
                <div className="px-5 py-4 border-b border-gray-100/50  dark:border-gray-800/50 flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <h4 className="font-semibold text-gray-900  dark:text-gray-100 text-sm">{accountName}</h4>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-gray-400  dark:text-gray-500 uppercase tracking-wider mb-1">Username</p>
                      <p className="text-sm font-medium text-gray-800  dark:text-gray-200 truncate">{userName}</p>
                    </div>
                    <button onClick={() => copyToClipboard(userName)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 dark:hover:bg-gray-800 text-gray-400 hover:text-blue-500 transition-all shrink-0 active:scale-90" title="Copy username">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-gray-400  dark:text-gray-500 uppercase tracking-wider mb-1">Password</p>
                      <p className="text-sm text-gray-800  dark:text-gray-200 truncate font-mono tracking-wider">
                        {showPasswords[idx] ? pass : "•".repeat(Math.min(pass.length, 16))}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => toggleShow(idx)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 dark:hover:bg-gray-800 text-gray-400 hover:text-amber-500 transition-all active:scale-90" title={showPasswords[idx] ? "Hide" : "Show"}>
                        {showPasswords[idx] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => copyToClipboard(pass)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 dark:hover:bg-gray-800 text-gray-400 hover:text-blue-500 transition-all active:scale-90" title="Copy password">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {url && url !== "-" && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400  dark:text-gray-500 uppercase tracking-wider mb-1">URL</p>
                      {url.toLowerCase().startsWith("http") ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600  dark:text-blue-400 hover:underline truncate block">{url}</a>
                      ) : (
                        <p className="text-sm font-medium text-gray-800  dark:text-gray-200">{url}</p>
                      )}
                    </div>
                  )}
                  {venueDate && venueDate !== "-" && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400  dark:text-gray-500 uppercase tracking-wider mb-1">Venue & Date</p>
                      <p className="text-sm font-medium text-gray-800  dark:text-gray-200">{venueDate}</p>
                    </div>
                  )}
                  {seat && seat !== "-" && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400  dark:text-gray-500 uppercase tracking-wider mb-1">Seat</p>
                      <p className="text-sm font-medium text-gray-800  dark:text-gray-200">{seat}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* App Logins */}
      <div className="solid-card">
        <div className="px-5 py-4 border-b border-gray-100/50  dark:border-gray-800/50 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm">
            <User className="w-4 h-4 text-white" />
          </div>
          <h4 className="font-semibold text-gray-900  dark:text-gray-100 text-sm">App Logins</h4>
        </div>
        <div className="p-5 space-y-4 max-w-md">
          <div>
            <label className="text-xs font-semibold text-gray-400  dark:text-gray-500 uppercase tracking-wider mb-1.5 block">VTOP Username</label>
            <input type="text" value={changedUsername} onChange={(e) => setChangedUsername(e.target.value)} className="w-full text-sm text-gray-800  dark:text-gray-200 bg-gray-50  dark:bg-gray-800/50 px-3 py-2.5 rounded-xl border border-gray-200  dark:border-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400  dark:text-gray-500 uppercase tracking-wider mb-1.5 block">VTOP Password</label>
            <div className="relative">
              <input type={showAppPassword ? "text" : "password"} value={changedPassword} onChange={(e) => setChangedPassword(e.target.value)} className="w-full text-sm text-gray-800  dark:text-gray-200 bg-gray-50  dark:bg-gray-800/50 px-3 py-2.5 pr-10 rounded-xl border border-gray-200  dark:border-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
              <button onClick={() => setShowAppPassword(!showAppPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1" title={showAppPassword ? "Hide" : "Show"}>
                {showAppPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button onClick={() => setPassword([changedUsername, changedPassword])} disabled={!changedUsername || !changedPassword} className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-all active:scale-[0.98]">
            <Save className="w-4 h-4 inline mr-1.5" />Save
          </button>
        </div>
      </div>

      {/* Change VTOP Password */}
      <div className="solid-card">
        <div className="px-5 py-4 border-b border-gray-100/50  dark:border-gray-800/50 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-sm">
            <Lock className="w-4 h-4 text-white" />
          </div>
          <h4 className="font-semibold text-gray-900  dark:text-gray-100 text-sm">Change VTOP Password</h4>
        </div>
        <div className="p-5 space-y-4 max-w-md">
          <input type="password" value={vtopOldPassword} onChange={(e) => setVtopOldPassword(e.target.value)} placeholder="Current password" className="w-full text-sm text-gray-800  dark:text-gray-200 bg-gray-50  dark:bg-gray-800/50 px-3 py-2.5 rounded-xl border border-gray-200  dark:border-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
          <input type="password" value={vtopNewPassword} onChange={(e) => setVtopNewPassword(e.target.value)} placeholder="New password" className="w-full text-sm text-gray-800  dark:text-gray-200 bg-gray-50  dark:bg-gray-800/50 px-3 py-2.5 rounded-xl border border-gray-200  dark:border-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
          <input type="password" value={vtopConfirmPassword} onChange={(e) => setVtopConfirmPassword(e.target.value)} placeholder="Confirm new password" className="w-full text-sm text-gray-800  dark:text-gray-200 bg-gray-50  dark:bg-gray-800/50 px-3 py-2.5 rounded-xl border border-gray-200  dark:border-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
          {passwordChangeError && (
            <div className="flex items-center gap-2 text-sm text-red-600  dark:text-red-500 bg-red-50  dark:bg-red-900/20 px-4 py-3 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {passwordChangeError}
            </div>
          )}
          {passwordChangeSuccess && (
            <div className="flex items-center gap-2 text-sm text-emerald-600  dark:text-emerald-500 bg-emerald-50  dark:bg-emerald-900/20 px-4 py-3 rounded-xl">
              <CheckCircle className="w-4 h-4 shrink-0" />
              {passwordChangeSuccess}
            </div>
          )}
          <button onClick={handleChangeVtopPassword} disabled={passwordChangeLoading || !vtopOldPassword || !vtopNewPassword || !vtopConfirmPassword} className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-all active:scale-[0.98]">
            <Lock className="w-4 h-4 inline mr-1.5" />{passwordChangeLoading ? "Changing..." : "Change Password"}
          </button>
        </div>
      </div>

      <div className="relative solid-card">
        <div className="px-5 py-4 border-b border-gray-100/50  dark:border-gray-800/50 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <h4 className="font-semibold text-gray-900  dark:text-gray-100 text-sm">Library Card</h4>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="text" value={kohaCard} onChange={(e) => setKohaCard(e.target.value)} placeholder="Card Number (e.g. 25BLC1081)" className="w-full text-sm text-gray-800  dark:text-gray-200 bg-gray-50  dark:bg-gray-800/50 px-3 py-2.5 rounded-xl border border-gray-200  dark:border-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
            <input type="password" value={kohaPassword} onChange={(e) => setKohaPassword(e.target.value)} placeholder="Library Password" className="w-full text-sm text-gray-800  dark:text-gray-200 bg-gray-50  dark:bg-gray-800/50 px-3 py-2.5 rounded-xl border border-gray-200  dark:border-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400  dark:text-gray-500">Used to log into your Koha library account</p>
            <button onClick={saveKoha} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-all active:scale-[0.98] flex items-center gap-1.5">
              <Save className="w-4 h-4" />{kohaSaved ? "Saved!" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


