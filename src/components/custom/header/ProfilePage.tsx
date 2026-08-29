"use client";

import { API_BASE } from "../Main";
import TabHelpFooter from "../shared/TabHelpFooter";
import { setCustomApiUrl } from "@/lib/fetch-utils";
import {
  X,
  Save,
  LogOut,
  Eye,
  EyeOff,
  User,
  Link2,
  ExternalLink,
  Github,
  Database,
  Shield,
  FileText,
  ChevronRight,
  ChevronLeft,
  History,
  RefreshCcw,
  Trophy,
  Sliders,
  Settings,
  Bell,
  Info,
  Key,
  Grid,
  Search,
  CheckCircle,
  AlertCircle,
  Keyboard,
  Sparkles,
  Palette,
  Layers,
  GraduationCap,
  Home as HomeIcon,
  Volume2,
  VolumeX,
  Check,
  Edit3,
  Clock,
  Copy,
  BookOpen,
  Lock,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { Button, Switch, Skeleton } from "@amazecontinuityprojects/amazeui";
import { getAssetPath } from "@/lib/utils";
import config from "../../../../config.json";
import Links from "./Links";
import PushNotificationManager from "@/app/pushNotificationManager";
import quickLinks from "../../../data/quickLinks.json";
import DataPage from "../footer/DataPage";
import { IconToggle } from "../Toggle";
import ChangelogModal from "./ChangelogModal";
import HallOfFameModal from "./HallOfFameModal";
import ProfileStatusCards from "../profile/ProfileStatusCards";
import AcknowledgementCards from "../profile/AcknowledgementCards";
import { Badge, Modal, useIsMobile } from "../shared";
import GenericApiView, { clearApiCache } from "../exams/GenericApiView";
import { useTheme } from "next-themes";
import { m, AnimatePresence } from "framer-motion";

export type SectionId =
  | "profile"
  | "credentials"
  | "preferences"
  | "academic"
  | "sync"
  | "navigation"
  | "advanced"
  | "about";

export interface SectionConfig {
  id: SectionId;
  label: string;
  subtitle: string;
  icon: any;
  iconBg: string;
  iconColor: string;
}

export const SECTIONS: SectionConfig[] = [
  {
    id: "profile",
    label: "Student Profile",
    subtitle: "Personal information, mentors, residential status, and records",
    icon: User,
    iconBg: "bg-blue-500/10 dark:bg-blue-500/20",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  {
    id: "credentials",
    label: "VTOP Credentials",
    subtitle: "Portal logins, password change, and stored session keys",
    icon: Key,
    iconBg: "bg-amber-500/10 dark:bg-amber-500/20",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  {
    id: "preferences",
    label: "Appearance & Theme",
    subtitle: "Theme modes, color palettes, dashboard layouts, and privacy",
    icon: Palette,
    iconBg: "bg-purple-500/10 dark:bg-purple-500/20",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
  {
    id: "academic",
    label: "Academic & Schedule",
    subtitle: "Active term semesters, target attendance, and residential status",
    icon: GraduationCap,
    iconBg: "bg-indigo-500/10 dark:bg-indigo-500/20",
    iconColor: "text-indigo-600 dark:text-indigo-400",
  },
  {
    id: "sync",
    label: "Data Sync & Cache",
    subtitle: "Auto-refresh intervals, low data mode, and background sync modules",
    icon: RefreshCcw,
    iconBg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "navigation",
    label: "Mobile & Navigation",
    subtitle: "Pinned bottom bar tabs, compact views, and push notifications",
    icon: Grid,
    iconBg: "bg-sky-500/10 dark:bg-sky-500/20",
    iconColor: "text-sky-600 dark:text-sky-400",
  },
  {
    id: "advanced",
    label: "Advanced & System",
    subtitle: "Local storage database, custom API endpoints, backup, and restore",
    icon: Shield,
    iconBg: "bg-rose-500/10 dark:bg-rose-500/20",
    iconColor: "text-rose-600 dark:text-rose-400",
  },
  {
    id: "about",
    label: "About & Community",
    subtitle: "Version history, changelog, hall of fame, and useful campus links",
    icon: Info,
    iconBg: "bg-cyan-500/10 dark:bg-cyan-500/20",
    iconColor: "text-cyan-600 dark:text-cyan-400",
  },
];

const COLOR_PALETTES = [
  { id: "default", label: "Default", swatches: ["#0ea5e9", "#ffffff", "#f8fafc"] },
  { id: "neonPink", label: "Neon Pink", swatches: ["#ff2bd6", "#ffffff", "#fff7fd"] },
  { id: "forest", label: "Forest", swatches: ["#059669", "#ffffff", "#f7fee7"] },
  { id: "rose", label: "Rose", swatches: ["#e11d48", "#ffffff", "#fff1f2"] },
  { id: "amber", label: "Amber", swatches: ["#d97706", "#ffffff", "#fffbeb"] },
  { id: "custom", label: "Custom", swatches: ["#0ea5e9", "#ffffff", "#f8fafc"] },
];

export default function ProfilePage({
  currSemesterID,
  setCurrSemesterID,
  handleLogin,
  setIsReloading,
  handleLogOutRequest,
  username,
  password,
  setPassword,
  decimalValues,
  setDecimalValues,
  isDayscholarWithBus,
  setIsDayscholarWithBus,
  residentialStatus,
  setResidentialStatus,
  calendarType,
  setCalendarType,
  hideMobileHeader,
  setHideMobileHeader,
  reloadAllData,
  setReloadAllData,
  isLoggedIn,
  friendlyName,
  setFriendlyName,
  loginToVTOP,
  creds,
  refreshKey,
  onCardClick,
  onCredentialsClick,
  onReload,
  settings,
  setSettings,
  mode = "settings",
  onOpenShortcutsHelp,
}: any) {
  const isMobile = useIsMobile();
  const [activeDesktopSection, setActiveDesktopSection] = useState<SectionId>(
    mode === "info" ? "profile" : mode === "credentials" ? "credentials" : "profile"
  );
  const [activeMobileSubmenu, setActiveMobileSubmenu] = useState<SectionId | null>(
    mode === "info" ? "profile" : mode === "credentials" ? "credentials" : null
  );

  const [selectedSemester, setSelectedSemester] = useState<string>(currSemesterID);
  const [appIcon, setAppIcon] = useState<string>("default");
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [tempFriendlyName, setTempFriendlyName] = useState<string>(friendlyName || "");
  const [searchQuery, setSearchQuery] = useState("");

  const [customApiInput, setCustomApiInput] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("amazecc_custom_api_url") || "";
    }
    return "";
  });

  const [profileData, setProfileData] = useState<any>(null);
  const [profileImages, setProfileImages] = useState<any>(null);
  const [hostelInfo, setHostelInfo] = useState<any>(null);

  // Modals & Credential States
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const closeModal = () => setActiveModal(null);
  const handleCardClick = (id: string) => {
    setActiveModal(id);
    onCardClick?.(id);
  };

  const [showStoragePage, setShowStoragePage] = useState<boolean>(false);
  const [storageData, setStorageData] = useState<Record<string, string | null>>({});
  const [showChangelog, setShowChangelog] = useState<boolean>(false);
  const [showHallOfFame, setShowHallOfFame] = useState<boolean>(false);

  // Credentials Section States
  const [credData, setCredData] = useState<any>(null);
  const [credLoading, setCredLoading] = useState(true);
  const [changedUsername, setChangedUsername] = useState(username || "");
  const [changedPassword, setChangedPassword] = useState(
    Array.isArray(password) ? password[0] : password || ""
  );
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});
  const [showAppPassword, setShowAppPassword] = useState(false);
  const [vtopOldPassword, setVtopOldPassword] = useState("");
  const [vtopNewPassword, setVtopNewPassword] = useState("");
  const [vtopConfirmPassword, setVtopConfirmPassword] = useState("");
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState<string | null>(null);
  const [refreshingCreds, setRefreshingCreds] = useState(false);
  const [kohaCard, setKohaCard] = useState("");
  const [kohaPassword, setKohaPassword] = useState("");
  const [kohaSaved, setKohaSaved] = useState(false);

  const { theme, setTheme } = useTheme();

  const activePalette =
    settings?.colorPalette === "ocean" ? "neonPink" : settings?.colorPalette || "default";
  const customPalette = settings?.customPalette || {
    accent: "#0ea5e9",
    background: "#f8fafc",
    surface: "#ffffff",
  };
  const displayProfileImage = settings?.showProfilePhoto || mode === "info";

  const updateSetting = (key: string, value: any) => {
    setSettings((prev: any) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem("settings", JSON.stringify(next));
      return next;
    });
  };

  const handleToggleAllSync = (enable: boolean) => {
    setSettings((prev: any) => {
      const next = {
        ...prev,
        syncExcRegistration: enable,
        syncMinorHonour: enable,
        syncCourseCompletion: enable,
        syncProfileData: enable,
      };
      localStorage.setItem("settings", JSON.stringify(next));
      return next;
    });
  };

  const updateCustomPalette = (key: "accent" | "background" | "surface", value: string) => {
    const nextPalette = { ...customPalette, [key]: value };
    setSettings((prev: any) => {
      const next = { ...prev, colorPalette: "custom", customPalette: nextPalette };
      localStorage.setItem("settings", JSON.stringify(next));
      return next;
    });
  };

  const handleSaveSemester = async () => {
    if (!selectedSemester) return;
    setIsReloading(true);
    await handleLogin(selectedSemester);
    setCurrSemesterID(selectedSemester);
  };

  const handleThemeChange = (val: string) => {
    if (theme === val) return;
    if (typeof document !== "undefined" && (document as any).startViewTransition) {
      (document as any).startViewTransition(() => {
        setTheme(val);
      });
    } else {
      setTheme(val);
    }
  };

  const handleIconChange = (icon: string) => {
    setAppIcon(icon);
    localStorage.setItem("app-icon", icon);
    window.dispatchEvent(new Event("app-icon-changed"));
  };

  const saveCustomApiUrl = () => {
    if (customApiInput) {
      setCustomApiUrl(customApiInput);
      alert("Custom API endpoint saved! Please refresh the application to apply changes.");
    }
  };

  const clearCustomApiUrl = () => {
    setCustomApiInput("");
    setCustomApiUrl("");
    alert("API endpoint reset to default. Please refresh the application.");
  };

  const openStoragePage = () => {
    const data: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const value = localStorage.getItem(key);
      if (value !== null) data[key] = value;
    }
    setStorageData(data);
    setShowStoragePage(true);
  };

  const handleDeleteItem = (key: string) => {
    localStorage.removeItem(key);
    setStorageData((prev) => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  const handleResetCache = () => {
    if (confirm("Are you sure you want to reset all cached data? You will need to log in again.")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleExportSettings = () => {
    const data = {
      settings: localStorage.getItem("settings"),
      appIcon: localStorage.getItem("app-icon"),
      friendlyName: localStorage.getItem("friendlyName"),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "amazecc-settings-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSettings = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event: any) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (parsed.settings) localStorage.setItem("settings", parsed.settings);
          if (parsed.appIcon) localStorage.setItem("app-icon", parsed.appIcon);
          if (parsed.friendlyName) localStorage.setItem("friendlyName", parsed.friendlyName);
          window.location.reload();
        } catch (err) {
          alert("Invalid settings backup file.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

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

  const toggleShow = (idx: number) => setShowPasswords((p) => ({ ...p, [idx]: !p[idx] }));

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
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
      const vtopCreds = loginToVTOP ? await loginToVTOP() : creds;
      if (!vtopCreds || !vtopCreds.cookies) {
        throw new Error("Failed to authenticate session with VTOP");
      }
      const { cookies, authorizedID, csrf } = vtopCreds;
      const res = await fetch(`${API_BASE}/api/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cookies,
          authorizedID,
          csrf,
          oldPassword: vtopOldPassword,
          newPassword: vtopNewPassword,
          confirmNewPassword: vtopConfirmPassword,
        }),
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

  const handleRefreshCreds = async () => {
    setRefreshingCreds(true);
    clearApiCache();
    if (!creds || !creds.cookies) {
      setRefreshingCreds(false);
      return;
    }
    const { cookies, authorizedID, csrf } = creds;
    if (authorizedID === "DEMO123" || username === "demo") {
      await new Promise((resolve) => setTimeout(resolve, 300));
      setCredData({
        credentials: [
          {
            account: "VTOP Student Portal",
            username: "22BCE1234",
            defaultCredentials: "demo-password-vtop",
            url: "https://vtopcc.vit.ac.in",
            venueDate: "Active Session",
            seatLocation: "N/A",
          },
          {
            account: "Koha Library Card",
            username: "22BCE1234",
            defaultCredentials: "demo-password-koha",
            url: "http://opac.vit.ac.in",
            venueDate: "N/A",
            seatLocation: "N/A",
          },
        ],
      });
      setRefreshingCreds(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies, authorizedID, csrf }),
      });
      const fresh = await res.json();
      setCredData(fresh);
    } catch (e) {
      console.error("Refresh failed", e);
    } finally {
      setRefreshingCreds(false);
    }
  };

  useEffect(() => {
    setCredLoading(true);
    setChangedUsername(username);
    setChangedPassword(Array.isArray(password) ? password[0] : password || "");

    if (!creds || !creds.cookies) {
      setCredLoading(false);
      return;
    }

    const { cookies, authorizedID, csrf } = creds;
    if (authorizedID === "DEMO123" || username === "demo") {
      setCredData({
        credentials: [
          {
            account: "VTOP Student Portal",
            username: "22BCE1234",
            defaultCredentials: "demo-password-vtop",
            url: "https://vtopcc.vit.ac.in",
            venueDate: "Active Session",
            seatLocation: "N/A",
          },
          {
            account: "Koha Library Card",
            username: "22BCE1234",
            defaultCredentials: "demo-password-koha",
            url: "http://opac.vit.ac.in",
            venueDate: "N/A",
            seatLocation: "N/A",
          },
        ],
      });
      setCredLoading(false);
      return;
    }

    if (refreshKey === 0) {
      const cached = localStorage.getItem("cache_credentials");
      if (cached) {
        try {
          setCredData(JSON.parse(cached));
          setCredLoading(false);
          return;
        } catch (e) {}
      }
    }

    fetch(`${API_BASE}/api/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cookies, authorizedID, csrf }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res?.credentials || res?.ranks || res?.tables) {
          setCredData(res);
        }
      })
      .catch((e) => console.error("Credentials fetch error:", e))
      .finally(() => setCredLoading(false));
  }, [refreshKey, creds, username, password]);

  useEffect(() => {
    setSelectedSemester(currSemesterID);
    setAppIcon(localStorage.getItem("app-icon") || "default");

    if (username === "demo") {
      setProfileData({
        name: "Demo Student",
        branch: "B.Tech Computer Science & Engineering",
        isHosteller: true,
        nativeLanguage: "English",
        nativeState: "Tamil Nadu",
        nationality: "Indian",
        community: "General",
        religion: "None",
        caste: "General",
        physicallyChallenged: "No",
        mobileNumber: "+91 99999 99999",
        friendMobileNumber: "+91 88888 88888",
        aadharNumber: "XXXX-XXXX-XXXX",
        bloodGroup: "O+",
        currentAddress: {
          line1: "VIT Chennai Campus",
          line2: "Vandalur-Kelambakkam Road",
          city: "Chennai",
          pincode: "600127",
        },
        permanentAddress: {
          line1: "VIT Chennai Campus",
          line2: "Vandalur-Kelambakkam Road",
          city: "Chennai",
          pincode: "600127",
        },
      });
      setHostelInfo({ blockName: "D-Block", roomNo: "402" });
      return;
    }

    const storedProfile = localStorage.getItem("profile");
    if (storedProfile) {
      try {
        setProfileData(JSON.parse(storedProfile));
      } catch (e) {
        console.error(e);
      }
    }
    const storedImages = localStorage.getItem("profileImages");
    if (storedImages) {
      try {
        setProfileImages(JSON.parse(storedImages));
      } catch (e) {
        console.error(e);
      }
    }
    const storedHostel = localStorage.getItem("hostel");
    if (storedHostel) {
      try {
        const parsed = JSON.parse(storedHostel);
        setHostelInfo(parsed.hostelInfo || parsed);
      } catch (e) {
        console.error(e);
      }
    }
  }, [currSemesterID, username]);

  useEffect(() => {
    if (!creds || !creds.cookies) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/student`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cookies: creds.cookies,
            authorizedID: creds.authorizedID,
            csrf: creds.csrf,
          }),
        });
        const data = await res.json();
        if (data?.profile) {
          setProfileData(data.profile);
          localStorage.setItem("profile", JSON.stringify(data.profile));
        }
      } catch (e) {
        console.error("Failed to fetch profile", e);
      }
    })();
  }, [creds]);

  const autoInferred = useRef(false);
  useEffect(() => {
    if (!profileData || autoInferred.current) return;
    autoInferred.current = true;
    if (profileData.isHosteller === false && residentialStatus === "hosteller") {
      setResidentialStatus("dayscholar");
    }
    try {
      const transportData = JSON.parse(localStorage.getItem("transportData") || "null");
      if (transportData?.hasRegistration === true) {
        setIsDayscholarWithBus(true);
        if (residentialStatus === "hosteller") setResidentialStatus("dayscholar");
      }
    } catch (_) {}
  }, [profileData]);

  // Unified available sections
  const availableSections = useMemo(() => {
    return SECTIONS;
  }, []);

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return availableSections;
    const q = searchQuery.toLowerCase().trim();
    return availableSections.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.subtitle.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
    );
  }, [availableSections, searchQuery]);

  const credAccounts =
    credData?.credentials ||
    credData?.tables?.[0]?.rows?.map((r: any) => {
      const h = credData.tables[0].headers || [];
      return {
        account: r[h[0]] || "",
        username: r[h[1]] || "",
        defaultCredentials: r[h[2]] || "",
        url: r[h[3]] || "",
        venueDate: r[h[4]] || "",
        seatLocation: r[h[5]] || "",
      };
    }) ||
    [];

  /* ─────────────────────────────────────────────────────────────
     RENDER: Category Specific Setting Blocks
  ───────────────────────────────────────────────────────────── */

  // 1. Student Info Section
  const renderProfileContent = () => (
    <div className="space-y-6">
      {creds && (
        <>
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-1">
              Academic & Identity Status
            </h3>
            <ProfileStatusCards
              creds={creds}
              refreshKey={refreshKey}
              onCardClick={handleCardClick}
            />
          </div>

          <AcknowledgementCards creds={creds} refreshKey={refreshKey} />

          {profileImages?.proctor && (
            <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 sm:p-6 space-y-4 shadow-2xs">
              <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white font-outfit">
                Faculty Mentors & Leadership
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    role: "Proctor",
                    photo: profileImages.proctor.photoBase64,
                    details: profileImages.proctor.details || {},
                  },
                  ...(profileImages.hodDean?.people?.map((p: any) => ({
                    role: p.role,
                    photo: p.photoBase64,
                    details: p.details || {},
                  })) || []),
                ].map((person, idx) => (
                  <div
                    key={idx}
                    className="bg-zinc-50/80 dark:bg-zinc-950/60 p-4 sm:p-5 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 flex items-start gap-4"
                  >
                    {person.photo ? (
                      <img
                        src={person.photo}
                        alt={person.role}
                        className="w-14 h-14 rounded-2xl object-cover shadow-xs border border-zinc-200 dark:border-zinc-800 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs shrink-0">
                        <User size={24} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-0.5">
                        {person.role}
                      </span>
                      <p className="font-extrabold text-sm text-zinc-900 dark:text-white truncate font-outfit">
                        {person.details.name || "N/A"}
                      </p>
                      {person.details.designation && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                          {person.details.designation}
                        </p>
                      )}
                      <div className="mt-3 space-y-1 text-xs text-zinc-500 dark:text-zinc-400 border-t border-zinc-200/60 dark:border-zinc-800/60 pt-2">
                        {Object.entries(person.details)
                          .filter(([k]) => k !== "name" && k !== "designation")
                          .map(([k, val]) => (
                            <div key={k} className="truncate text-[11px]">
                              <span className="capitalize font-semibold text-zinc-400 dark:text-zinc-500">
                                {k.replace(/([A-Z])/g, " $1").trim()}:{" "}
                              </span>
                              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                                {String(val)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Personal Info Grid */}
      <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 sm:p-6 space-y-6 shadow-2xs">
        {[
          profileData?.nativeLanguage,
          profileData?.nationality,
          profileData?.community,
          profileData?.aadharNumber,
          profileData?.mobileNumber,
        ].some(Boolean) && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white font-outfit">
                Personal Information
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Official profile records retrieved from university portal
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
              {[
                ["Native Language", profileData.nativeLanguage],
                ["Native State", profileData.nativeState],
                ["Nationality", profileData.nationality],
                ["Community", profileData.community],
                ["Religion", profileData.religion],
                ["Caste", profileData.caste],
                ["Physically Challenged", profileData.physicallyChallenged],
                ["Mobile Number", profileData.mobileNumber],
                ["Friend Mobile", profileData.friendMobileNumber],
                ["Aadhar Number", profileData.aadharNumber],
                ["Blood Group", profileData.bloodGroup],
                [
                  "Hostel Status",
                  profileData.isHosteller
                    ? `${hostelInfo?.blockName || "Hostel"} - Room ${hostelInfo?.roomNo || "N/A"}`
                    : "Day Scholar",
                ],
              ]
                .filter(([, v]) => v)
                .map(([label, val]) => (
                  <div
                    key={String(label)}
                    className="p-3.5 rounded-2xl bg-zinc-50/80 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-850 space-y-1"
                  >
                    <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                      {String(label)}
                    </p>
                    <p className="font-extrabold text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 break-words font-outfit">
                      {String(val)}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {(profileData?.currentAddress || profileData?.permanentAddress) && (
          <div className="space-y-4 border-t border-zinc-150 dark:border-zinc-800/80 pt-5">
            <div>
              <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white font-outfit">
                Address Records
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Registered residential and communication addresses
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {profileData.currentAddress && (
                <div className="bg-zinc-50/80 dark:bg-zinc-950/60 p-4 sm:p-5 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 space-y-3">
                  <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                    Current Address
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {Object.entries(profileData.currentAddress)
                      .filter(([, v]) => v)
                      .map(([k, val]) => (
                        <div key={k}>
                          <p className="text-[10px] text-zinc-400 capitalize mb-0.5">{k}</p>
                          <p className="font-bold text-zinc-800 dark:text-zinc-200 break-words">
                            {String(val)}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {profileData.permanentAddress && (
                <div className="bg-zinc-50/80 dark:bg-zinc-950/60 p-4 sm:p-5 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 space-y-3">
                  <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                    Permanent Address
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {Object.entries(profileData.permanentAddress)
                      .filter(([, v]) => v)
                      .map(([k, val]) => (
                        <div key={k}>
                          <p className="text-[10px] text-zinc-400 capitalize mb-0.5">{k}</p>
                          <p className="font-bold text-zinc-800 dark:text-zinc-200 break-words">
                            {String(val)}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // 2. VTOP Credentials & Security Section
  const renderCredentialsContent = () => (
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

  // 2. Appearance & Theme Section
  const renderPreferencesContent = () => (
    <div className="space-y-6">
      {/* Theme & Layout Card */}
      <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 space-y-5 shadow-2xs">
        <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white font-outfit">
          Theme & Display Mode
        </h3>

        {/* Theme Mode Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-850">
          <div>
            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Theme Mode</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Seamlessly switch between Light and Dark aesthetics
            </p>
          </div>
          <div className="flex rounded-xl bg-zinc-200/70 dark:bg-zinc-800 p-1 w-full sm:w-56 shrink-0">
            <button
              onClick={() => handleThemeChange("light")}
              className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
                theme === "light"
                  ? "bg-white text-indigo-600 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400"
              }`}
            >
              Light
            </button>
            <button
              onClick={() => handleThemeChange("dark")}
              className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
                theme === "dark"
                  ? "bg-zinc-900 text-indigo-400 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400"
              }`}
            >
              Dark
            </button>
          </div>
        </div>

        {/* Dashboard Layout Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-850">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Dashboard Layout</p>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event("open-interface-selector"))}
                className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40 hover:bg-indigo-100 transition-colors cursor-pointer"
              >
                Visual Picker
              </button>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Select your default landing and widget configuration
            </p>
          </div>
          <select
            value={
              settings?.defaultLandingTab === "attendance"
                ? "attendance"
                : settings?.dashboardViewMode || "simplified"
            }
            onChange={(e) => {
              const val = e.target.value;
              if (val === "attendance") {
                updateSetting("defaultLandingTab", "attendance");
                updateSetting("dashboardViewMode", "simplified");
              } else {
                updateSetting("defaultLandingTab", "home");
                updateSetting("dashboardViewMode", val);
              }
              updateSetting("interfaceChosen", true);
            }}
            className="w-full sm:w-64 text-xs font-semibold border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0 cursor-pointer"
          >
            <option value="simplified">✨ Minimal (Timetable & Stat Cards)</option>
            <option value="classic">📱 Classic (Multi-Widget View)</option>
            <option value="attendance">📊 Direct Attendance (Instant Tracker)</option>
          </select>
        </div>

        {/* Timetable Pill Style */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-850">
          <div>
            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
              Timetable Class Density
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Choose between compact 2-line cards or spacious multi-line cards
            </p>
          </div>
          <select
            value={settings?.timetablePillStyle || "compact"}
            onChange={(e) => updateSetting("timetablePillStyle", e.target.value)}
            className="w-full sm:w-64 text-xs font-semibold border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0 cursor-pointer"
          >
            <option value="compact">📋 Compact (2-Line Info + Percentage on Right)</option>
            <option value="detailed">🃏 Detailed (Spacious Multi-line Card)</option>
          </select>
        </div>
      </div>

      {/* Privacy & Visibility Toggles Card */}
      <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 space-y-4 shadow-2xs">
        <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white font-outfit">
          Privacy & Visibility
        </h3>

        <div className="divide-y divide-zinc-150 dark:divide-zinc-800/60">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                Grades Anonymizer Mode
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Blur CGPA, GPA, and course grades to protect privacy in public (hover to reveal)
              </p>
            </div>
            <Switch
              checked={settings?.blurGrades ?? false}
              onCheckedChange={(val) => updateSetting("blurGrades", val)}
            />
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                Show GPA on Dashboard
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Display cumulative CGPA score cards on the home page and sidebar
              </p>
            </div>
            <Switch
              checked={settings?.showGpa ?? false}
              onCheckedChange={(val) => updateSetting("showGpa", val)}
            />
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                Show Profile Photo
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Render student avatar in headers, navigation rails, and profile cards
              </p>
            </div>
            <Switch
              checked={settings?.showProfilePhoto ?? false}
              onCheckedChange={(val) => updateSetting("showProfilePhoto", val)}
            />
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                Sound & Action Audio
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Play subtle audio feedback when completing tasks or toggling states
              </p>
            </div>
            <Switch
              checked={settings?.soundEnabled ?? true}
              onCheckedChange={(val) => updateSetting("soundEnabled", val)}
            />
          </div>
        </div>
      </div>

      {/* Color Palette Card */}
      <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 space-y-4 shadow-2xs">
        <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white font-outfit">
          Color Palette & Accent
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Personalize the interface accent colors and gradient accents
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
          {COLOR_PALETTES.map((palette) => (
            <button
              key={palette.id}
              type="button"
              onClick={() => updateSetting("colorPalette", palette.id)}
              className={`flex items-center justify-between gap-2 rounded-xl border p-3 text-left transition-all cursor-pointer ${
                activePalette === palette.id
                  ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 ring-1 ring-indigo-500/20"
                  : "border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
              }`}
            >
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                {palette.label}
              </span>
              <span className="flex -space-x-1">
                {palette.swatches.map((color) => (
                  <span
                    key={color}
                    className="h-4 w-4 rounded-full border border-white/70 dark:border-zinc-900 shadow-xs"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </span>
            </button>
          ))}
        </div>

        {activePalette === "custom" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3.5 bg-zinc-50/60 dark:bg-zinc-950/40 mt-3">
            {[
              ["accent", "Accent Color"],
              ["background", "Background"],
              ["surface", "Surface Card"],
            ].map(([key, label]) => (
              <label
                key={key}
                className="flex items-center justify-between gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300"
              >
                <span>{label}</span>
                <input
                  type="color"
                  value={customPalette[key as "accent" | "background" | "surface"]}
                  onChange={(e) =>
                    updateCustomPalette(key as "accent" | "background" | "surface", e.target.value)
                  }
                  className="h-8 w-12 cursor-pointer rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent p-0.5"
                />
              </label>
            ))}
          </div>
        )}
      </div>

      {/* App Icon Card */}
      <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 space-y-4 shadow-2xs">
        <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white font-outfit">
          Application Icon
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Choose which icon is displayed across header brandings
        </p>

        <div className="flex gap-4 pt-1">
          <button
            onClick={() => handleIconChange("default")}
            className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all cursor-pointer ${
              appIcon === "default"
                ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 ring-1 ring-indigo-500/20"
                : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
            }`}
          >
            <img
              src={getAssetPath("/logo.png")}
              alt="Default Icon"
              className="w-12 h-12 rounded-xl shadow-xs"
            />
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Default</span>
          </button>
          <button
            onClick={() => handleIconChange("fire")}
            className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all cursor-pointer ${
              appIcon === "fire"
                ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 ring-1 ring-indigo-500/20"
                : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
            }`}
          >
            <img
              src={getAssetPath("/images/icons/fire.png")}
              alt="Fire Icon"
              className="w-12 h-12 rounded-xl shadow-xs"
            />
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Fire</span>
          </button>
        </div>
      </div>
    </div>
  );

  // 3. Academic & Schedule Section
  const renderAcademicContent = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 space-y-5 shadow-2xs">
        <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white font-outfit">
          Semester & Terms
        </h3>

        {/* Active Semester Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-850">
          <div>
            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Active Semester</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Select term to fetch attendance, marks, and timetable
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-80 shrink-0">
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="flex-1 text-xs font-semibold border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {config.semesterIDs?.map((id: string, index: number) => (
                <option key={index} value={id}>
                  {id.endsWith("01")
                    ? "FALLSEM"
                    : id.endsWith("05")
                    ? "WINTERSEM"
                    : id.endsWith("07")
                    ? "SUMMERSEM"
                    : "TERM"}{" "}
                  {id.slice(4, -4)}-{id.slice(6, -2)}
                </option>
              ))}
            </select>
            <Button
              onClick={handleSaveSemester}
              disabled={!selectedSemester || selectedSemester === currSemesterID}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3.5 py-2 rounded-xl"
            >
              <Save size={14} className="mr-1.5" /> Save
            </Button>
          </div>
        </div>

        {/* Academic Calendar Dropdown */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-850">
          <div>
            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Academic Calendar</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Default calendar scheme for exam dates and working days
            </p>
          </div>
          <select
            value={calendarType || "ALL"}
            onChange={(e) => setCalendarType(e.target.value)}
            className="w-full sm:w-80 text-xs font-semibold border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0 cursor-pointer"
          >
            <option value="ALL">General Semester</option>
            <option value="ALL02">General Flexible</option>
            <option value="ALL03">General Freshers</option>
            <option value="ALL05">General LAW</option>
            <option value="ALL06">Flexible Freshers</option>
            <option value="ALL08">Cohort LAW</option>
            <option value="ALL11">Flexible Research</option>
            <option value="WEI">Weekend Intra Semester</option>
          </select>
        </div>

        {/* Target Attendance Threshold */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-850">
          <div>
            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
              Target Attendance Goal
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Target threshold for safe bunk margin calculations
            </p>
          </div>
          <select
            value={settings?.targetAttendance ?? 75}
            onChange={(e) => updateSetting("targetAttendance", parseInt(e.target.value))}
            className="w-full sm:w-80 text-xs font-bold border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0 cursor-pointer"
          >
            <option value={75}>75% (Standard Exam Eligibility)</option>
            <option value={80}>80% (Safety Buffer)</option>
            <option value={85}>85% (Bus Registration / Dayscholar Goal)</option>
            <option value={90}>90% (Distinction Honor Target)</option>
          </select>
        </div>

        {/* Precision Decimal Toggle */}
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
              Use One Decimal Place
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Round attendance stats and scores to 1 decimal place instead of 2
            </p>
          </div>
          <Switch checked={decimalValues} onCheckedChange={setDecimalValues} />
        </div>
      </div>

      {/* Residential & Hostel Card */}
      <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 space-y-4 shadow-2xs">
        <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white font-outfit">
          Residential Status & Mess
        </h3>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-850">
          <div>
            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Hostel vs Day Scholar</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Affects mess menu shortcuts and gate pass integrations
            </p>
          </div>
          <div className="flex rounded-xl bg-zinc-200/70 dark:bg-zinc-800 p-1 w-full sm:w-56 shrink-0">
            <button
              onClick={() => {
                setResidentialStatus("hosteller");
                setIsDayscholarWithBus(false);
              }}
              className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
                residentialStatus === "hosteller"
                  ? "bg-white text-indigo-600 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400"
              }`}
            >
              Hosteller
            </button>
            <button
              onClick={() => setResidentialStatus("dayscholar")}
              className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
                residentialStatus === "dayscholar"
                  ? "bg-white text-indigo-600 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400"
              }`}
            >
              Dayscholar
            </button>
          </div>
        </div>

        {residentialStatus === "dayscholar" && (
          <label className="flex items-center gap-3 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-850 cursor-pointer">
            <input
              type="checkbox"
              checked={isDayscholarWithBus}
              onChange={(e) => setIsDayscholarWithBus(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
              Registered for University Transport / Bus
            </span>
          </label>
        )}

        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
              Smart Mess Menu Auto-Filter
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Auto-select meal schedule based on current week of the month
            </p>
          </div>
          <Switch
            checked={settings?.smartMessFilter ?? false}
            onCheckedChange={(val) => updateSetting("smartMessFilter", val)}
          />
        </div>
      </div>
    </div>
  );

  // 4. Data Sync Section
  const renderSyncContent = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 space-y-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-150 dark:border-zinc-800/80 pb-4">
          <div>
            <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white font-outfit">
              Data Synchronization Policies
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Choose which modules refresh automatically to conserve data and API limits
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => handleToggleAllSync(true)}
              className="px-3 py-1.5 text-xs font-extrabold rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40 hover:bg-indigo-100 transition-colors cursor-pointer"
            >
              Enable All
            </button>
            <button
              onClick={() => handleToggleAllSync(false)}
              className="px-3 py-1.5 text-xs font-extrabold rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 transition-colors cursor-pointer"
            >
              Disable All
            </button>
          </div>
        </div>

        {/* Background Sync Frequency */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-850">
          <div>
            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
              Background Auto-Refresh Frequency
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Periodic timetable and marks check in the background
            </p>
          </div>
          <select
            value={settings?.autoSyncInterval || "off"}
            onChange={(e) => updateSetting("autoSyncInterval", e.target.value)}
            className="w-full sm:w-64 text-xs font-semibold border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0 cursor-pointer"
          >
            <option value="off">Off (Manual Refresh Only)</option>
            <option value="15m">Every 15 Minutes</option>
            <option value="30m">Every 30 Minutes</option>
            <option value="1h">Every 1 Hour</option>
          </select>
        </div>

        {/* Sync Toggles List */}
        <div className="divide-y divide-zinc-150 dark:divide-zinc-800/60">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                Sync Profile & Hosteller Data
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Credentials, contact numbers, and hostel room information
              </p>
            </div>
            <Switch
              checked={settings?.syncProfileData ?? true}
              onCheckedChange={(val) => updateSetting("syncProfileData", val)}
            />
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                Sync Extra-Curricular (EXC) Registration
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Clubs, chapters, and co-curricular credit allocations
              </p>
            </div>
            <Switch
              checked={settings?.syncExcRegistration ?? true}
              onCheckedChange={(val) => updateSetting("syncExcRegistration", val)}
            />
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                Sync Minor & Honour Registrations
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Minor degrees and honour program course completions
              </p>
            </div>
            <Switch
              checked={settings?.syncMinorHonour ?? true}
              onCheckedChange={(val) => updateSetting("syncMinorHonour", val)}
            />
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                Reload All Data on Global Refresh
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Refresh button triggers a full multi-module sweep instead of attendance only
              </p>
            </div>
            <Switch checked={reloadAllData} onCheckedChange={setReloadAllData} />
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                Low Data Saver Mode
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Disables automatic prefetching of heavy assets on metered connections
              </p>
            </div>
            <Switch
              checked={settings?.lowDataMode ?? false}
              onCheckedChange={(val) => updateSetting("lowDataMode", val)}
            />
          </div>
        </div>
      </div>
    </div>
  );

  // 5. Navigation & Mobile Section
  const renderNavigationContent = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 space-y-5 shadow-2xs">
        <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white font-outfit">
          Mobile Bottom Navigation Bar
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Pin up to 4 custom shortcuts to your bottom navigation bar for quick access. Home is
          always present.
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          {[
            { id: "attendance", label: "Attendance" },
            { id: "academics", label: "Academics" },
            { id: "tools", label: "Tools Hub" },
            { id: "payments", label: "Payments" },
            { id: "libraries", label: "Libraries" },
            { id: "cabshare", label: "Cab Share" },
            { id: "transport", label: "Transport" },
            { id: "more", label: "More Hub" },
            { id: "profile", label: "Profile" },
            { id: "credentials", label: "Credentials" },
          ].map((tab) => {
            const pinned = settings?.pinnedNavTabs ?? [];
            const isPinned = pinned.includes(tab.id);
            const atLimit = !isPinned && pinned.length >= 4;

            return (
              <button
                key={tab.id}
                disabled={atLimit}
                onClick={() => {
                  const current = settings?.pinnedNavTabs ?? [];
                  const next = isPinned
                    ? current.filter((id: string) => id !== tab.id)
                    : [...current, tab.id];
                  updateSetting("pinnedNavTabs", next);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  isPinned
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                    : atLimit
                    ? "bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed opacity-50"
                    : "bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-indigo-400"
                }`}
              >
                {isPinned && <Check className="w-3.5 h-3.5" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between py-3 border-t border-zinc-150 dark:border-zinc-800/80">
          <div>
            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
              Compact Mobile Header
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Hide bulky headers on small screens to maximize reading area
            </p>
          </div>
          <Switch checked={hideMobileHeader} onCheckedChange={setHideMobileHeader} />
        </div>
      </div>

      {/* Push Notifications Card */}
      <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 space-y-4 shadow-2xs">
        <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white font-outfit">
          Push Notifications
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Receive exam reminders, attendance alerts, and moodle deadline notifications
        </p>
        <div className="pt-2">
          <PushNotificationManager />
        </div>
      </div>
    </div>
  );

  // 6. Advanced & System Section
  const renderAdvancedContent = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 divide-y divide-zinc-150 dark:divide-zinc-800/60 overflow-hidden shadow-2xs">
        {/* Local Storage Database */}
        <div
          onClick={openStoragePage}
          className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-850/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3.5 min-w-0 pr-4">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              <Database size={18} />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs text-zinc-900 dark:text-white block">
                Local Storage Viewer
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block truncate mt-0.5">
                Inspect raw client cache entries, tokens, and database keys
              </span>
            </div>
          </div>
          <ChevronRight size={16} className="text-zinc-400 shrink-0" />
        </div>

        {/* Custom API Endpoint */}
        <div className="p-4 space-y-3 bg-zinc-50/50 dark:bg-zinc-950/30">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
              <Link2 size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-bold text-xs text-zinc-900 dark:text-white block">
                Custom API Endpoint URL
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
                Override student API data server route
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://api.amazecc.com"
              value={customApiInput}
              onChange={(e) => setCustomApiInput(e.target.value)}
              className="flex-1 px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-800 dark:text-white"
            />
            <button
              onClick={saveCustomApiUrl}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              Save
            </button>
            {customApiInput && (
              <button
                onClick={clearCustomApiUrl}
                className="px-3 py-2 text-xs font-bold text-red-600 border border-red-200 dark:border-red-900/50 rounded-xl transition-all cursor-pointer shadow-2xs"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Backup Settings */}
        <div
          onClick={handleExportSettings}
          className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-850/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3.5 min-w-0 pr-4">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Save size={18} />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs text-zinc-900 dark:text-white block">
                Backup / Export Settings
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block truncate mt-0.5">
                Save application preferences, layout options, and custom name to file
              </span>
            </div>
          </div>
          <ChevronRight size={16} className="text-zinc-400 shrink-0" />
        </div>

        {/* Restore Settings */}
        <div
          onClick={handleImportSettings}
          className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-850/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3.5 min-w-0 pr-4">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <ExternalLink size={18} />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs text-zinc-900 dark:text-white block">
                Restore / Import Settings
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block truncate mt-0.5">
                Import and restore configuration from a settings backup JSON file
              </span>
            </div>
          </div>
          <ChevronRight size={16} className="text-zinc-400 shrink-0" />
        </div>

        {/* Keyboard Shortcuts */}
        <div
          onClick={onOpenShortcutsHelp}
          className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-850/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3.5 min-w-0 pr-4">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
              <Keyboard size={18} />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs text-zinc-900 dark:text-white block">
                Keyboard Shortcuts Cheat-Sheet
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block truncate mt-0.5">
                View interactive hotkey shortcuts for quick navigation
              </span>
            </div>
          </div>
          <ChevronRight size={16} className="text-zinc-400 shrink-0" />
        </div>

        {/* Reset Cache */}
        <div
          onClick={handleResetCache}
          className="flex items-center justify-between p-4 hover:bg-red-500/5 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3.5 min-w-0 pr-4">
            <div className="p-2.5 rounded-xl bg-red-500/10 text-red-600 shrink-0">
              <RefreshCcw size={18} />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs text-red-600 block">
                Reset Application Cache
              </span>
              <span className="text-[11px] text-red-500/80 block truncate mt-0.5">
                Clear all stored data, cached timetables, and reload fresh
              </span>
            </div>
          </div>
          <ChevronRight size={16} className="text-red-400 shrink-0" />
        </div>

        {/* Log Out */}
        <div
          onClick={handleLogOutRequest}
          className="flex items-center justify-between p-4 hover:bg-red-500/5 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3.5 min-w-0 pr-4">
            <div className="p-2.5 rounded-xl bg-red-500/10 text-red-600 shrink-0">
              <LogOut size={18} />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs text-red-600 block">Sign Out</span>
              <span className="text-[11px] text-red-500/80 block truncate mt-0.5">
                Safely disconnect and clear active session tokens
              </span>
            </div>
          </div>
          <ChevronRight size={16} className="text-red-400 shrink-0" />
        </div>
      </div>
    </div>
  );

  // 7. About & Community Section
  const renderAboutContent = () => (
    <div className="space-y-6">
      {/* App Info Hero Card */}
      <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-6 flex flex-col items-center text-center space-y-4 shadow-2xs">
        <div className="scale-125 mb-1 shrink-0">
          <IconToggle />
        </div>
        <div>
          <h3 className="text-lg font-black text-zinc-900 dark:text-white font-outfit">
            AmazeCC
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Your high-speed, continuity-powered college companion.
          </p>
        </div>

        <div className="w-full max-w-sm grid grid-cols-2 gap-3 text-xs text-left pt-3 border-t border-zinc-150 dark:border-zinc-800/60">
          <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/50 dark:border-zinc-850">
            <span className="text-zinc-400 font-semibold block text-[10px]">Version</span>
            <span className="font-bold text-zinc-800 dark:text-zinc-200">v3.2.0</span>
          </div>
          <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/50 dark:border-zinc-850">
            <span className="text-zinc-400 font-semibold block text-[10px]">Build Number</span>
            <span className="font-bold text-zinc-800 dark:text-zinc-200">2026.0816</span>
          </div>
        </div>

        <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 tracking-widest uppercase pt-2 border-t border-zinc-150 dark:border-zinc-850/60 w-full">
          Crafted with care by Amaze Continuity Projects
        </p>
      </div>

      {/* Community & Useful Links List */}
      <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 divide-y divide-zinc-150 dark:divide-zinc-800/60 overflow-hidden shadow-2xs">
        {quickLinks.importantLinks.map((link) => (
          <a
            key={link.id}
            href={link.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-850/50 transition-colors"
          >
            <div className="flex items-center gap-3.5 min-w-0 pr-4">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                <Link2 size={18} />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-xs text-zinc-900 dark:text-white block">
                  {link.title}
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block truncate mt-0.5">
                  {link.desc}
                </span>
              </div>
            </div>
            <ExternalLink size={14} className="text-zinc-400 shrink-0" />
          </a>
        ))}

        {/* Changelog */}
        <div
          onClick={() => setShowChangelog(true)}
          className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-850/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3.5 min-w-0 pr-4">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
              <History size={18} />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs text-zinc-900 dark:text-white block">
                Changelog & Release Notes
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block truncate mt-0.5">
                See all latest feature updates and performance improvements
              </span>
            </div>
          </div>
          <ChevronRight size={16} className="text-zinc-400 shrink-0" />
        </div>

        {/* Hall of Fame */}
        <div
          onClick={() => setShowHallOfFame(true)}
          className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-850/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3.5 min-w-0 pr-4">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <Trophy size={18} />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs text-zinc-900 dark:text-white block">
                Hall of Fame
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block truncate mt-0.5">
                Meet the contributors, developers, and testers
              </span>
            </div>
          </div>
          <ChevronRight size={16} className="text-zinc-400 shrink-0" />
        </div>

        {/* GitHub */}
        <a
          href="https://github.com/AmazeContinuityProjects/AmazeCC/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-850/50 transition-colors"
        >
          <div className="flex items-center gap-3.5 min-w-0 pr-4">
            <div className="p-2.5 rounded-xl bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 shrink-0">
              <Github size={18} />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs text-zinc-900 dark:text-white block">
                GitHub Repository
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block truncate mt-0.5">
                Open-source repository, issues, and contributions
              </span>
            </div>
          </div>
          <ExternalLink size={14} className="text-zinc-400 shrink-0" />
        </a>

        {/* Privacy Policy */}
        <div
          onClick={() => window.open("/privacy", "_blank")}
          className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-850/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3.5 min-w-0 pr-4">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
              <FileText size={18} />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs text-zinc-900 dark:text-white block">
                Privacy Policy
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block truncate mt-0.5">
                Read about client-side storage encryption and local safety
              </span>
            </div>
          </div>
          <ExternalLink size={14} className="text-zinc-400 shrink-0" />
        </div>

        {/* Terms of Service */}
        <div
          onClick={() => window.open("/terms", "_blank")}
          className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-850/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3.5 min-w-0 pr-4">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              <Shield size={18} />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs text-zinc-900 dark:text-white block">
                Terms of Service
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block truncate mt-0.5">
                Usage guidelines and student companion service terms
              </span>
            </div>
          </div>
          <ExternalLink size={14} className="text-zinc-400 shrink-0" />
        </div>
      </div>
    </div>
  );

  const getSectionContent = (id: SectionId) => {
    switch (id) {
      case "profile":
        return renderProfileContent();
      case "credentials":
        return renderCredentialsContent();
      case "preferences":
        return renderPreferencesContent();
      case "academic":
        return renderAcademicContent();
      case "sync":
        return renderSyncContent();
      case "navigation":
        return renderNavigationContent();
      case "advanced":
        return renderAdvancedContent();
      case "about":
        return renderAboutContent();
      default:
        return null;
    }
  };

  /* ─────────────────────────────────────────────────────────────
     MAIN RENDER
  ───────────────────────────────────────────────────────────── */

  return (
    <div className="w-full pb-16 px-3 sm:px-6 md:px-8 max-w-6xl mx-auto">
      {/* Footer Modals */}
      {showStoragePage && isLoggedIn && (
        <DataPage
          handleClose={() => setShowStoragePage(false)}
          handleDeleteItem={handleDeleteItem}
          storageData={storageData}
        />
      )}
      {showChangelog && <ChangelogModal handleClose={() => setShowChangelog(false)} />}
      {showHallOfFame && <HallOfFameModal handleClose={() => setShowHallOfFame(false)} />}

      {/* Detail Modals */}
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

      {/* Top Profile Summary Header Card */}
      <div className="pt-4 pb-6 mb-6">
        <div className="relative p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-white/90 to-zinc-50/80 dark:from-zinc-900/90 dark:to-zinc-950/80 border border-zinc-200/80 dark:border-zinc-800 shadow-sm backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4 min-w-0">
              {displayProfileImage && profileData?.image ? (
                <img
                  src={profileData.image}
                  alt="Profile"
                  className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl object-cover shadow-sm ring-2 ring-indigo-500/20 border border-zinc-200 dark:border-zinc-800 shrink-0"
                />
              ) : (
                <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-black text-2xl shadow-sm shrink-0">
                  {friendlyName ? friendlyName[0].toUpperCase() : (username || "A")[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tempFriendlyName}
                      onChange={(e) => setTempFriendlyName(e.target.value)}
                      placeholder="Preferred name..."
                      className="px-3 py-1.5 text-sm font-bold border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setFriendlyName(tempFriendlyName);
                          setIsEditingName(false);
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        setFriendlyName(tempFriendlyName);
                        setIsEditingName(false);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 h-auto rounded-xl"
                    >
                      Save
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white font-outfit tracking-tight truncate">
                      {friendlyName || username || "Student"}
                    </h1>
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="p-1 rounded-lg text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                      title="Edit Preferred Name"
                    >
                      <Edit3 size={14} />
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 font-mono text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                    {username}
                  </span>
                  {profileData?.branch && (
                    <span className="truncate max-w-[200px] sm:max-w-none">{profileData.branch}</span>
                  )}
                  {profileData?.isHosteller !== undefined && (
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold text-[11px]">
                      {profileData.isHosteller ? "Hosteller" : "Day Scholar"}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions in Header */}
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <button
                onClick={onOpenShortcutsHelp}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-white/80 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-indigo-400 shadow-2xs transition-all cursor-pointer"
              >
                <Keyboard size={14} className="text-indigo-500" />
                <span>Shortcuts</span>
              </button>
              <button
                onClick={handleLogOutRequest}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 bg-red-50/70 dark:bg-red-950/30 border border-red-200/80 dark:border-red-900/40 hover:bg-red-100 transition-all cursor-pointer"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Settings Search Bar */}
          <div className="relative mt-4 pt-4 border-t border-zinc-150 dark:border-zinc-800/80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search all settings, credentials, profile, themes, semesters..."
              className="w-full pl-9 pr-4 py-2 text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 text-xs"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          DESKTOP VIEW: Split Rail & Spacious Content
      ───────────────────────────────────────────────────────────── */}
      <div className="hidden md:flex gap-8 items-start">
        {/* Left Navigation Rail */}
        <aside className="sticky top-6 w-60 shrink-0 flex flex-col gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-3 mb-1">
            Settings Menu
          </span>
          {filteredSections.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeDesktopSection === sec.id;

            return (
              <button
                key={sec.id}
                onClick={() => setActiveDesktopSection(sec.id)}
                className={`flex items-center gap-3 w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-600/20 font-black"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/80 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg ${
                    isActive ? "bg-white/20 text-white" : `${sec.iconBg} ${sec.iconColor}`
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="flex-1 truncate">{sec.label}</span>
                <ChevronRight
                  className={`w-3.5 h-3.5 transition-transform ${
                    isActive ? "opacity-100 translate-x-0.5" : "opacity-40"
                  }`}
                />
              </button>
            );
          })}

          <div className="pt-3 mt-2 border-t border-zinc-200/80 dark:border-zinc-800/80">
            <button
              onClick={handleLogOutRequest}
              className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all text-left cursor-pointer"
            >
              <div className="p-1.5 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
                <LogOut className="w-4 h-4" />
              </div>
              <span className="flex-1 truncate">Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Right Settings Content */}
        <main className="flex-1 w-full min-w-0 space-y-6">
          {searchQuery.trim() ? (
            <div className="space-y-8">
              {filteredSections.map((sec) => (
                <div key={sec.id} className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-zinc-200 dark:border-zinc-800">
                    <sec.icon className={`w-4 h-4 ${sec.iconColor}`} />
                    <h2 className="text-sm font-black text-zinc-900 dark:text-white font-outfit uppercase tracking-wider">
                      {sec.label}
                    </h2>
                  </div>
                  {getSectionContent(sec.id)}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6 animate-fadeIn">
              <div className="pb-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-zinc-900 dark:text-white font-outfit">
                    {SECTIONS.find((s) => s.id === activeDesktopSection)?.label}
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {SECTIONS.find((s) => s.id === activeDesktopSection)?.subtitle}
                  </p>
                </div>
              </div>
              {getSectionContent(activeDesktopSection)}
            </div>
          )}
        </main>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MOBILE VIEW: Nested Submenus (Zero Collapsible Clutter)
      ───────────────────────────────────────────────────────────── */}
      <div className="block md:hidden">
        <AnimatePresence mode="wait">
          {/* LEVEL 1: Settings Hub Menu */}
          {activeMobileSubmenu === null ? (
            <m.div
              key="mobile-hub"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.18 }}
              className="space-y-3"
            >
              <div className="px-1 pb-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Settings Categories
                </span>
              </div>

              <div className="space-y-2.5">
                {filteredSections.map((sec) => {
                  const Icon = sec.icon;
                  return (
                    <button
                      key={sec.id}
                      onClick={() => setActiveMobileSubmenu(sec.id)}
                      className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs hover:border-indigo-400 active:scale-[0.98] transition-all text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 pr-3">
                        <div className={`p-2.5 rounded-xl shrink-0 ${sec.iconBg} ${sec.iconColor}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white font-outfit truncate">
                            {sec.label}
                          </h3>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                            {sec.subtitle}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
                    </button>
                  );
                })}
              </div>

              {/* Mobile Hub Quick Actions */}
              <div className="pt-4 space-y-2">
                <button
                  onClick={onOpenShortcutsHelp}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Keyboard size={16} className="text-indigo-500" />
                  <span>Keyboard Hotkeys & Shortcuts</span>
                </button>

                <button
                  onClick={handleLogOutRequest}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200/80 dark:border-red-900/40 text-xs font-bold text-red-600 dark:text-red-400 shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
                >
                  <LogOut size={16} />
                  <span>Sign Out of Account</span>
                </button>
              </div>
            </m.div>
          ) : (
            /* LEVEL 2: Focused Category Sub-Page */
            <m.div
              key="mobile-submenu"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              {/* Back Button Navigation Header */}
              <div className="sticky top-2 z-20 flex items-center justify-between p-3 rounded-2xl bg-white/95 dark:bg-zinc-900/95 border border-zinc-200/80 dark:border-zinc-800 shadow-xs backdrop-blur-md">
                <button
                  onClick={() => setActiveMobileSubmenu(null)}
                  className="flex items-center gap-1.5 text-xs font-black text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Settings</span>
                </button>

                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 font-outfit truncate">
                  {SECTIONS.find((s) => s.id === activeMobileSubmenu)?.label}
                </span>

                <div className="w-12" />
              </div>

              {/* Sub-page Settings Content */}
              <div className="pt-1">{getSectionContent(activeMobileSubmenu)}</div>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      <TabHelpFooter tabId="settings" />
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cookies, authorizedID, csrf }),
    })
      .then((r) => r.json())
      .then((res) => {
        const hasContent =
          res?.tables?.length > 0 && res.tables.some((t: any) => t.rows?.length > 0);
        setHasData(hasContent);
        if (hasContent) {
          let foundDate = "";
          let foundTime = "";

          if (res?.keyValuePairs?.date) foundDate = res.keyValuePairs.date;
          if (res?.keyValuePairs?.fromTime) {
            const to = res.keyValuePairs.toTime ? ` - ${res.keyValuePairs.toTime}` : "";
            foundTime = res.keyValuePairs.fromTime + to;
          }

          if (!foundDate || !foundTime) {
            const rows = res.tables[0].rows || [];
            const h = res.tables[0].headers?.[0] || "Registration Details";
            for (const row of rows) {
              const label = typeof row === "object" ? row[h] || "" : "";
              const val = typeof row === "object" ? row["col1"] || "" : "";
              if (!foundDate && /date/i.test(label)) foundDate = val;
              if (!foundTime && /from.?time|to.?time|time/i.test(label)) {
                foundTime = foundTime ? `${foundTime} - ${val}` : val;
              }
            }
          }

          if (!foundDate || !foundTime) {
            const firstRow = res.tables[0].rows?.[0];
            const headers = res.tables[0].headers || [];
            if (!foundDate) {
              const idx = headers.findIndex((h: string) => /date/i.test(h));
              if (idx >= 0) {
                foundDate = String(
                  typeof firstRow === "object"
                    ? firstRow[headers[idx]] || firstRow[idx] || ""
                    : firstRow[idx] || ""
                );
              }
            }
            if (!foundTime) {
              const idx = headers.findIndex((h: string) => /time|session/i.test(h));
              if (idx >= 0) {
                foundTime = String(
                  typeof firstRow === "object"
                    ? firstRow[headers[idx]] || firstRow[idx] || ""
                    : firstRow[idx] || ""
                );
              }
            }
          }

          setDate(foundDate);
          setTime(foundTime);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [creds]);

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
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No registration schedule available
        </p>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center py-4 space-y-4">
      <div className="p-4 rounded-full bg-blue-50 dark:bg-blue-900/30">
        <Clock className="w-10 h-10 text-blue-600 dark:text-blue-400" />
      </div>
      <div>
        <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-outfit">
          Registration Scheduled
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          {date && <span>Date: {date}</span>}
          {date && time && <span>{" • "}</span>}
          {time && <span>Time: {time}</span>}
          {!date && !time && <span>Your registration is available</span>}
        </p>
      </div>
      <button
        onClick={handleMarkRead}
        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors cursor-pointer"
      >
        Mark as Read
      </button>
    </div>
  );
}

function BankDayStatusModal({
  endpoint,
  title,
  creds,
}: {
  endpoint: string;
  title: string;
  creds: any;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const { cookies, authorizedID, csrf } = creds;
    fetch(`${API_BASE}/api/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cookies, authorizedID, csrf }),
    })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [creds, endpoint]);

  if (loading) return <Skeleton className="h-24 w-full rounded-2xl" />;

  const hasContent =
    data?.tables?.length > 0 ||
    (data?.keyValuePairs && Object.keys(data.keyValuePairs).length > 0);

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl">
      {hasContent ? (
        <>
          <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="w-8 h-8" />
          </div>
          <div>
            <p className="font-semibold text-emerald-700 dark:text-emerald-300 text-lg">
              {title} Filled
            </p>
            <p className="text-sm text-emerald-600/70 dark:text-emerald-400/70">
              Your {title.toLowerCase()} has been submitted successfully
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="p-3 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-400">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <p className="font-semibold text-zinc-700 dark:text-zinc-300 text-lg">
              {title} Not Filled
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No {title.toLowerCase()} found in the system
            </p>
          </div>
        </>
      )}
    </div>
  );
}
