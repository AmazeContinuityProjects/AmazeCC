"use client";

import { X, Save, LogOut, Eye, User, Link2, ExternalLink, Github, Database, Shield, FileText, ChevronRight, History } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "../../ui/button";
import config from "../../../../config.json";
import { Switch } from "@/components/ui/switch";
import Files from "./Files";
import Links from "./Links";
import PushNotificationManager from "@/app/pushNotificationManager";
import quickLinks from "../../../data/quickLinks.json";
import DataPage from "../footer/DataPage";
import PrivacyPolicyPage from "../footer/PrivacyPolicy";
import TermsOfServicePage from "../footer/TermsOfService";
import { IconToggle } from "../toggle";
import ChangelogModal from "./ChangelogModal";

export default function ProfilePage({ currSemesterID, setCurrSemesterID, handleLogin, setIsReloading, handleLogOutRequest, username, password, setPassword, decimalValues, setDecimalValues, loadingScreen, setLoadingScreen, isDayscholarWithBus, setIsDayscholarWithBus, residentialStatus, setResidentialStatus, calendarType, setCalendarType, isLoggedIn }) {
    const [selectedSemester, setSelectedSemester] = useState<string>(currSemesterID);
    const [changeUsername, setChangedUsername] = useState<string>(username);
    const [changedPassword, setChangedPassword] = useState<string>(password);
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [appIcon, setAppIcon] = useState<string>("default");

    // Footer Modals State
    const [showStoragePage, setShowStoragePage] = useState<boolean>(false);
    const [storageData, setStorageData] = useState<Record<string, string | null>>({});
    const [showPolicy, setShowPolicy] = useState<boolean>(false);
    const [showTOS, setShowTOS] = useState<boolean>(false);
    const [showChangelog, setShowChangelog] = useState<boolean>(false);

    const handleSaveSemester = async () => {
        if (!selectedSemester) return;
        setIsReloading(true);
        await handleLogin(selectedSemester);
        setCurrSemesterID(selectedSemester);
    };

    useEffect(() => {
        setSelectedSemester(currSemesterID);
        setAppIcon(localStorage.getItem("app-icon") || "default");
    }, [currSemesterID]);

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
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 midnight:text-gray-400 uppercase tracking-wider mb-3 px-1">
            {title}
        </h3>
    );

    const CardContainer = ({ children }) => (
        <div className="bg-white dark:bg-slate-800 midnight:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 midnight:border-gray-800 overflow-hidden mb-8">
            {children}
        </div>
    );

    const ListTile = ({ icon: Icon, title, subtitle = null, trailing = null, onClick = null, isDestructive = false, noBorder = false }) => (
        <div 
            onClick={onClick}
            className={`flex items-center justify-between p-4 ${!noBorder ? 'border-b border-gray-100 dark:border-gray-800 midnight:border-gray-800' : ''} ${onClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 midnight:hover:bg-gray-800 transition-colors' : ''}`}
        >
            <div className="flex items-center gap-4 flex-1">
                <div className={`p-2 rounded-xl ${isDestructive ? 'bg-red-100 text-red-600 dark:bg-red-900/30 midnight:bg-red-900/30' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 midnight:bg-blue-900/30 dark:text-blue-400 midnight:text-blue-400'}`}>
                    <Icon size={20} />
                </div>
                <div className="flex flex-col flex-1">
                    <span className={`font-medium ${isDestructive ? 'text-red-600 dark:text-red-500 midnight:text-red-500' : 'text-gray-900 dark:text-gray-100 midnight:text-gray-100'}`}>{title}</span>
                    {subtitle && <span className="text-xs text-gray-500 dark:text-gray-400 midnight:text-gray-400 mt-0.5">{subtitle}</span>}
                </div>
            </div>
            {trailing ? trailing : (onClick && !isDestructive ? <ChevronRight size={18} className="text-gray-400 midnight:text-gray-500" /> : null)}
        </div>
    );

    return (
        <div className="w-full h-full pb-8">
            {showStoragePage && isLoggedIn && <DataPage handleClose={() => setShowStoragePage(false)} handleDeleteItem={handleDeleteItem} storageData={storageData} />}
            {showPolicy && <PrivacyPolicyPage handleClose={() => setShowPolicy(false)} />}
            {showTOS && <TermsOfServicePage handleClose={() => setShowTOS(false)} />}
            {showChangelog && <ChangelogModal handleClose={() => setShowChangelog(false)} />}

            <div className="max-w-3xl mx-auto p-4 py-6 md:py-8 space-y-2">
                {/* Student Card */}
                <CardContainer>
                    <div className="p-6 flex items-center gap-6">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg">
                            <User size={36} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100 tracking-tight">{username || "Student"}</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 midnight:text-gray-400 font-medium">AmazeCC User</p>
                        </div>
                    </div>
                </CardContainer>

                {/* Preferences */}
                <SectionTitle title="Preferences" />
                <CardContainer>
                    <div className="p-4 border-b border-gray-100 dark:border-gray-800 midnight:border-gray-800">
                        <div className="flex flex-col mb-2">
                            <label className="font-medium text-gray-900 dark:text-gray-100 midnight:text-gray-100">Select Semester</label>
                            <span className="text-xs text-gray-500 dark:text-gray-400 midnight:text-gray-400 mb-3">Change your active academic semester</span>
                            <div className="flex gap-2">
                                <select
                                    value={selectedSemester}
                                    onChange={(e) => setSelectedSemester(e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 midnight:border-gray-700 rounded-lg bg-gray-50 dark:bg-slate-900 midnight:bg-gray-800 text-gray-800 dark:text-gray-200 midnight:text-gray-100"
                                >
                                    {config.semesterIDs?.map((id: string, index: number) => (
                                        <option key={index} value={id}>
                                            {id.endsWith("01") ? `FALLSEM` : id.endsWith("05") ? `WINTERSEM` : id.endsWith("07") ? `SUMMERSEM` : `UNKNOWN`} {id.slice(4, -4)}-{id.slice(6, -2)}
                                        </option>
                                    ))}
                                </select>
                                <Button onClick={handleSaveSemester} disabled={!selectedSemester || selectedSemester === currSemesterID} className="bg-blue-600 hover:bg-blue-700 text-white">
                                    <Save size={16} className="mr-2" /> Save
                                </Button>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-4 border-b border-gray-100 dark:border-gray-800 midnight:border-gray-800">
                        <div className="flex flex-col mb-2">
                            <label className="font-medium text-gray-900 dark:text-gray-100 midnight:text-gray-100">Update VTOP Credentials</label>
                            <span className="text-xs text-gray-500 dark:text-gray-400 midnight:text-gray-400 mb-3">Change credentials stored inside AmazeCC</span>
                            <div className="flex flex-col gap-2">
                                <input
                                    type="text"
                                    value={changeUsername}
                                    onChange={(e) => setChangedUsername(e.target.value)}
                                    placeholder="Username"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 midnight:border-gray-700 rounded-lg bg-gray-50 dark:bg-slate-900 midnight:bg-gray-800 text-gray-800 dark:text-gray-200 midnight:text-gray-100"
                                />
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={changedPassword}
                                        onChange={(e) => setChangedPassword(e.target.value)}
                                        placeholder="Password"
                                        className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-700 midnight:border-gray-700 rounded-lg bg-gray-50 dark:bg-slate-900 midnight:bg-gray-800 text-gray-800 dark:text-gray-200 midnight:text-gray-100"
                                    />
                                    <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 midnight:text-gray-400">
                                        <Eye size={16} />
                                    </button>
                                </div>
                                <Button onClick={() => setPassword([changeUsername, changedPassword])} disabled={!changeUsername || !changedPassword || (changeUsername === username && changedPassword === password)} className="bg-blue-600 hover:bg-blue-700 midnight:bg-blue-700 midnight:hover:bg-blue-600 text-white mt-1">
                                    <Save size={16} className="mr-2" /> Update Credentials
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-b border-gray-100 dark:border-gray-800 midnight:border-gray-800">
                        <div className="flex flex-col mb-2">
                            <label className="font-medium text-gray-900 dark:text-gray-100 midnight:text-gray-100">Residential Status</label>
                            <span className="text-xs text-gray-500 dark:text-gray-400 midnight:text-gray-400 mb-3">Changes which tabs are visible</span>
                            <select
                                value={residentialStatus || "hosteller"}
                                onChange={(e) => setResidentialStatus(e.target.value as "hosteller" | "dayscholar")}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 midnight:border-gray-700 rounded-lg bg-gray-50 dark:bg-slate-900 midnight:bg-gray-800 text-gray-800 dark:text-gray-200 midnight:text-gray-100"
                            >
                                <option value="hosteller">Hosteller</option>
                                <option value="dayscholar">Dayscholar</option>
                            </select>
                        </div>
                    </div>

                    <div className="p-4 border-b border-gray-100 dark:border-gray-800 midnight:border-gray-800">
                        <div className="flex flex-col mb-2">
                            <label className="font-medium text-gray-900 dark:text-gray-100 midnight:text-gray-100">Academic Calendar</label>
                            <span className="text-xs text-gray-500 dark:text-gray-400 midnight:text-gray-400 mb-3">Set your default calendar view</span>
                            <select
                                value={calendarType || "ALL"}
                                onChange={(e) => setCalendarType(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 midnight:border-gray-700 rounded-lg bg-gray-50 dark:bg-slate-900 midnight:bg-gray-800 text-gray-800 dark:text-gray-200 midnight:text-gray-100"
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
                        icon={User} 
                        title="Dayscholar with Bus" 
                        subtitle="Calculate attendance against 85% requirement"
                        noBorder={true}
                        trailing={<Switch checked={isDayscholarWithBus} onCheckedChange={setIsDayscholarWithBus} />} 
                    />
                </CardContainer>

                {/* Notifications & Documents */}
                <SectionTitle title="App Settings" />
                <CardContainer>
                    <div className="p-4 border-b border-gray-100 dark:border-gray-800 midnight:border-gray-800">
                        <div className="flex flex-col mb-2">
                            <label className="font-medium text-gray-900 dark:text-gray-100 midnight:text-gray-100">App Icon</label>
                            <span className="text-xs text-gray-500 dark:text-gray-400 midnight:text-gray-400 mb-3">Choose the icon for AmazeCC</span>
                            <div className="flex gap-4">
                                <button 
                                    onClick={() => handleIconChange('default')}
                                    className={`flex flex-col items-center gap-2 p-2 rounded-xl border-2 transition-all ${appIcon === 'default' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-transparent hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                                >
                                    <img src="/logo.png" alt="Default Icon" className="w-12 h-12 rounded-xl shadow-sm" />
                                    <span className="text-xs font-medium">Default</span>
                                </button>
                                <button 
                                    onClick={() => handleIconChange('fire')}
                                    className={`flex flex-col items-center gap-2 p-2 rounded-xl border-2 transition-all ${appIcon === 'fire' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-transparent hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                                >
                                    <img src="/icons/fire.png" alt="Fire Icon" className="w-12 h-12 rounded-xl shadow-sm" />
                                    <span className="text-xs font-medium">Fire</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="p-4 border-b border-gray-100 dark:border-gray-800 midnight:border-gray-800">
                        <PushNotificationManager />
                    </div>
                    <div className="p-4 border-b border-gray-100 dark:border-gray-800 midnight:border-gray-800">
                        <Files />
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
                                trailing={<ExternalLink size={16} className="text-gray-400 midnight:text-gray-500" />}
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
                                trailing={<ExternalLink size={16} className="text-gray-400 midnight:text-gray-500" />}
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
                    <div className="p-6 flex flex-col items-center justify-center border-b border-gray-100 dark:border-gray-800 midnight:border-gray-800">
                        <div className="scale-125 mb-4">
                            <IconToggle />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100">AmazeCC</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 midnight:text-gray-400 mb-4 text-center">Your ultimate college companion.</p>
                        <p className="text-xs font-semibold text-gray-400 midnight:text-gray-500 tracking-wider">MADE BY SUGEETHJSA</p>
                    </div>
                    <a href="https://github.com/SugeethJSA/UniCC" target="_blank" rel="noopener noreferrer">
                        <ListTile icon={Github} title="View Source on GitHub" onClick={() => {}} />
                    </a>
                    <a href="https://amaze-cc.vercel.app" target="_blank" rel="noopener noreferrer">
                        <ListTile icon={ExternalLink} title="Visit Official Website" onClick={() => {}} />
                    </a>
                    <ListTile icon={Database} title="Local Storage Viewer" onClick={openStoragePage} />
                    <ListTile icon={FileText} title="Privacy Policy" onClick={() => setShowPolicy(true)} />
                    <ListTile icon={Shield} title="Terms of Service" noBorder={true} onClick={() => setShowTOS(true)} />
                </CardContainer>

                {/* Logout Action */}
                <div className="pt-4 pb-12">
                    <button
                        onClick={handleLogOutRequest}
                        className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-2xl font-bold bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/40 midnight:bg-red-900/20 midnight:hover:bg-red-900/40 text-red-600 dark:text-red-500 midnight:text-red-500 transition-colors shadow-sm"
                    >
                        <LogOut size={20} />
                        Log Out
                    </button>
                </div>
            </div>
        </div>
    );
}
