"use client";

import { useState, useEffect } from "react";
import ProfilePage from "../header/ProfilePage";
import { clearApiCache } from "../exams/GenericApiView";

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
  reloadAllData: boolean;
  setReloadAllData: (val: boolean) => void;
  settings: any;
  setSettings: (val: any) => void;
}

function useCredentialSection(loginToVTOP: () => Promise<any>) {
  const [creds, setCreds] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loginToVTOP().then(setCreds).catch(() => {});
  }, [loginToVTOP]);

  return {
    creds,
    refreshKey,
    setRefreshKey,
    reload: () => {
      clearApiCache();
      setRefreshKey((k) => k + 1);
    },
  };
}

export default function ProfileTab(props: ProfileTabProps) {
  const {
    activeProfileSubTab,
    setActiveProfileSubTab,
    loginToVTOP,
    username,
    password,
    setPassword,
    ...profilePageProps
  } = props;
  const { creds, refreshKey, reload } = useCredentialSection(loginToVTOP);

  return (
    <div className="animate-fadeIn w-full max-w-7xl mx-auto">
      <ProfilePage
        {...profilePageProps}
        loginToVTOP={loginToVTOP}
        username={username}
        password={password}
        setPassword={setPassword}
        creds={creds}
        refreshKey={refreshKey}
        onReload={reload}
        mode={activeProfileSubTab || "profile"}
      />
    </div>
  );
}
