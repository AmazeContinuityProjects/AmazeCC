"use client";

import { API_BASE } from "../Main";
import { X, Save, LogOut, Eye, User, Link2, ExternalLink, Github, Database, Shield, FileText, ChevronRight, History, RefreshCcw } from "lucide-react";
import { useState, useEffect, useRef } from "react";
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
import { Trophy } from "lucide-react";
import ProfileStatusCards from "../profile/ProfileStatusCards";
import AcknowledgementCards from "../profile/AcknowledgementCards";
import { Badge } from "../shared";

export default function ProfilePage({ currSemesterID, setCurrSemesterID, handleLogin, setIsReloading, handleLogOutRequest, username, password, setPassword, decimalValues, setDecimalValues, loadingScreen, setLoadingScreen, isDayscholarWithBus, setIsDayscholarWithBus, residentialStatus, setResidentialStatus, calendarType, setCalendarType, hideMobileHeader, setHideMobileHeader, reloadAllData, setReloadAllData, isLoggedIn, friendlyName, setFriendlyName, loginToVTOP, creds, refreshKey, onCardClick, onCredentialsClick, onReload, settings, setSettings }) {
    const [selectedSemester, setSelectedSemester] = useState<string>(currSemesterID);
    const [appIcon, setAppIcon] = useState<string>("default");
    const [isEditingName, setIsEditingName] = useState<boolean>(false);
    const [tempFriendlyName, setTempFriendlyName] = useState<string>(friendlyName || "");
    const [profileData, setProfileData] = useState<any>(null);
    const [profileImages, setProfileImages] = useState<any>(null);
    const [hostelInfo, setHostelInfo] = useState<any>(null);
    // Footer Modals State
    const [showStoragePage, setShowStoragePage] = useState<boolean>(false);
    const [storageData, setStorageData] = useState<Record<string, string | null>>({});
    const [showChangelog, setShowChangelog] = useState<boolean>(false);
    const [showHallOfFame, setShowHallOfFame] = useState<boolean>(false);

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

    const SectionTitle = ({ title }) => (
        <h3 className="text-sm font-semibold text-gray-500  dark:text-gray-400 uppercase tracking-wider mb-3 px-1">
            {title}
        </h3>
    );

    const CardContainer = ({ children }) => (
        <div className="glass-card mb-8">
            {children}
        </div>
    );

    const ListTile = ({ icon: Icon, title, subtitle = null, trailing = null, onClick = null, isDestructive = false, noBorder = false }) => (
        <div
            onClick={onClick}
            className={`flex items-center justify-between p-4 ${!noBorder ? 'border-b border-gray-100/50  dark:border-gray-800/50' : ''} ${onClick ? 'cursor-pointer hover:bg-white/40 dark:hover:bg-slate-700/30 dark:hover:bg-gray-800/30 transition-colors' : ''}`}
        >
            <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                <div className={`p-2 rounded-xl flex-shrink-0 ${isDestructive ? 'bg-red-100 text-red-600  dark:bg-red-900/30' : 'bg-blue-50 text-blue-600  dark:bg-blue-900/30  dark:text-blue-400'}`}>
                    <Icon size={20} />
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                    <span className={`font-medium block break-words leading-snug ${isDestructive ? 'text-red-600  dark:text-red-500' : 'text-gray-900  dark:text-gray-100'}`}>{title}</span>
                    {subtitle && <span className="text-xs text-gray-500  dark:text-gray-400 mt-0.5 block break-words leading-snug">{subtitle}</span>}
                </div>
            </div>
            <div className="flex-shrink-0">
                {trailing ? trailing : (onClick && !isDestructive ? <ChevronRight size={18} className="text-gray-400 dark:text-gray-500" /> : null)}
            </div>
        </div>
    );

    return (
        <div className="w-full h-full pb-8">
            {showStoragePage && isLoggedIn && <DataPage handleClose={() => setShowStoragePage(false)} handleDeleteItem={handleDeleteItem} storageData={storageData} />}
            {showChangelog && <ChangelogModal handleClose={() => setShowChangelog(false)} />}
            {showHallOfFame && <HallOfFameModal handleClose={() => setShowHallOfFame(false)} />}

            <div className="w-full max-w-3xl mx-auto py-2 md:py-4 space-y-4">
                {/* Student Card */}
                <CardContainer>
                    <div className="p-6 flex items-center gap-6">
                        {profileData?.image ? (
                            <img src={profileData.image} alt="Profile" className="w-20 h-20 rounded-full object-cover shadow-lg border-2 border-white dark:border-gray-800" />
                        ) : (
                            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg">
                                <User size={36} className="text-white" />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            {isEditingName ? (
                                <div className="flex items-center gap-2 max-w-sm">
                                    <input
                                        type="text"
                                        value={tempFriendlyName}
                                        onChange={(e) => setTempFriendlyName(e.target.value)}
                                        placeholder="Enter preferred name..."
                                        className="flex-1 px-3 py-1 text-lg font-bold border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-900 rounded-md text-gray-900 dark:text-gray-100"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                setFriendlyName(tempFriendlyName);
                                                setIsEditingName(false);
                                            }
                                        }}
                                    />
                                    <Button size="sm" onClick={() => { setFriendlyName(tempFriendlyName); setIsEditingName(false); }} className="bg-emerald-500 hover:bg-emerald-600 text-white">Save</Button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <h2 className="text-2xl font-bold text-gray-900  dark:text-gray-100 tracking-tight truncate max-w-[200px] sm:max-w-xs">{friendlyName || username || "Student"}</h2>
                                    <button onClick={() => setIsEditingName(true)} className="text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded hover:bg-blue-100 transition-colors">Edit</button>
                                </div>
                            )}
                            <p className="text-sm text-gray-500  dark:text-gray-400 font-medium break-words leading-snug">
                                {friendlyName ? `VTOP ID: ${username}` : "AmazeCC User"}
                                {profileData?.branch ? ` • ${profileData.branch}` : ""}
                            </p>
                        </div>
                    </div>
                    {profileData && (
                        <div className="px-6 pb-6 pt-2 grid grid-cols-2 gap-4 border-t border-gray-100  dark:border-gray-800 mt-4 pt-4">
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Blood Group</p>
                                <p className="font-medium text-gray-800 dark:text-gray-200">{profileData.bloodGroup || "N/A"}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Hostel Status</p>
                                <p className="font-medium text-gray-800 dark:text-gray-200">
                                    {profileData.isHosteller ? `${hostelInfo?.blockName || "N/A"} - ${hostelInfo?.roomNo || "N/A"}` : "Day Scholar"}
                                </p>
                            </div>
                        </div>
                    )}
                </CardContainer>

                {/* Residential Settings */}
                <SectionTitle title="Residential Settings" />
                <CardContainer>
                    <div className="p-4 space-y-4">
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setResidentialStatus("hosteller"); setIsDayscholarWithBus(false); }}
                                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                                    residentialStatus === "hosteller"
                                        ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/10"
                                        : "bg-white/40  dark:bg-black/30 text-gray-700  dark:text-gray-300 border-gray-200/80  dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-700"
                                }`}
                            >
                                Hosteller
                            </button>
                            <button
                                onClick={() => setResidentialStatus("dayscholar")}
                                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                                    residentialStatus === "dayscholar"
                                        ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/10"
                                        : "bg-white/40  dark:bg-black/30 text-gray-700  dark:text-gray-300 border-gray-200/80  dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-700"
                                }`}
                            >
                                Dayscholar
                            </button>
                        </div>
                        {residentialStatus === "dayscholar" && (
                            <label className="flex items-center gap-3 p-3 rounded-xl bg-white/40  dark:bg-black/30 border border-gray-200/80  dark:border-white/10 cursor-pointer transition-all hover:border-blue-300 dark:hover:border-blue-700">
                                <input
                                    type="checkbox"
                                    checked={isDayscholarWithBus}
                                    onChange={(e) => setIsDayscholarWithBus(e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500/50"
                                />
                                <span className="text-sm font-medium text-gray-700  dark:text-gray-300">I have bus registration</span>
                            </label>
                        )}
                    </div>
                </CardContainer>

                {/* Data Sync Preferences */}
                <SectionTitle title="Data Sync Preferences" />
                <CardContainer>
                    <div className="p-4 space-y-4">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Choose which API categories to fetch when reloading data to save time and bandwidth.</p>
                        
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Sync Profile Data</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Credentials, dayboarder info, bank info</p>
                            </div>
                            <Switch checked={settings?.syncProfileData ?? true} onCheckedChange={(val) => {
                                setSettings(prev => ({ ...prev, syncProfileData: val }));
                                localStorage.setItem("settings", JSON.stringify({ ...settings, syncProfileData: val }));
                            }} />
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Sync Arrears Data</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Arrear schedule, details, and grades</p>
                            </div>
                            <Switch checked={settings?.syncArrearData ?? true} onCheckedChange={(val) => {
                                setSettings(prev => ({ ...prev, syncArrearData: val }));
                                localStorage.setItem("settings", JSON.stringify({ ...settings, syncArrearData: val }));
                            }} />
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Sync Exam Data</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Makeup exams, compre info</p>
                            </div>
                            <Switch checked={settings?.syncExamData ?? true} onCheckedChange={(val) => {
                                setSettings(prev => ({ ...prev, syncExamData: val }));
                                localStorage.setItem("settings", JSON.stringify({ ...settings, syncExamData: val }));
                            }} />
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Sync Additional Data</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Master toggle for extra APIs</p>
                                </div>
                                <Switch checked={settings?.syncAdditionalData ?? true} onCheckedChange={(val) => {
                                    setSettings(prev => ({ ...prev, syncAdditionalData: val }));
                                    localStorage.setItem("settings", JSON.stringify({ ...settings, syncAdditionalData: val }));
                                }} />
                            </div>
                            
                            {(settings?.syncAdditionalData ?? true) && (
                                <div className="ml-4 pl-4 border-l-2 border-gray-100 dark:border-gray-800 space-y-3 mt-2">
                                    {[
                                        { key: "syncCourseOptionChange", label: "Course Option Change" },
                                        { key: "syncExcRegistration", label: "EXC Registration" },
                                        { key: "syncMinorHonour", label: "Minor Honour" },
                                        { key: "syncCourseCompletion", label: "Course Completion" },
                                        { key: "syncWishlist", label: "Wishlist" },
                                        { key: "syncAdditionalLearning", label: "Additional Learning" },
                                        { key: "syncProject", label: "Project" },
                                        { key: "syncProjectCourse", label: "Project Course" },
                                    ].map(opt => (
                                        <div key={opt.key} className="flex items-center justify-between">
                                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{opt.label}</p>
                                            <Switch checked={settings?.[opt.key as keyof typeof settings] ?? true} onCheckedChange={(val) => {
                                                setSettings(prev => ({ ...prev, [opt.key]: val }));
                                                localStorage.setItem("settings", JSON.stringify({ ...settings, [opt.key]: val }));
                                            }} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </CardContainer>

                {creds && (
                  <>
                    <SectionTitle title="Quick Overview" />
                    <ProfileStatusCards creds={creds} refreshKey={refreshKey} onCardClick={onCardClick} />
                    <AcknowledgementCards creds={creds} refreshKey={refreshKey} />
                    <div
                      onClick={() => onCredentialsClick && onCredentialsClick()}
                      className="relative group glass-card cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                    >
                      <div className="p-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
                              <User className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-gray-900  dark:text-gray-100">Your Credentials</h3>
                              <p className="text-xs text-gray-500  dark:text-gray-400">VTOP accounts, app logins & password change</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleReload}
                              className="p-2.5 rounded-xl bg-blue-50  dark:bg-blue-900/30 text-blue-600  dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800/40 dark:hover:bg-blue-800/40 transition-all active:scale-90"
                              title="Refresh credentials"
                            >
                              <RefreshCcw className="w-4 h-4" />
                            </button>
                            <div className="p-1.5 rounded-xl bg-gray-100  dark:bg-gray-800 text-gray-400">
                              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Personal Details */}
                {[profileData?.nativeLanguage, profileData?.nationality, profileData?.community, profileData?.aadharNumber, profileData?.mobileNumber].some(Boolean) && (
                    <>
                        <SectionTitle title="Personal Details" />
                        <CardContainer>
                            <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-3">
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
                                ].filter(([, v]) => v).map(([label, val]) => (
                                    <div key={String(label)}>
                                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">{String(label)}</p>
                                        <p className="font-medium text-gray-800  dark:text-gray-200 break-words">{String(val)}</p>
                                    </div>
                                ))}
                            </div>
                        </CardContainer>
                    </>
                )}

                {/* Address */}
                {(profileData?.currentAddress || profileData?.permanentAddress) && (
                    <>
                        <SectionTitle title="Address" />
                        <CardContainer>
                            {profileData.currentAddress && (
                                <div className="p-4 border-b border-gray-100  dark:border-gray-800">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Current Address</p>
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                        {Object.entries(profileData.currentAddress).filter(([, v]) => v).map(([key, val]) => (
                                            <div key={key}>
                                                <p className="text-xs text-gray-400 capitalize tracking-wider mb-0.5">{key}</p>
                                                <p className="font-medium text-gray-800  dark:text-gray-200 break-words">{String(val)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {profileData.permanentAddress && (
                                <div className="p-4">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Permanent Address</p>
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                        {Object.entries(profileData.permanentAddress).filter(([, v]) => v).map(([key, val]) => (
                                            <div key={key}>
                                                <p className="text-xs text-gray-400 capitalize tracking-wider mb-0.5">{key}</p>
                                                <p className="font-medium text-gray-800  dark:text-gray-200 break-words">{String(val)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContainer>
                    </>
                )}

                {/* Educational Info */}
                {[profileData?.educationalQualification, profileData?.schoolName, profileData?.boardUniversity, profileData?.yearOfPassing].some(Boolean) && (
                    <>
                        <SectionTitle title="Educational Information" />
                        <CardContainer>
                            <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-3">
                                {[
                                    ["Applied Degree", profileData.appliedDegree],
                                    ["Qualification", profileData.educationalQualification],
                                    ["Branch Studied", profileData.branchStudied],
                                    ["School Name", profileData.schoolName],
                                    ["Medium of Study", profileData.mediumOfStudy],
                                    ["Board / University", profileData.boardUniversity],
                                    ["Register No", profileData.registerNo],
                                    ["Class Obtained", profileData.classObtained],
                                    ["Year of Passing", profileData.yearOfPassing],
                                    ["Month of Passing", profileData.monthOfPassing],
                                    ["Break in Study", profileData.breakInStudy],
                                ].filter(([, v]) => v).map(([label, val]) => (
                                    <div key={String(label)}>
                                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">{String(label)}</p>
                                        <p className="font-medium text-gray-800  dark:text-gray-200 break-words">{String(val)}</p>
                                    </div>
                                ))}
                            </div>
                            {profileData?.schoolAddress && (
                                <div className="px-4 pb-4">
                                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">School Address</p>
                                    <p className="font-medium text-gray-800  dark:text-gray-200">{profileData.schoolAddress}</p>
                                </div>
                            )}
                        </CardContainer>
                    </>
                )}

                {/* Family Info */}
                {(profileData?.father || profileData?.mother || profileData?.brothers || profileData?.guardian) && (
                    <>
                        <SectionTitle title="Family Information" />
                        <CardContainer>
                            {profileData.brothers != null && (
                                <div className="p-4 border-b border-gray-100  dark:border-gray-800 grid grid-cols-3 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Brothers</p>
                                        <p className="font-medium text-gray-800  dark:text-gray-200">{profileData.brothers}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Sisters</p>
                                        <p className="font-medium text-gray-800  dark:text-gray-200">{profileData.sisters}</p>
                                    </div>
                                    {profileData.siblingInVIT && (
                                        <div>
                                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Sibling at VIT</p>
                                            <p className="font-medium text-gray-800  dark:text-gray-200">{profileData.siblingInVIT}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                            {profileData.father && (
                                <div className="p-4 border-b border-gray-100  dark:border-gray-800">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Father</p>
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                        {Object.entries(profileData.father).filter(([, v]) => v).map(([key, val]) => (
                                            <div key={key}>
                                                <p className="text-xs text-gray-400 capitalize tracking-wider mb-0.5">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                                                <p className="font-medium text-gray-800  dark:text-gray-200 break-words">{String(val)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {profileData.mother && (
                                <div className="p-4 border-b border-gray-100  dark:border-gray-800">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Mother</p>
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                        {Object.entries(profileData.mother).filter(([, v]) => v).map(([key, val]) => (
                                            <div key={key}>
                                                <p className="text-xs text-gray-400 capitalize tracking-wider mb-0.5">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                                                <p className="font-medium text-gray-800  dark:text-gray-200 break-words">{String(val)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {profileData.guardian && (
                                <div className="p-4">
                                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Guardian</p>
                                    <p className="font-medium text-gray-800  dark:text-gray-200">{profileData.guardian}</p>
                                </div>
                            )}
                        </CardContainer>
                    </>
                )}

                {/* Faculty & Mentors */}
                {profileImages?.proctor && (
                    <>
                        <SectionTitle title="Faculty & Mentors" />
                        <CardContainer>
                            {[{
                                role: "Proctor",
                                photo: profileImages.proctor.photoBase64,
                                details: profileImages.proctor.details || {}
                            }, ...(profileImages.hodDean?.people?.map((p: any) => ({
                                role: p.role,
                                photo: p.photoBase64,
                                details: p.details || {}
                            })) || [])].map((person, idx, arr) => (
                                <div key={idx} className={`p-4 ${idx < arr.length - 1 ? 'border-b border-gray-100  dark:border-gray-800' : ''}`}>
                                    <div className="flex items-center gap-4">
                                        {person.photo ? (
                                            <img src={person.photo} alt={person.role} className="w-16 h-16 rounded-full object-cover shadow-md border-2 border-white dark:border-gray-800" />
                                        ) : (
                                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                                                <User size={28} className="text-white" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">{person.role}</p>
                                            <p className="font-semibold text-gray-900  dark:text-gray-100 truncate">{person.details.name || "N/A"}</p>
                                            {person.details.designation && (
                                                <p className="text-xs text-gray-500  dark:text-gray-400 truncate">{person.details.designation}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                                        {Object.entries(person.details).filter(([k]) => k !== "name" && k !== "designation").map(([key, val]) => (
                                            <div key={key} className="truncate">
                                                <span className="text-xs text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}: </span>
                                                <span className="text-gray-700  dark:text-gray-300">{String(val)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </CardContainer>
                    </>
                )}


                {/* Preferences */}
                <SectionTitle title="Preferences" />
                <CardContainer>
                    <div className="p-4 border-b border-gray-100  dark:border-gray-800">
                        <div className="flex flex-col mb-2">
                            <label className="font-medium text-gray-900  dark:text-gray-100">Select Semester</label>
                            <span className="text-xs text-gray-500  dark:text-gray-400 mb-3">Change your active academic semester</span>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <select
                                    value={selectedSemester}
                                    onChange={(e) => setSelectedSemester(e.target.value)}
                                    className="flex-1 w-full px-3 py-2 border border-gray-300  dark:border-gray-700 rounded-lg bg-white/50  dark:bg-gray-800/50 text-gray-800  dark:text-gray-100"
                                >
                                    {config.semesterIDs?.map((id: string, index: number) => (
                                        <option key={index} value={id}>
                                            {id.endsWith("01") ? `FALLSEM` : id.endsWith("05") ? `WINTERSEM` : id.endsWith("07") ? `SUMMERSEM` : `UNKNOWN`} {id.slice(4, -4)}-{id.slice(6, -2)}
                                        </option>
                                    ))}
                                </select>
                                <Button onClick={handleSaveSemester} disabled={!selectedSemester || selectedSemester === currSemesterID} className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto">
                                    <Save size={16} className="mr-2" /> Save
                                </Button>
                            </div>
                        </div>
                    </div>



                    <div className="p-4 border-b border-gray-100  dark:border-gray-800">
                        <div className="flex flex-col mb-2">
                            <label className="font-medium text-gray-900  dark:text-gray-100">Academic Calendar</label>
                            <span className="text-xs text-gray-500  dark:text-gray-400 mb-3">Set your default calendar view</span>
                            <select
                                value={calendarType || "ALL"}
                                onChange={(e) => setCalendarType(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300  dark:border-gray-700 rounded-lg bg-gray-50  dark:bg-gray-800 text-gray-800  dark:text-gray-100"
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

                    <ListTile
                        icon={Shield}
                        title="Show Values Upto One Decimal Place"
                        trailing={<Switch checked={decimalValues} onCheckedChange={setDecimalValues} />}
                    />
                    <ListTile
                        icon={History}
                        title="Use Legacy Loading Screen"
                        trailing={<Switch checked={loadingScreen} onCheckedChange={setLoadingScreen} />}
                    />
                    <ListTile
                        icon={Shield}
                        title="Compact Mobile View"
                        subtitle="Hide header and stats on tabs other than Dashboard"
                        trailing={<Switch checked={hideMobileHeader} onCheckedChange={setHideMobileHeader} />}
                    />
                    <ListTile
                        icon={RefreshCcw}
                        title="Reload All Data"
                        subtitle="Refresh button updates all data, not just attendance"
                        noBorder={true}
                        trailing={<Switch checked={reloadAllData} onCheckedChange={setReloadAllData} />}
                    />
                </CardContainer>

                {/* Notifications & Documents */}
                <SectionTitle title="App Settings" />
                <CardContainer>
                    <div className="p-4 border-b border-gray-100  dark:border-gray-800">
                        <div className="flex flex-col mb-2">
                            <label className="font-medium text-gray-900  dark:text-gray-100">App Icon</label>
                            <span className="text-xs text-gray-500  dark:text-gray-400 mb-3">Choose the icon for AmazeCC</span>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => handleIconChange('default')}
                                    className={`flex flex-col items-center gap-2 p-2 rounded-xl border-2 transition-all ${appIcon === 'default' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-transparent hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                                >
                                    <img src={getAssetPath("/logo.png")} alt="Default Icon" className="w-12 h-12 rounded-xl shadow-sm" />
                                    <span className="text-xs font-medium">Default</span>
                                </button>
                                <button
                                    onClick={() => handleIconChange('fire')}
                                    className={`flex flex-col items-center gap-2 p-2 rounded-xl border-2 transition-all ${appIcon === 'fire' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-transparent hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                                >
                                    <img src={getAssetPath("/images/icons/fire.png")} alt="Fire Icon" className="w-12 h-12 rounded-xl shadow-sm" />
                                    <span className="text-xs font-medium">Fire</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="p-4 border-b border-gray-100  dark:border-gray-800">
                        <PushNotificationManager />
                    </div>
                    <div className="p-4">
                        <Links />
                    </div>
                </CardContainer>

                {/* Utilities & Quick Links */}
                <SectionTitle title="Utilities & Quick Links" />
                <CardContainer>
                    {quickLinks.importantLinks.map((link, idx) => (
                        <a key={link.id} href={link.link} target="_blank" rel="noopener noreferrer">
                            <ListTile
                                icon={Link2}
                                title={link.title}
                                subtitle={link.desc}
                                trailing={<ExternalLink size={16} className="text-gray-400 dark:text-gray-500" />}
                                noBorder={idx === quickLinks.importantLinks.length - 1}
                                onClick={() => {}}
                            />
                        </a>
                    ))}
                </CardContainer>

                {/* Socials / Community */}
                <SectionTitle title="Socials & Community" />
                <CardContainer>
                    {quickLinks.communityLinks.map((link, idx) => (
                        <a key={idx} href={link.link} target="_blank" rel="noopener noreferrer">
                            <ListTile
                                icon={ExternalLink}
                                title={link.title}
                                trailing={<ExternalLink size={16} className="text-gray-400 dark:text-gray-500" />}
                                noBorder={idx === quickLinks.communityLinks.length - 1}
                                onClick={() => {}}
                            />
                        </a>
                    ))}
                </CardContainer>

                {/* Updates */}
                <SectionTitle title="Updates" />
                <CardContainer>
                    <ListTile
                        icon={History}
                        title="Changelog"
                        subtitle="View what's new in AmazeCC"
                        noBorder={true}
                        onClick={() => setShowChangelog(true)}
                    />
                </CardContainer>

                {/* About & Footer */}
                <SectionTitle title="About AmazeCC" />
                <CardContainer>
                    <div className="p-6 flex flex-col items-center justify-center border-b border-gray-100  dark:border-gray-800">
                        <div className="scale-125 mb-4">
                            <IconToggle />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900  dark:text-gray-100">AmazeCC</h3>
                        <p className="text-sm text-gray-500  dark:text-gray-400 mb-4 text-center">Your ultimate college companion.</p>
                        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 tracking-wider text-center">MADE WITH LOVE BY SUGEETHJSA AND DHIVYANJ</p>
                    </div>
                    <ListTile icon={Trophy} title="Hall of Fame" onClick={() => setShowHallOfFame(true)} />
                    <a href="https://github.com/AmazeContinuityProjects/AmazeCC/" target="_blank" rel="noopener noreferrer">
                        <ListTile icon={Github} title="View Source on GitHub" onClick={() => {}} />
                    </a>
                    <ListTile icon={Database} title="Local Storage Viewer" onClick={openStoragePage} />
                    <ListTile icon={FileText} title="Privacy Policy" onClick={() => window.open("/privacy", "_blank")} />
                    <ListTile icon={Shield} title="Terms of Service" noBorder={true} onClick={() => window.open("/terms", "_blank")} />
                </CardContainer>

                {/* Logout Action */}
                <div className="pt-4 pb-12">
                    <button
                        onClick={handleLogOutRequest}
                        className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-2xl font-bold bg-red-100 hover:bg-red-200  dark:hover:bg-red-900/40 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600  dark:text-red-500 transition-colors shadow-sm"
                    >
                        <LogOut size={20} />
                        Log Out
                    </button>
                </div>
            </div>
        </div>
    );
}
