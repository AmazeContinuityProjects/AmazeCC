"use client";

import { API_BASE } from "../Main";
import { setCustomApiUrl } from "@/lib/fetch-utils";
import {
  X,
  Save,
  LogOut,
  Eye,
  User,
  Link2,
  ExternalLink,
  Github,
  Database,
  Shield,
  FileText,
  ChevronRight,
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
  Keyboard
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@amazecontinuityprojects/amazeui";
import { getAssetPath } from "@/lib/utils";
import config from "../../../../config.json";
import { Switch } from "@amazecontinuityprojects/amazeui";
import Links from "./Links";
import PushNotificationManager from "@/app/pushNotificationManager";
import quickLinks from "../../../data/quickLinks.json";
import DataPage from "../footer/DataPage";
import { IconToggle } from "../toggle";
import { AboutSection } from "./AboutSection";
import ChangelogModal from "./ChangelogModal";
import HallOfFameModal from "./HallOfFameModal";
import ProfileStatusCards from "../profile/ProfileStatusCards";
import AcknowledgementCards from "../profile/AcknowledgementCards";
import { Badge, useIsMobile } from "../shared";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";

type SectionId = "profile" | "preferences" | "academic" | "sync" | "advanced";

interface SectionConfig {
  id: SectionId;
  label: string;
  icon: any;
}

const SECTIONS: SectionConfig[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "preferences", label: "Appearance", icon: Sliders },
  { id: "academic", label: "Academic Settings", icon: Settings },
  { id: "sync", label: "Data Sync", icon: RefreshCcw },
  { id: "advanced", label: "Advanced", icon: Shield },
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
  onOpenShortcutsHelp
}: any) {
  const isMobile = useIsMobile();
  const [expandedSection, setExpandedSection] = useState<string>("preferences");
  const [selectedSemester, setSelectedSemester] = useState<string>(currSemesterID);
  const [appIcon, setAppIcon] = useState<string>("default");
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [tempFriendlyName, setTempFriendlyName] = useState<string>(friendlyName || "");
  const [customApiInput, setCustomApiInput] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("amazecc_custom_api_url") || "";
    }
    return "";
  });

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

  const [profileData, setProfileData] = useState<any>(null);
  const [profileImages, setProfileImages] = useState<any>(null);
  const [hostelInfo, setHostelInfo] = useState<any>(null);

  // Modals & Pages
  const [showStoragePage, setShowStoragePage] = useState<boolean>(false);
  const [storageData, setStorageData] = useState<Record<string, string | null>>({});
  const [showChangelog, setShowChangelog] = useState<boolean>(false);
  const [showHallOfFame, setShowHallOfFame] = useState<boolean>(false);

  // Search & Navigation
  const [searchQuery, setSearchQuery] = useState("");

  const sectionsToUse = useMemo(() => {
    if (mode === "info") {
      return SECTIONS.filter(s => s.id === "profile");
    } else {
      return SECTIONS.filter(s => s.id !== "profile");
    }
  }, [mode]);

  const [activeSection, setActiveSection] = useState<SectionId>(
    mode === "info" ? "profile" : "preferences"
  );
  const activePalette = settings?.colorPalette === "ocean" ? "neonPink" : settings?.colorPalette || "default";
  const customPalette = settings?.customPalette || {
    accent: "#0ea5e9",
    background: "#f8fafc",
    surface: "#ffffff",
  };
  const displayProfileImage = settings?.showProfilePhoto || mode === "info";

  // Collapsible Sync states
  const [syncOpen, setSyncOpen] = useState<Record<string, boolean>>({
    academics: true,
    attendance: false,
    exams: false,
    faculty: false,
    wishlist: false,
    projects: false,
  });

  const toggleSyncCategory = (cat: string) => {
    setSyncOpen(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const updateSetting = (key: string, value: any) => {
    setSettings((prev: any) => {
      const next = { ...prev, [key]: value };
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
        currentAddress: { line1: "VIT Chennai Campus", line2: "Vandalur-Kelambakkam Road", city: "Chennai", pincode: "600127" },
        permanentAddress: { line1: "VIT Chennai Campus", line2: "Vandalur-Kelambakkam Road", city: "Chennai", pincode: "600127" }
      });
      setHostelInfo({
        blockName: "D-Block",
        roomNo: "402"
      });
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
    if (!creds?.cookies) return;
    try {
      const stored = localStorage.getItem("profile");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.nativeLanguage || parsed?.currentAddress || parsed?.father) return;
      }
    } catch (_) {}
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/student`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf }),
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

  const handleReload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onReload?.();
    if (!creds?.cookies) return;
    try {
      const res = await fetch(`${API_BASE}/api/student`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf }),
      });
      const data = await res.json();
      if (data?.profile) {
        setProfileData(data.profile);
        localStorage.setItem("profile", JSON.stringify(data.profile));
      }
    } catch (e) {
      console.error("Failed to refresh profile", e);
    }
  };

  const handleIconChange = (icon: string) => {
    setAppIcon(icon);
    localStorage.setItem("app-icon", icon);
    window.dispatchEvent(new Event("app-icon-changed"));
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

  // Scroll Sync and Active Section Highlight
  const scrollToSection = (id: SectionId) => {
    const element = document.getElementById(`sec-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(id);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      if (sectionsToUse.length === 0) return;
      let current: SectionId = sectionsToUse[0].id;
      for (const section of sectionsToUse) {
        const el = document.getElementById(`sec-${section.id}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 160) {
            current = section.id;
          }
        }
      }
      setActiveSection(current);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [sectionsToUse]);

  const { theme, setTheme } = useTheme();
  const handleThemeChange = (val: string) => {
    if (theme === val) return;
    if (typeof document !== "undefined" && (document as any).startViewTransition) {
      (document as any).startViewTransition(() => {
        setTheme(val);
      });
    } else {
      setTheme(val);
    }
    window.setTimeout(() => window.location.reload(), 80);
  };

  // Advanced section helpers
  const handleResetCache = () => {
    localStorage.clear();
    window.location.reload();
  };

  const handleExportSettings = () => {
    const data = {
      settings: localStorage.getItem("settings"),
      appIcon: localStorage.getItem("app-icon"),
      friendlyName: localStorage.getItem("friendlyName")
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `amazecc-settings-export.json`;
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

  // Search Filter calculation
  const filteredSections = useMemo(() => {
    if (!searchQuery) return sectionsToUse;
    const query = searchQuery.toLowerCase();
    return sectionsToUse.filter(section => {
      const matchLabel = section.label.toLowerCase().includes(query);
      if (matchLabel) return true;

      // Check inner settings titles & descriptions
      if (section.id === "profile") {
        return "personal info address residential hostel scholar".includes(query);
      }
      if (section.id === "preferences") {
        return "theme appearance icon palette color profile image semester calendar decimal loading mobile header reload".includes(query);
      }
      if (section.id === "academic") {
        return "overview proctor faculty credentials mentor".includes(query);
      }
      if (section.id === "sync") {
        return "sync arrears exams additional wishlist projects".includes(query);
      }
      if (section.id === "advanced") {
        return "storage developer export import reset logout cache".includes(query);
      }
      return false;
    });
  }, [searchQuery, sectionsToUse]);

  const renderSection = (id: string, label: string, Icon: any, children: React.ReactNode) => {
    if (!filteredSections.some(s => s.id === id)) return null;

    if (isMobile && mode === "settings") {
      const isOpen = expandedSection === id;
      return (
        <div key={id} className="border border-gray-200/85 dark:border-gray-800 bg-white/50 dark:bg-slate-900/50 rounded-2xl overflow-hidden shadow-xs">
          <button
            onClick={() => setExpandedSection(isOpen ? "" : id)}
            className="w-full flex items-center justify-between p-4 font-bold text-gray-850 dark:text-gray-200 hover:bg-gray-100/40 dark:hover:bg-slate-800/30 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Icon className="w-4.5 h-4.5 text-info" />
              <span className="text-sm font-extrabold">{label}</span>
            </div>
            <ChevronRight className={`w-4 h-4 text-gray-405 transition-transform duration-200 ${isOpen ? "rotate-90 text-info" : ""}`} />
          </button>
          {isOpen && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-850 space-y-5 animate-fadeIn">
              {children}
            </div>
          )}
        </div>
      );
    }

    return (
      <section key={id} id={`sec-${id}`} className="scroll-mt-6 space-y-5">
        <div className="flex items-center gap-2 pb-1 border-b border-gray-150 dark:border-gray-800">
          <Icon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{label}</h2>
        </div>
        {children}
      </section>
    );
  };

  return (
    <div className="w-full h-full pb-16 px-4 md:px-8 max-w-7xl mx-auto">
      {/* Footer Modals */}
      {showStoragePage && isLoggedIn && (
        <DataPage handleClose={() => setShowStoragePage(false)} handleDeleteItem={handleDeleteItem} storageData={storageData} />
      )}
      {showChangelog && <ChangelogModal handleClose={() => setShowChangelog(false)} />}
      {showHallOfFame && <HallOfFameModal handleClose={() => setShowHallOfFame(false)} />}

      {/* Top Header layout (VS Code / Discord settings style) */}
      <div className="pt-6 pb-6 border-b border-gray-150 dark:border-gray-800/80 mb-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4.5">
            {displayProfileImage && profileData?.image ? (
              <img src={profileData.image} alt="Profile" className="w-16 h-16 rounded-full object-cover shadow-xs border border-gray-200 dark:border-gray-800" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-info flex items-center justify-center shadow-xs">
                <User size={28} className="text-white" />
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
                    className="px-2.5 py-1 text-base font-semibold border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-900 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-info"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setFriendlyName(tempFriendlyName);
                        setIsEditingName(false);
                      }
                    }}
                  />
                  <Button size="sm" onClick={() => { setFriendlyName(tempFriendlyName); setIsEditingName(false); }} className="bg-info hover:bg-info text-white py-1 h-8 rounded-lg">Save</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50 tracking-tight truncate">{friendlyName || username || "Student"}</h1>
                  <button onClick={() => setIsEditingName(true)} className="text-[10px] font-semibold text-info bg-info-surface px-2 py-0.5 rounded-full hover:bg-info-surface transition-colors">Edit</button>
                </div>
              )}
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex flex-wrap items-center gap-1.5 font-medium">
                <span>VTOP ID: {username}</span>
                {profileData?.branch && (
                  <>
                    <span>•</span>
                    <span className="truncate">{profileData.branch}</span>
                  </>
                )}
                {profileData?.isHosteller !== undefined && (
                  <>
                    <span>•</span>
                    <span>{profileData.isHosteller ? "Hosteller" : "Day Scholar"}</span>
                  </>
                )}
                <span>•</span>
                <span>Semester {currSemesterID ? currSemesterID.slice(4, -4) : "Current"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Search bar */}
        <div className="relative mt-5 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Settings..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-250 dark:border-gray-800 bg-white/50 dark:bg-slate-900/50 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-info transition-all"
          />
        </div>
      </div>

      {/* Main settings body layout */}
      <div className="flex flex-col md:flex-row gap-8 items-start relative">
           {/* Left Sticky navigation (Desktop) */}
        {sectionsToUse.length > 1 && (
          <aside className="sticky top-6 w-full md:w-56 shrink-0 hidden md:flex flex-col gap-0.5 border-r border-gray-150 dark:border-gray-800/60 pr-4">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2.5 mb-2">Settings</div>
            {sectionsToUse.map(sec => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => scrollToSection(sec.id)}
                  className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold rounded-lg text-left transition-all ${
                    isActive
                      ? "bg-info-surface text-info border border-info/30"
                      : "text-gray-600 dark:text-gray-450 hover:bg-gray-100/60 dark:hover:bg-slate-800/40 hover:text-gray-900 dark:hover:text-white border border-transparent"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-info" : "text-gray-400 dark:text-gray-500"}`} />
                  <span>{sec.label}</span>
                </button>
              );
            })}
          </aside>
        )}

        {/* Horizontal Navigation tabs (Mobile / Tablet) */}
        {sectionsToUse.length > 1 && mode !== "settings" && (
          <nav className="flex md:hidden overflow-x-auto w-full border-b border-gray-150 dark:border-gray-800 pb-2 mb-2 gap-1.5 scrollbar-none">
            {sectionsToUse.map(sec => {
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => scrollToSection(sec.id)}
                  className={`px-3 py-1.5 text-xs font-bold whitespace-nowrap rounded-full transition-all ${
                    isActive
                      ? "bg-info text-white shadow-xs"
                      : "bg-gray-100 dark:bg-slate-850 text-gray-605 dark:text-gray-300"
                  }`}
                >
                  {sec.label}
                </button>
              );
            })}
          </nav>
        )}

        {/* Right side Settings Content pane */}
        <main className="flex-1 w-full space-y-3.5 md:space-y-12">

          {/* Section: Profile */}
          {renderSection("profile", "Profile", User, (
            <div className="space-y-6">

              {/* Status and Proctor overview cards */}
              {creds && (
                <>
                  {/* Status overview metrics */}
                  <ProfileStatusCards creds={creds} refreshKey={refreshKey} onCardClick={onCardClick} />
                  <AcknowledgementCards creds={creds} refreshKey={refreshKey} />

                  {/* Proctor & Dean section */}
                  {profileImages?.proctor && (
                    <div className="bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-gray-200/80 dark:border-gray-800 p-5 space-y-4">
                      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Faculty Mentors</h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[{
                          role: "Proctor",
                          photo: profileImages.proctor.photoBase64,
                          details: profileImages.proctor.details || {}
                        }, ...(profileImages.hodDean?.people?.map((p: any) => ({
                          role: p.role,
                          photo: p.photoBase64,
                          details: p.details || {}
                        })) || [])].map((person, idx) => (
                          <div key={idx} className="bg-gray-100/50 dark:bg-slate-800/10 p-4 rounded-xl border border-gray-150 dark:border-gray-800/60 flex items-start gap-4">
                            {person.photo ? (
                              <img src={person.photo} alt={person.role} className="w-12 h-12 rounded-full object-cover shadow-xs border border-gray-200 dark:border-gray-800 shrink-0" />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-info flex items-center justify-center shadow-xs shrink-0">
                                <User size={20} className="text-white" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-info block mb-0.5">{person.role}</span>
                              <p className="font-bold text-xs text-gray-900 dark:text-gray-100 truncate">{person.details.name || "N/A"}</p>
                              {person.details.designation && (
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate mt-0.5">{person.details.designation}</p>
                              )}

                              {/* Extra contact rows */}
                              <div className="mt-2 space-y-0.5 text-[10px] text-gray-500 dark:text-gray-400 border-t border-gray-150 dark:border-gray-800/60 pt-1.5">
                                {Object.entries(person.details).filter(([k]) => k !== "name" && k !== "designation").map(([k, val]) => (
                                  <div key={k} className="truncate">
                                    <span className="capitalize font-semibold">{k.replace(/([A-Z])/g, " $1").trim()}: </span>
                                    <span>{String(val)}</span>
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

              <div className="bg-transparent sm:bg-white/50 dark:sm:bg-slate-900/50 sm:rounded-2xl sm:border sm:border-gray-200/80 dark:sm:border-gray-800 sm:p-5 space-y-6">

                <div className="h-px bg-gray-150 dark:bg-gray-800/80" />

                {/* Personal Information Grid */}
                {[profileData?.nativeLanguage, profileData?.nationality, profileData?.community, profileData?.aadharNumber, profileData?.mobileNumber].some(Boolean) && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Personal Information</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3.5 text-xs">
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
                        ["Hostel Status", profileData.isHosteller ? `${hostelInfo?.blockName || "N/A"} - Room ${hostelInfo?.roomNo || "N/A"}` : "Day Scholar"],
                      ].filter(([, v]) => v).map(([label, val]) => (
                        <div key={String(label)}>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">{String(label)}</p>
                          <p className="font-semibold text-gray-800 dark:text-gray-200 break-words">{String(val)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Address Info Subsection */}
                {(profileData?.currentAddress || profileData?.permanentAddress) && (
                  <>
                    <div className="h-px bg-gray-150 dark:bg-gray-800/80" />
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Address</h3>
                      {profileData.currentAddress && (
                        <div className="bg-gray-100/40 dark:bg-slate-800/10 p-3 rounded-xl border border-gray-150 dark:border-gray-800/60">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Current Address</p>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                            {Object.entries(profileData.currentAddress).filter(([, v]) => v).map(([key, val]) => (
                              <div key={key}>
                                <p className="text-[10px] text-gray-450 capitalize mb-0.5">{key}</p>
                                <p className="font-semibold text-gray-800 dark:text-gray-200 break-words">{String(val)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {profileData.permanentAddress && (
                        <div className="bg-gray-100/40 dark:bg-slate-800/10 p-3 rounded-xl border border-gray-150 dark:border-gray-800/60">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Permanent Address</p>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                            {Object.entries(profileData.permanentAddress).filter(([, v]) => v).map(([key, val]) => (
                              <div key={key}>
                                <p className="text-[10px] text-gray-450 capitalize mb-0.5">{key}</p>
                                <p className="font-semibold text-gray-800 dark:text-gray-200 break-words">{String(val)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

              </div>
            </div>
          ))}

          {/* Section: Preferences */}
          {renderSection("preferences", "Appearance", Sliders, (
            <div className="bg-transparent sm:bg-white/50 dark:sm:bg-slate-900/50 sm:rounded-2xl sm:border sm:border-gray-200/80 dark:sm:border-gray-800 sm:p-5 space-y-6">

                {/* Subsection: Appearance */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-150 dark:border-gray-850 pb-1.5">Appearance</h3>

                  {/* Theme Toggle pills */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <p className="text-sm font-semibold text-gray-850 dark:text-gray-200">Theme</p>
                      <p className="text-xs text-gray-500 dark:text-gray-450">Switch between light and dark UI themes</p>
                    </div>
                    <div className="flex rounded-lg bg-gray-100 dark:bg-slate-800 p-1 w-full sm:w-64">
                      <button
                        onClick={() => handleThemeChange("light")}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                          theme === "light"
                            ? "bg-white dark:bg-slate-700 text-info shadow-xs"
                            : "text-gray-500 dark:text-gray-450 hover:text-gray-700 dark:hover:text-gray-300"
                        }`}
                      >
                        Light
                      </button>
                      <button
                        onClick={() => handleThemeChange("dark")}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                          theme === "dark"
                            ? "bg-white dark:bg-slate-700 text-info shadow-xs"
                            : "text-gray-500 dark:text-gray-450 hover:text-gray-700 dark:hover:text-gray-300"
                        }`}
                      >
                        Dark
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-850 dark:text-gray-200">Show GPA on Dashboard</p>
                      <p className="text-xs text-gray-550 dark:text-gray-450">Display GPA/CGPA in the dashboard and sidebar</p>
                    </div>
                    <Switch
                      checked={settings?.showGpa ?? false}
                      onCheckedChange={(val) => updateSetting("showGpa", val)}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-850 dark:text-gray-200">Show Profile Photo on Dashboard</p>
                      <p className="text-xs text-gray-550 dark:text-gray-455">Display your profile photo in the dashboard and sidebar</p>
                    </div>
                    <Switch
                      checked={settings?.showProfilePhoto ?? false}
                      onCheckedChange={(val) => updateSetting("showProfilePhoto", val)}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-850 dark:text-gray-200">Grades Anonymizer Mode</p>
                      <p className="text-xs text-gray-550 dark:text-gray-455">Blur all CGPA, credits, and course grades to protect privacy (hover to reveal)</p>
                    </div>
                    <Switch
                      checked={settings?.blurGrades ?? false}
                      onCheckedChange={(val) => updateSetting("blurGrades", val)}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-850 dark:text-gray-200">Arc Navigation Menu (Super Demo)</p>
                      <p className="text-xs text-gray-550 dark:text-gray-455">Enable an experimental floating center blue menu button and a revolving arc of tabs on mobile</p>
                    </div>
                    <Switch
                      checked={settings?.arcNavigationMode ?? false}
                      onCheckedChange={(val) => updateSetting("arcNavigationMode", val)}
                    />
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-850 dark:text-gray-200">Color Palette</p>
                      <p className="text-xs text-gray-500 dark:text-gray-450">Pick a preset or tune your own colors</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {COLOR_PALETTES.map((palette) => (
                        <button
                          key={palette.id}
                          type="button"
                          onClick={() => updateSetting("colorPalette", palette.id)}
                          className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-all ${
                            activePalette === palette.id
                              ? "border-info bg-info-surface"
                              : "border-gray-200 dark:border-gray-800 hover:bg-gray-100/60 dark:hover:bg-slate-800/40"
                          }`}
                        >
                          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{palette.label}</span>
                          <span className="flex -space-x-1">
                            {palette.swatches.map((color) => (
                              <span
                                key={color}
                                className="h-4 w-4 rounded-full border border-white/70 dark:border-slate-900 shadow-xs"
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </span>
                        </button>
                      ))}
                    </div>
                    {activePalette === "custom" && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-gray-200 dark:border-gray-800 p-3 bg-white/30 dark:bg-slate-900/30">
                        {[
                          ["accent", "Accent"],
                          ["background", "Background"],
                          ["surface", "Surface"],
                        ].map(([key, label]) => (
                          <label key={key} className="flex items-center justify-between gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                            <span>{label}</span>
                            <input
                              type="color"
                              value={customPalette[key as "accent" | "background" | "surface"]}
                              onChange={(e) => updateCustomPalette(key as "accent" | "background" | "surface", e.target.value)}
                              className="h-8 w-12 cursor-pointer rounded-md border border-gray-200 dark:border-gray-800 bg-transparent p-0.5"
                              aria-label={`${label} color`}
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* App Icon selector */}
                  <div className="flex flex-col justify-start gap-2.5">
                    <div>
                      <p className="text-sm font-semibold text-gray-850 dark:text-gray-200">App Icon</p>
                      <p className="text-xs text-gray-500 dark:text-gray-450">Choose a customized application icon</p>
                    </div>
                    <div className="flex gap-4 pt-1">
                      <button
                        onClick={() => handleIconChange("default")}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                          appIcon === "default"
                            ? "border-info bg-info-surface"
                            : "border-gray-200 dark:border-gray-800 hover:bg-gray-100/60 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <img src={getAssetPath("/logo.png")} alt="Default Icon" className="w-10 h-10 rounded-lg shadow-xs" />
                        <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">Default</span>
                      </button>
                      <button
                        onClick={() => handleIconChange("fire")}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                          appIcon === "fire"
                            ? "border-info bg-info-surface"
                            : "border-gray-200 dark:border-gray-800 hover:bg-gray-100/60 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <img src={getAssetPath("/images/icons/fire.png")} alt="Fire Icon" className="w-10 h-10 rounded-lg shadow-xs" />
                        <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">Fire</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-gray-150 dark:bg-gray-800/80" />

                {/* Subsection: Academic settings */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-150 dark:border-gray-850 pb-1.5">Academic Settings</h3>

                  {/* Select Semester dropdown + save */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-850 dark:text-gray-200">Select Semester</p>
                      <p className="text-xs text-gray-500 dark:text-gray-450">Active academic term semester ID</p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-80 shrink-0">
                      <select
                        value={selectedSemester}
                        onChange={(e) => setSelectedSemester(e.target.value)}
                        className="flex-1 text-xs border border-gray-250 dark:border-gray-800 rounded-lg bg-white/50 dark:bg-slate-900/60 text-gray-800 dark:text-gray-100 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-info"
                      >
                        {config.semesterIDs?.map((id: string, index: number) => (
                          <option key={index} value={id}>
                            {id.endsWith("01") ? "FALLSEM" : id.endsWith("05") ? "WINTERSEM" : id.endsWith("07") ? "SUMMERSEM" : "UNKNOWN"} {id.slice(4, -4)}-{id.slice(6, -2)}
                          </option>
                        ))}
                      </select>
                      <Button
                        onClick={handleSaveSemester}
                        disabled={!selectedSemester || selectedSemester === currSemesterID}
                        className="bg-info hover:bg-info text-white text-xs px-3.5 py-1.5 h-auto rounded-lg"
                      >
                        <Save size={14} className="mr-1.5" /> Save
                      </Button>
                    </div>
                  </div>

                  {/* Academic Calendar dropdown */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-850 dark:text-gray-200">Academic Calendar</p>
                      <p className="text-xs text-gray-500 dark:text-gray-450">Default timetable calendar format</p>
                    </div>
                    <select
                      value={calendarType || "ALL"}
                      onChange={(e) => setCalendarType(e.target.value)}
                      className="w-full sm:w-80 text-xs border border-gray-250 dark:border-gray-800 rounded-lg bg-white/50 dark:bg-slate-900/60 text-gray-800 dark:text-gray-100 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-info shrink-0"
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
                </div>

                <div className="h-px bg-gray-150 dark:bg-gray-800/80" />

                {/* Subsection: Display and Behaviour */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-150 dark:border-gray-850 pb-1.5">Display & Behaviour</h3>

                  {/* Decimal toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-850 dark:text-gray-200">Use One Decimal Place</p>
                      <p className="text-xs text-gray-550 dark:text-gray-450">Show stats/GPA rounded to 1 decimal place</p>
                    </div>
                    <Switch checked={decimalValues} onCheckedChange={setDecimalValues} />
                  </div>


                  {/* Compact Mobile view toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-850 dark:text-gray-200">Compact Mobile Layout</p>
                      <p className="text-xs text-gray-550 dark:text-gray-450">Hide tabs header and status stats in mobile views</p>
                    </div>
                    <Switch checked={hideMobileHeader} onCheckedChange={setHideMobileHeader} />
                  </div>

                  {/* Reload All Data toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-850 dark:text-gray-200">Reload All Data</p>
                      <p className="text-xs text-gray-550 dark:text-gray-450">Refresh button fetches all categories instead of just attendance</p>
                    </div>
                    <Switch checked={reloadAllData} onCheckedChange={setReloadAllData} />
                  </div>

                  {/* Pinned Nav Tabs */}
                  <div>
                    <p className="text-sm font-semibold text-gray-850 dark:text-gray-200 mb-1">Pinned Nav Tabs</p>
                    <p className="text-xs text-gray-550 dark:text-gray-450 mb-2">Choose tabs to show in the mobile bottom bar (max 4). Home & Modules are always on the bar.</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: "attendance", label: "Attendance", icon: "CalendarCheck" },
                        { id: "academics", label: "Academics", icon: "GraduationCap" },
                        { id: "payments", label: "Payments", icon: "CreditCard" },
                        { id: "libraries", label: "Libraries", icon: "Library" },
                        { id: "cabshare", label: "Cab Share", icon: "CarTaxiFront" },
                        { id: "transport", label: "Transport", icon: "Bus" },
                        { id: "more", label: "More", icon: "MoreHorizontal" },
                        { id: "profile", label: "Profile", icon: "User" },
                      ].map(tab => {
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
                              setSettings((prev: any) => {
                                const updated = { ...prev, pinnedNavTabs: next };
                                localStorage.setItem("settings", JSON.stringify(updated));
                                return updated;
                              });
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                              isPinned
                                ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                                : atLimit
                                  ? "bg-gray-100 dark:bg-gray-900 border-gray-150 dark:border-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50"
                                  : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-blue-400"
                            }`}
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="h-px bg-gray-150 dark:bg-gray-800/80" />

                {/* Subsection: Notifications */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-150 dark:border-gray-850 pb-1.5">Notifications</h3>
                  <PushNotificationManager />
                </div>

              </div>
          ))}

          {/* Section: Academic Settings */}
          {renderSection("academic", "Academic Settings", Settings, (
            <div className="space-y-6">


              {/* Residential Status Subsection */}
              <div className="bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-gray-200/80 dark:border-gray-800 p-5 space-y-4">
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Residential Settings</h3>
                    <p className="text-xs text-gray-550 dark:text-gray-400">Configure your boarding status and transport settings</p>
                  </div>
                  <div className="flex rounded-lg bg-gray-100 dark:bg-slate-800 p-1 w-full sm:w-64">
                    <button
                      onClick={() => { setResidentialStatus("hosteller"); setIsDayscholarWithBus(false); }}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                        residentialStatus === "hosteller"
                          ? "bg-white dark:bg-slate-700 text-info shadow-xs"
                          : "text-gray-500 dark:text-gray-450 hover:text-gray-700 dark:hover:text-gray-300"
                      }`}
                    >
                      Hosteller
                    </button>
                    <button
                      onClick={() => setResidentialStatus("dayscholar")}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                        residentialStatus === "dayscholar"
                          ? "bg-white dark:bg-slate-700 text-info shadow-xs"
                          : "text-gray-500 dark:text-gray-450 hover:text-gray-700 dark:hover:text-gray-300"
                      }`}
                    >
                      Dayscholar
                    </button>
                  </div>
                  {residentialStatus === "dayscholar" && (
                    <label className="flex items-center gap-3 p-3 rounded-xl bg-white/20 dark:bg-slate-800/10 border border-gray-200 dark:border-gray-800/60 cursor-pointer transition-all hover:border-info/40">
                      <input
                        type="checkbox"
                        checked={isDayscholarWithBus}
                        onChange={(e) => setIsDayscholarWithBus(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-info focus:ring-info/50 bg-transparent"
                      />
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">I have bus registration</span>
                    </label>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Section: Data Sync */}
          {renderSection("sync", "Data Sync", RefreshCcw, (
            <div className="relative">
              {username === "demo" && (
                <div className="absolute inset-0 bg-neutral-950/65 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center z-10 border border-amber-500/10">
                  <span className="text-xs font-bold text-amber-400 bg-amber-500/15 border border-amber-500/20 px-3.5 py-1.5 rounded-full flex items-center gap-1.5">
                    🔒 Sync Disabled in Demo Mode
                  </span>
                </div>
              )}

              <div className={`bg-transparent sm:bg-white/50 dark:sm:bg-slate-900/50 sm:rounded-2xl sm:border sm:border-gray-200/80 dark:sm:border-gray-800 sm:p-5 space-y-4 ${username === "demo" ? "pointer-events-none opacity-50 select-none" : ""}`}>
                  <p className="text-xs text-gray-550 dark:text-gray-400">Choose which API categories to fetch when reloading data to save time and bandwidth.</p>

                {/* Collapsible Sync Toggles */}
                <div className="space-y-2">

                  {/* Category: Academics */}
                  <div className="border border-gray-200/60 dark:border-gray-800 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleSyncCategory("academics")}
                      className="flex items-center justify-between w-full px-4 py-3 bg-gray-50/50 dark:bg-slate-900/20 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <span>Academics</span>
                      <motion.div animate={{ rotate: syncOpen.academics ? 90 : 0 }}>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                      </motion.div>
                    </button>
                    {syncOpen.academics && (
                      <div className="px-4 py-3 bg-transparent border-t border-gray-200/40 dark:border-gray-800/40 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-200">Sync Arrears Data</p>
                            <p className="text-[10px] text-gray-450">Arrear schedule, details, and grades</p>
                          </div>
                          <Switch checked={settings?.syncArrearData ?? true} onCheckedChange={(val) => updateSetting("syncArrearData", val)} />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-200">Course Option Change</p>
                            <p className="text-[10px] text-gray-450">Track optional elective changes</p>
                          </div>
                          <Switch checked={settings?.syncCourseOptionChange ?? true} onCheckedChange={(val) => updateSetting("syncCourseOptionChange", val)} />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-200">EXC Registration</p>
                            <p className="text-[10px] text-gray-450">Extra-curricular registrations status</p>
                          </div>
                          <Switch checked={settings?.syncExcRegistration ?? true} onCheckedChange={(val) => updateSetting("syncExcRegistration", val)} />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-200">Minor / Honour Course</p>
                            <p className="text-[10px] text-gray-450">Minor and Honour program registration info</p>
                          </div>
                          <Switch checked={settings?.syncMinorHonour ?? true} onCheckedChange={(val) => updateSetting("syncMinorHonour", val)} />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-200">Course Completion</p>
                            <p className="text-[10px] text-gray-450">Academic credits check completion status</p>
                          </div>
                          <Switch checked={settings?.syncCourseCompletion ?? true} onCheckedChange={(val) => updateSetting("syncCourseCompletion", val)} />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-200">Additional Learning</p>
                            <p className="text-[10px] text-gray-450">Extra certifications and non-graded learning</p>
                          </div>
                          <Switch checked={settings?.syncAdditionalLearning ?? true} onCheckedChange={(val) => updateSetting("syncAdditionalLearning", val)} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Category: Attendance */}
                  <div className="border border-gray-200/60 dark:border-gray-800 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleSyncCategory("attendance")}
                      className="flex items-center justify-between w-full px-4 py-3 bg-gray-50/50 dark:bg-slate-900/20 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <span>Attendance & Profile</span>
                      <motion.div animate={{ rotate: syncOpen.attendance ? 90 : 0 }}>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                      </motion.div>
                    </button>
                    {syncOpen.attendance && (
                      <div className="px-4 py-3 bg-transparent border-t border-gray-200/40 dark:border-gray-800/40 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-200">Sync Profile Data</p>
                            <p className="text-[10px] text-gray-450">Credentials, dayboarder info, and bank information</p>
                          </div>
                          <Switch checked={settings?.syncProfileData ?? true} onCheckedChange={(val) => updateSetting("syncProfileData", val)} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Category: Exams */}
                  <div className="border border-gray-200/60 dark:border-gray-800 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleSyncCategory("exams")}
                      className="flex items-center justify-between w-full px-4 py-3 bg-gray-50/50 dark:bg-slate-900/20 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <span>Exams</span>
                      <motion.div animate={{ rotate: syncOpen.exams ? 90 : 0 }}>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                      </motion.div>
                    </button>
                    {syncOpen.exams && (
                      <div className="px-4 py-3 bg-transparent border-t border-gray-200/40 dark:border-gray-800/40 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-200">Sync Exam Data</p>
                            <p className="text-[10px] text-gray-450">Makeup exams, compre schedules and status</p>
                          </div>
                          <Switch checked={settings?.syncExamData ?? true} onCheckedChange={(val) => updateSetting("syncExamData", val)} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Category: Faculty */}
                  <div className="border border-gray-200/60 dark:border-gray-800 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleSyncCategory("faculty")}
                      className="flex items-center justify-between w-full px-4 py-3 bg-gray-50/50 dark:bg-slate-900/20 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <span>Faculty & Proctor Info</span>
                      <motion.div animate={{ rotate: syncOpen.faculty ? 90 : 0 }}>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                      </motion.div>
                    </button>
                    {syncOpen.faculty && (
                      <div className="px-4 py-3 bg-transparent border-t border-gray-200/40 dark:border-gray-800/40 text-xs text-gray-400">
                        Proctor and dean information updates are synced automatically with profile data.
                      </div>
                    )}
                  </div>

                  {/* Category: Wishlist */}
                  <div className="border border-gray-200/60 dark:border-gray-800 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleSyncCategory("wishlist")}
                      className="flex items-center justify-between w-full px-4 py-3 bg-gray-50/50 dark:bg-slate-900/20 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <span>Wishlist</span>
                      <motion.div animate={{ rotate: syncOpen.wishlist ? 90 : 0 }}>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                      </motion.div>
                    </button>
                    {syncOpen.wishlist && (
                      <div className="px-4 py-3 bg-transparent border-t border-gray-200/40 dark:border-gray-800/40 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-200">Sync Wishlist Data</p>
                            <p className="text-[10px] text-gray-450">Fetch draft wishlist courses from VTOP</p>
                          </div>
                          <Switch checked={settings?.syncWishlist ?? true} onCheckedChange={(val) => updateSetting("syncWishlist", val)} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Category: Projects */}
                  <div className="border border-gray-200/60 dark:border-gray-800 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleSyncCategory("projects")}
                      className="flex items-center justify-between w-full px-4 py-3 bg-gray-50/50 dark:bg-slate-900/20 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <span>Projects</span>
                      <motion.div animate={{ rotate: syncOpen.projects ? 90 : 0 }}>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                      </motion.div>
                    </button>
                    {syncOpen.projects && (
                      <div className="px-4 py-3 bg-transparent border-t border-gray-200/40 dark:border-gray-800/40 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-200">Sync Project Information</p>
                            <p className="text-[10px] text-gray-450">Fetch active project details</p>
                          </div>
                          <Switch checked={settings?.syncProject ?? true} onCheckedChange={(val) => updateSetting("syncProject", val)} />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-200">Project Course Sync</p>
                            <p className="text-[10px] text-gray-450">Fetch individual project course grades</p>
                          </div>
                          <Switch checked={settings?.syncProjectCourse ?? true} onCheckedChange={(val) => updateSetting("syncProjectCourse", val)} />
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
          ))}

          {/* Section: Resources */}
          {renderSection("resources", "Resources", Link2, (
            <div className="bg-transparent sm:bg-white/50 dark:sm:bg-slate-900/50 sm:rounded-2xl sm:border sm:border-gray-200/80 dark:sm:border-gray-800 divide-y divide-gray-150 dark:divide-gray-800/60 overflow-hidden">

                {/* Utilities / Important Links */}
                {quickLinks.importantLinks.map((link) => (
                  <a key={link.id} href={link.link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 hover:bg-gray-100/50 dark:hover:bg-slate-800/30 transition-colors">
                    <div className="flex items-center gap-4 min-w-0 pr-4">
                      <div className="p-2 rounded-xl bg-info-surface text-info shrink-0">
                        <Link2 size={18} />
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 block">{link.title}</span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-450 block truncate mt-0.5">{link.desc}</span>
                      </div>
                    </div>
                    <ExternalLink size={14} className="text-gray-400 shrink-0" />
                  </a>
                ))}

                {/* Social Community links */}
                {quickLinks.communityLinks.map((link, idx) => (
                  <a key={idx} href={link.link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 hover:bg-gray-100/50 dark:hover:bg-slate-800/30 transition-colors">
                    <div className="flex items-center gap-4 min-w-0 pr-4">
                      <div className="p-2 rounded-xl bg-info-surface text-info shrink-0">
                        <ExternalLink size={18} />
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 block">{link.title}</span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-450 block truncate mt-0.5">VIT community discussion forums and updates</span>
                      </div>
                    </div>
                    <ExternalLink size={14} className="text-gray-400 shrink-0" />
                  </a>
                ))}

                {/* Local Link Component integrations */}
                <div className="p-4 bg-transparent">
                  <Links />
                </div>

                {/* Changelog */}
                <div onClick={() => setShowChangelog(true)} className="flex items-center justify-between p-4 hover:bg-gray-100/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4 min-w-0 pr-4">
                    <div className="p-2 rounded-xl bg-info-surface text-info shrink-0">
                      <History size={18} />
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 block">Changelog</span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-450 block truncate mt-0.5">View latest updates, features and releases in AmazeCC</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-gray-400 shrink-0" />
                </div>

                {/* Hall of Fame */}
                <div onClick={() => setShowHallOfFame(true)} className="flex items-center justify-between p-4 hover:bg-gray-100/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4 min-w-0 pr-4">
                    <div className="p-2 rounded-xl bg-info-surface text-info shrink-0">
                      <Trophy size={18} />
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 block">Hall of Fame</span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-450 block truncate mt-0.5">Meet the contributors, developers, and testers of the app</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-gray-400 shrink-0" />
                </div>

                {/* Source on GitHub */}
                <a href="https://github.com/AmazeContinuityProjects/AmazeCC/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 hover:bg-gray-100/50 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center gap-4 min-w-0 pr-4">
                    <div className="p-2 rounded-xl bg-info-surface text-info shrink-0">
                      <Github size={18} />
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 block">GitHub Repository</span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-450 block truncate mt-0.5">Check out code, contribute fixes or report system bugs</span>
                    </div>
                  </div>
                  <ExternalLink size={14} className="text-gray-400 shrink-0" />
                </a>

                {/* Privacy Policy */}
                <div onClick={() => window.open("/privacy", "_blank")} className="flex items-center justify-between p-4 hover:bg-gray-100/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4 min-w-0 pr-4">
                    <div className="p-2 rounded-xl bg-info-surface text-info shrink-0">
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 block">Privacy Policy</span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-450 block truncate mt-0.5">Read about local credentials and encryption safety</span>
                    </div>
                  </div>
                  <ExternalLink size={14} className="text-gray-400 shrink-0" />
                </div>

                {/* Terms of Service */}
                <div onClick={() => window.open("/terms", "_blank")} className="flex items-center justify-between p-4 hover:bg-gray-100/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4 min-w-0 pr-4">
                    <div className="p-2 rounded-xl bg-info-surface text-info shrink-0">
                      <Shield size={18} />
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 block">Terms of Service</span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-450 block truncate mt-0.5">Understand guidelines and rules of utilizing AmazeCC services</span>
                    </div>
                  </div>
                  <ExternalLink size={14} className="text-gray-400 shrink-0" />
                </div>

              </div>
          ))}

          {/* Section: About */}
          {renderSection("about", "About AmazeCC", Info, (
            <div className="bg-transparent sm:bg-white/50 dark:sm:bg-slate-900/50 sm:rounded-2xl sm:border sm:border-gray-200/80 dark:sm:border-gray-800 p-6 flex flex-col items-center text-center space-y-4">
                <div className="scale-125 mb-1 shrink-0">
                  <IconToggle />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">AmazeCC</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Your ultimate college companion application.</p>
                </div>

                <div className="w-full max-w-xs grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs text-left pt-2 border-t border-gray-150 dark:border-gray-800/60 mt-2">
                  <div>
                    <span className="text-gray-400 font-medium block">Version</span>
                    <span className="font-bold text-gray-850 dark:text-gray-200">v3.1.0</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-medium block">Build Number</span>
                    <span className="font-bold text-gray-850 dark:text-gray-200">2026.0703</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-medium block">Last Updated</span>
                    <span className="font-bold text-gray-850 dark:text-gray-200">July 2026</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-medium block">Platform</span>
                    <span className="font-bold text-gray-850 dark:text-gray-200">Web App</span>
                  </div>
                </div>

                <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 tracking-widest uppercase pt-2 border-t border-gray-150 dark:border-gray-850/60 w-full">
                  MADE WITH ❤️ BY SUGEETHJSA AND DHIVYANJ
                </p>
              </div>
          ))}

          {/* Section: Advanced */}
          {renderSection("advanced", "Advanced Settings", Shield, (
            <div className="bg-transparent sm:bg-white/50 dark:sm:bg-slate-900/50 sm:rounded-2xl sm:border sm:border-gray-200/80 dark:sm:border-gray-800 divide-y divide-gray-150 dark:divide-gray-800/60 overflow-hidden">

                {/* Local Storage Viewer */}
                <div onClick={openStoragePage} className="flex items-center justify-between p-4 hover:bg-gray-100/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4 min-w-0 pr-4">
                    <div className="p-2 rounded-xl bg-info-surface text-info shrink-0">
                      <Database size={18} />
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 block">Local Storage Viewer</span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-455 block truncate mt-0.5">Inspect raw application database cache items and tokens</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-gray-400 shrink-0" />
                </div>

                {/* Custom API URL Configuration */}
                <div className="p-4 space-y-3 bg-gray-50/50 dark:bg-slate-950/20 text-left">
                  <div className="flex items-center gap-4 min-w-0 pr-4">
                    <div className="p-2 rounded-xl bg-info-surface text-info shrink-0">
                      <Link2 size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 block">Custom API Endpoint URL</span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-455 block mt-0.5">Override VTOP and student API data endpoint routes</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://api.mycustomdomain.com"
                      value={customApiInput}
                      onChange={(e) => setCustomApiInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-gray-250 dark:border-gray-800 bg-white/50 dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-info text-gray-800 dark:text-white"
                    />
                    <button
                      onClick={saveCustomApiUrl}
                      className="px-3.5 py-1.5 text-[10px] font-black text-white bg-indigo-650 hover:bg-indigo-750 rounded-xl transition-all uppercase tracking-wider cursor-pointer shadow-2xs"
                    >
                      Save
                    </button>
                    {customApiInput && (
                      <button
                        onClick={clearCustomApiUrl}
                        className="px-3.5 py-1.5 text-[10px] font-black text-red-505 border border-red-200 dark:border-red-900/50 rounded-xl transition-all uppercase tracking-wider cursor-pointer shadow-2xs"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Export Settings */}
                <div onClick={handleExportSettings} className="flex items-center justify-between p-4 hover:bg-gray-100/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4 min-w-0 pr-4">
                    <div className="p-2 rounded-xl bg-info-surface text-info shrink-0">
                      <Save size={18} />
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 block">Backup / Export Settings</span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-455 block truncate mt-0.5">Save app options, custom name, and layout preferences to file</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-gray-400 shrink-0" />
                </div>

                {/* Import Settings */}
                <div onClick={handleImportSettings} className="flex items-center justify-between p-4 hover:bg-gray-100/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4 min-w-0 pr-4">
                    <div className="p-2 rounded-xl bg-info-surface text-info shrink-0">
                      <ExternalLink size={18} />
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 block">Restore / Import Settings</span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-455 block truncate mt-0.5">Restore app options and name configurations from settings backup file</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-gray-400 shrink-0" />
                </div>

                {/* Keyboard Shortcuts */}
                <div onClick={onOpenShortcutsHelp} className="flex items-center justify-between p-4 hover:bg-gray-100/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4 min-w-0 pr-4">
                    <div className="p-2 rounded-xl bg-info-surface text-info shrink-0">
                      <Keyboard size={18} />
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 block">Keyboard Shortcuts Cheat-Sheet</span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-455 block truncate mt-0.5">Show the interactive global keyboard hotkeys dialog</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-gray-400 shrink-0" />
                </div>

                {/* Reset Cache */}
                <div onClick={handleResetCache} className="flex items-center justify-between p-4 hover:bg-red-500/5 hover:bg-red-550/10 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4 min-w-0 pr-4">
                    <div className="p-2 rounded-xl bg-red-500/10 text-red-550 shrink-0">
                      <Database size={18} className="text-red-500" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-red-500 block">Reset Application Cache</span>
                      <span className="text-[10px] text-red-400/80 block truncate mt-0.5">Erase all local storage, cached profiles, and reload settings</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-red-400 shrink-0" />
                </div>

                {/* Log Out */}
                <div onClick={handleLogOutRequest} className="flex items-center justify-between p-4 hover:bg-red-500/5 hover:bg-red-550/10 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4 min-w-0 pr-4">
                    <div className="p-2 rounded-xl bg-red-500/10 text-red-550 shrink-0">
                      <LogOut size={18} className="text-red-500" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-red-500 block">Log Out</span>
                      <span className="text-[10px] text-red-400/80 block truncate mt-0.5">Safely sign out of the active account session</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-red-400 shrink-0" />
                </div>

              </div>
          ))}

        </main>
      </div>
    </div>
  );
}
