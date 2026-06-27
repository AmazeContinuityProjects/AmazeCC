"use client";

import { API_BASE } from "../Main";
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
  AlertCircle
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "../../ui/button";
import { getAssetPath } from "@/lib/utils";
import config from "../../../../config.json";
import { Switch } from "@/components/ui/switch";
import Links from "./Links";
import PushNotificationManager from "@/app/pushNotificationManager";
import quickLinks from "../../../data/quickLinks.json";
import DataPage from "../footer/DataPage";
import { IconToggle } from "../toggle";
import ChangelogModal from "./ChangelogModal";
import HallOfFameModal from "./HallOfFameModal";
import ProfileStatusCards from "../profile/ProfileStatusCards";
import AcknowledgementCards from "../profile/AcknowledgementCards";
import { Badge } from "../shared";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";

type SectionId = "profile" | "preferences" | "academic" | "sync" | "resources" | "about" | "advanced";

interface SectionConfig {
  id: SectionId;
  label: string;
  icon: any;
}

const SECTIONS: SectionConfig[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "preferences", label: "Preferences", icon: Sliders },
  { id: "academic", label: "Academic Settings", icon: Settings },
  { id: "sync", label: "Data Sync", icon: RefreshCcw },
  { id: "resources", label: "Resources", icon: Link2 },
  { id: "about", label: "About", icon: Info },
  { id: "advanced", label: "Advanced", icon: Shield },
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
  loadingScreen,
  setLoadingScreen,
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
  setSettings
}: any) {
  const [selectedSemester, setSelectedSemester] = useState<string>(currSemesterID);
  const [appIcon, setAppIcon] = useState<string>("default");
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [tempFriendlyName, setTempFriendlyName] = useState<string>(friendlyName || "");
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
  const [activeSection, setActiveSection] = useState<SectionId>("profile");

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

  const handleSaveSemester = async () => {
    if (!selectedSemester) return;
    setIsReloading(true);
    await handleLogin(selectedSemester);
    setCurrSemesterID(selectedSemester);
  };

  useEffect(() => {
    setSelectedSemester(currSemesterID);
    setAppIcon(localStorage.getItem("app-icon") || "default");
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
  }, [currSemesterID]);

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
      let current: SectionId = "profile";
      for (const section of SECTIONS) {
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
  }, []);

  // Theme settings mapping
  const { theme, setTheme } = useTheme();
  const handleThemeChange = (val: string) => {
    setTheme(val);
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
    if (!searchQuery) return SECTIONS;
    const query = searchQuery.toLowerCase();
    return SECTIONS.filter(section => {
      const matchLabel = section.label.toLowerCase().includes(query);
      if (matchLabel) return true;

      // Check inner settings titles & descriptions
      if (section.id === "profile") {
        return "personal info address residential hostel scholar".includes(query);
      }
      if (section.id === "preferences") {
        return "theme appearance icon semester calendar decimal loading mobile header reload".includes(query);
      }
      if (section.id === "academic") {
        return "overview proctor faculty credentials mentor".includes(query);
      }
      if (section.id === "sync") {
        return "sync arrears exams additional wishlist projects".includes(query);
      }
      if (section.id === "resources") {
        return "utilities socials links updates changelog fame policy terms".includes(query);
      }
      if (section.id === "about") {
        return "version build sugeeth dhivyan".includes(query);
      }
      if (section.id === "advanced") {
        return "storage developer export import reset logout cache".includes(query);
      }
      return false;
    });
  }, [searchQuery]);

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
            {profileData?.image ? (
              <img src={profileData.image} alt="Profile" className="w-16 h-16 rounded-full object-cover shadow-xs border border-gray-200 dark:border-gray-800" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center shadow-xs">
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
                    className="px-2.5 py-1 text-base font-semibold border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-900 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setFriendlyName(tempFriendlyName);
                        setIsEditingName(false);
                      }
                    }}
                  />
                  <Button size="sm" onClick={() => { setFriendlyName(tempFriendlyName); setIsEditingName(false); }} className="bg-sky-500 hover:bg-sky-600 text-white py-1 h-8 rounded-lg">Save</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50 tracking-tight truncate">{friendlyName || username || "Student"}</h1>
                  <button onClick={() => setIsEditingName(true)} className="text-[10px] font-semibold text-sky-600 bg-sky-500/10 px-2 py-0.5 rounded-full hover:bg-sky-500/15 transition-colors">Edit</button>
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
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-250 dark:border-gray-800 bg-white/50 dark:bg-slate-900/50 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-400 transition-all"
          />
        </div>
      </div>

      {/* Main settings body layout */}
      <div className="flex flex-col md:flex-row gap-8 items-start relative">
        
        {/* Left Sticky navigation (Desktop) */}
        <aside className="sticky top-6 w-full md:w-56 shrink-0 hidden md:flex flex-col gap-0.5 border-r border-gray-150 dark:border-gray-800/60 pr-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2.5 mb-2">Settings</div>
          {SECTIONS.map(sec => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => scrollToSection(sec.id)}
                className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold rounded-lg text-left transition-all ${
                  isActive
                    ? "bg-sky-400/10 text-sky-400 border border-sky-400/15"
                    : "text-gray-600 dark:text-gray-450 hover:bg-gray-100/60 dark:hover:bg-slate-800/40 hover:text-gray-900 dark:hover:text-white border border-transparent"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-sky-400" : "text-gray-400 dark:text-gray-500"}`} />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Horizontal Navigation tabs (Mobile / Tablet) */}
        <nav className="flex md:hidden overflow-x-auto w-full border-b border-gray-150 dark:border-gray-800 pb-2 mb-2 gap-1.5 scrollbar-none">
          {SECTIONS.map(sec => {
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => scrollToSection(sec.id)}
                className={`px-3 py-1.5 text-xs font-bold whitespace-nowrap rounded-full transition-all ${
                  isActive
                    ? "bg-sky-500 text-white shadow-xs"
                    : "bg-gray-100 dark:bg-slate-850 text-gray-600 dark:text-gray-300"
                }`}
              >
                {sec.label}
              </button>
            );
          })}
        </nav>

        {/* Right side Settings Content pane */}
        <main className="flex-1 w-full space-y-12">
          
          {/* Section: Profile */}
          {filteredSections.some(s => s.id === "profile") && (
            <section id="sec-profile" className="scroll-mt-6 space-y-5">
              <div className="flex items-center gap-2 pb-1 border-b border-gray-150 dark:border-gray-800">
                <User className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Profile</h2>
              </div>

              {/* Grouped Profile Card */}
              <div className="bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-gray-200/80 dark:border-gray-800 p-5 space-y-6">
                
                {/* Residential Status Subsection */}
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
                          ? "bg-white dark:bg-slate-700 text-sky-400 shadow-xs"
                          : "text-gray-500 dark:text-gray-450 hover:text-gray-700 dark:hover:text-gray-300"
                      }`}
                    >
                      Hosteller
                    </button>
                    <button
                      onClick={() => setResidentialStatus("dayscholar")}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                        residentialStatus === "dayscholar"
                          ? "bg-white dark:bg-slate-700 text-sky-400 shadow-xs"
                          : "text-gray-500 dark:text-gray-450 hover:text-gray-700 dark:hover:text-gray-300"
                      }`}
                    >
                      Dayscholar
                    </button>
                  </div>
                  {residentialStatus === "dayscholar" && (
                    <label className="flex items-center gap-3 p-3 rounded-xl bg-white/20 dark:bg-slate-800/10 border border-gray-200 dark:border-gray-800/60 cursor-pointer transition-all hover:border-sky-400/40">
                      <input
                        type="checkbox"
                        checked={isDayscholarWithBus}
                        onChange={(e) => setIsDayscholarWithBus(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-sky-500 focus:ring-sky-400/50 bg-transparent"
                      />
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">I have bus registration</span>
                    </label>
                  )}
                </div>

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
            </section>
          )}

          {/* Section: Preferences */}
          {filteredSections.some(s => s.id === "preferences") && (
            <section id="sec-preferences" className="scroll-mt-6 space-y-5">
              <div className="flex items-center gap-2 pb-1 border-b border-gray-150 dark:border-gray-800">
                <Sliders className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Preferences</h2>
              </div>

              {/* Grouped Preferences Card */}
              <div className="bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-gray-200/80 dark:border-gray-800 p-5 space-y-6">
                
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
                            ? "bg-white dark:bg-slate-700 text-sky-400 shadow-xs"
                            : "text-gray-500 dark:text-gray-450 hover:text-gray-700 dark:hover:text-gray-300"
                        }`}
                      >
                        Light
                      </button>
                      <button
                        onClick={() => handleThemeChange("dark")}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                          theme === "dark"
                            ? "bg-white dark:bg-slate-700 text-sky-400 shadow-xs"
                            : "text-gray-500 dark:text-gray-450 hover:text-gray-700 dark:hover:text-gray-300"
                        }`}
                      >
                        Dark
                      </button>
                    </div>
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
                            ? "border-sky-500 bg-sky-500/10"
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
                            ? "border-sky-500 bg-sky-500/10"
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
                        className="flex-1 text-xs border border-gray-250 dark:border-gray-800 rounded-lg bg-white/50 dark:bg-slate-900/60 text-gray-800 dark:text-gray-100 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400"
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
                        className="bg-sky-500 hover:bg-sky-600 text-white text-xs px-3.5 py-1.5 h-auto rounded-lg"
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
                      className="w-full sm:w-80 text-xs border border-gray-250 dark:border-gray-800 rounded-lg bg-white/50 dark:bg-slate-900/60 text-gray-800 dark:text-gray-100 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400 shrink-0"
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

                  {/* Loading screen toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-850 dark:text-gray-200">Legacy Loading Screen</p>
                      <p className="text-xs text-gray-550 dark:text-gray-450">Display classic layout loader during fetches</p>
                    </div>
                    <Switch checked={loadingScreen} onCheckedChange={setLoadingScreen} />
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
                </div>

                <div className="h-px bg-gray-150 dark:bg-gray-800/80" />

                {/* Subsection: Notifications */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-150 dark:border-gray-850 pb-1.5">Notifications</h3>
                  <PushNotificationManager />
                </div>

              </div>
            </section>
          )}

          {/* Section: Academic Settings */}
          {filteredSections.some(s => s.id === "academic") && (
            <section id="sec-academic" className="scroll-mt-6 space-y-5">
              <div className="flex items-center gap-2 pb-1 border-b border-gray-150 dark:border-gray-800">
                <Settings className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Academic Overview</h2>
              </div>

              {/* Status and Proctor overview cards */}
              {creds ? (
                <div className="space-y-6">
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
                              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-sky-400 to-indigo-500 flex items-center justify-center shadow-xs shrink-0">
                                <User size={20} className="text-white" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-sky-400 block mb-0.5">{person.role}</span>
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

                  {/* Credentials card row */}
                  <div
                    onClick={() => onCredentialsClick && onCredentialsClick()}
                    className="flex items-center justify-between p-4 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-gray-200/80 dark:border-gray-800 cursor-pointer hover:bg-sky-400/5 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <Key className="w-5 h-5 text-sky-400" />
                      <div>
                        <span className="font-bold text-sm text-gray-900 dark:text-gray-100">Your Credentials</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-450 mt-0.5">VTOP accounts, credentials sync & password management</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={handleReload}
                        className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800/80 transition-colors shrink-0"
                        title="Refresh credentials"
                      >
                        <RefreshCcw className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-gray-450 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-gray-500">Log in to VTOP to view details</div>
              )}
            </section>
          )}

          {/* Section: Data Sync */}
          {filteredSections.some(s => s.id === "sync") && (
            <section id="sec-sync" className="scroll-mt-6 space-y-5">
              <div className="flex items-center gap-2 pb-1 border-b border-gray-150 dark:border-gray-800">
                <RefreshCcw className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Data Sync Preferences</h2>
              </div>

              <div className="bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-gray-200/80 dark:border-gray-800 p-5 space-y-4">
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
                          <Switch checked={settings?.syncArrearData ?? true} onCheckedChange={(val) => {
                            setSettings((prev: any) => ({ ...prev, syncArrearData: val }));
                            localStorage.setItem("settings", JSON.stringify({ ...settings, syncArrearData: val }));
                          }} />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-200">Course Option Change</p>
                            <p className="text-[10px] text-gray-450">Track optional elective changes</p>
                          </div>
                          <Switch checked={settings?.syncCourseOptionChange ?? true} onCheckedChange={(val) => {
                            setSettings((prev: any) => ({ ...prev, syncCourseOptionChange: val }));
                            localStorage.setItem("settings", JSON.stringify({ ...settings, syncCourseOptionChange: val }));
                          }} />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-200">EXC Registration</p>
                            <p className="text-[10px] text-gray-450">Extra-curricular registrations status</p>
                          </div>
                          <Switch checked={settings?.syncExcRegistration ?? true} onCheckedChange={(val) => {
                            setSettings((prev: any) => ({ ...prev, syncExcRegistration: val }));
                            localStorage.setItem("settings", JSON.stringify({ ...settings, syncExcRegistration: val }));
                          }} />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-200">Minor / Honour Course</p>
                            <p className="text-[10px] text-gray-450">Minor and Honour program registration info</p>
                          </div>
                          <Switch checked={settings?.syncMinorHonour ?? true} onCheckedChange={(val) => {
                            setSettings((prev: any) => ({ ...prev, syncMinorHonour: val }));
                            localStorage.setItem("settings", JSON.stringify({ ...settings, syncMinorHonour: val }));
                          }} />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-200">Course Completion</p>
                            <p className="text-[10px] text-gray-450">Academic credits check completion status</p>
                          </div>
                          <Switch checked={settings?.syncCourseCompletion ?? true} onCheckedChange={(val) => {
                            setSettings((prev: any) => ({ ...prev, syncCourseCompletion: val }));
                            localStorage.setItem("settings", JSON.stringify({ ...settings, syncCourseCompletion: val }));
                          }} />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-200">Additional Learning</p>
                            <p className="text-[10px] text-gray-450">Extra certifications and non-graded learning</p>
                          </div>
                          <Switch checked={settings?.syncAdditionalLearning ?? true} onCheckedChange={(val) => {
                            setSettings((prev: any) => ({ ...prev, syncAdditionalLearning: val }));
                            localStorage.setItem("settings", JSON.stringify({ ...settings, syncAdditionalLearning: val }));
                          }} />
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
                          <Switch checked={settings?.syncProfileData ?? true} onCheckedChange={(val) => {
                            setSettings((prev: any) => ({ ...prev, syncProfileData: val }));
                            localStorage.setItem("settings", JSON.stringify({ ...settings, syncProfileData: val }));
                          }} />
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
                          <Switch checked={settings?.syncExamData ?? true} onCheckedChange={(val) => {
                            setSettings((prev: any) => ({ ...prev, syncExamData: val }));
                            localStorage.setItem("settings", JSON.stringify({ ...settings, syncExamData: val }));
                          }} />
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
                          <Switch checked={settings?.syncWishlist ?? true} onCheckedChange={(val) => {
                            setSettings((prev: any) => ({ ...prev, syncWishlist: val }));
                            localStorage.setItem("settings", JSON.stringify({ ...settings, syncWishlist: val }));
                          }} />
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
                          <Switch checked={settings?.syncProject ?? true} onCheckedChange={(val) => {
                            setSettings((prev: any) => ({ ...prev, syncProject: val }));
                            localStorage.setItem("settings", JSON.stringify({ ...settings, syncProject: val }));
                          }} />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-200">Project Course Sync</p>
                            <p className="text-[10px] text-gray-450">Fetch individual project course grades</p>
                          </div>
                          <Switch checked={settings?.syncProjectCourse ?? true} onCheckedChange={(val) => {
                            setSettings((prev: any) => ({ ...prev, syncProjectCourse: val }));
                            localStorage.setItem("settings", JSON.stringify({ ...settings, syncProjectCourse: val }));
                          }} />
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </section>
          )}

          {/* Section: Resources */}
          {filteredSections.some(s => s.id === "resources") && (
            <section id="sec-resources" className="scroll-mt-6 space-y-5">
              <div className="flex items-center gap-2 pb-1 border-b border-gray-150 dark:border-gray-800">
                <Link2 className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Resources</h2>
              </div>

              {/* Clean resources list view */}
              <div className="bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-gray-200/80 dark:border-gray-800 divide-y divide-gray-150 dark:divide-gray-800/60 overflow-hidden">
                
                {/* Utilities / Important Links */}
                {quickLinks.importantLinks.map((link) => (
                  <a key={link.id} href={link.link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 hover:bg-gray-100/50 dark:hover:bg-slate-800/30 transition-colors">
                    <div className="flex items-center gap-4 min-w-0 pr-4">
                      <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 shrink-0">
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
                      <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 shrink-0">
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
                    <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 shrink-0">
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
                    <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 shrink-0">
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
                    <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 shrink-0">
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
                    <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 shrink-0">
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
                    <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 shrink-0">
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
            </section>
          )}

          {/* Section: About */}
          {filteredSections.some(s => s.id === "about") && (
            <section id="sec-about" className="scroll-mt-6 space-y-5">
              <div className="flex items-center gap-2 pb-1 border-b border-gray-150 dark:border-gray-800">
                <Info className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">About AmazeCC</h2>
              </div>

              {/* Grouped About App Info card */}
              <div className="bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-gray-200/80 dark:border-gray-800 p-6 flex flex-col items-center text-center space-y-4">
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
                    <span className="font-bold text-gray-850 dark:text-gray-200">v2.0.4</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-medium block">Build Number</span>
                    <span className="font-bold text-gray-850 dark:text-gray-200">2026.0627</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-medium block">Last Updated</span>
                    <span className="font-bold text-gray-850 dark:text-gray-200">June 2026</span>
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
            </section>
          )}

          {/* Section: Advanced */}
          {filteredSections.some(s => s.id === "advanced") && (
            <section id="sec-advanced" className="scroll-mt-6 space-y-5">
              <div className="flex items-center gap-2 pb-1 border-b border-gray-150 dark:border-gray-800">
                <Shield className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Advanced</h2>
              </div>

              {/* Developer options, local storage reset & backup */}
              <div className="bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-gray-200/80 dark:border-gray-800 divide-y divide-gray-150 dark:divide-gray-800/60 overflow-hidden">
                
                {/* Local Storage Viewer */}
                <div onClick={openStoragePage} className="flex items-center justify-between p-4 hover:bg-gray-100/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4 min-w-0 pr-4">
                    <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 shrink-0">
                      <Database size={18} />
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 block">Local Storage Viewer</span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-455 block truncate mt-0.5">Inspect raw application database cache items and tokens</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-gray-400 shrink-0" />
                </div>

                {/* Export Settings */}
                <div onClick={handleExportSettings} className="flex items-center justify-between p-4 hover:bg-gray-100/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4 min-w-0 pr-4">
                    <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 shrink-0">
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
                    <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 shrink-0">
                      <ExternalLink size={18} />
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 block">Restore / Import Settings</span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-455 block truncate mt-0.5">Restore app options and name configurations from settings backup file</span>
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
            </section>
          )}

        </main>
      </div>
    </div>
  );
}
