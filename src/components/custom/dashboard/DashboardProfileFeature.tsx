"use client";

import dynamic from "next/dynamic";
import type { ComponentProps, Dispatch, SetStateAction } from "react";
import type ProfileTabComponent from "../profile/ProfileTab";
import type { Credentials } from "@/store/authAtoms";
import type { Settings } from "@/store/settingsAtoms";
import { useDashboardNavigator } from "./DashboardNavigator";
import { PageSkeleton } from "../shared/primitives/PageSkeleton";

type ProfileTabProps = ComponentProps<typeof ProfileTabComponent>;
type ProfileTabOwnedProps =
  | "activeProfileSubTab"
  | "setActiveProfileSubTab"
  | "isLoggedIn"
  | "currSemesterID"
  | "setCurrSemesterID"
  | "password"
  | "username"
  | "setPassword"
  | "decimalValues"
  | "setDecimalValues"
  | "isDayscholarWithBus"
  | "setIsDayscholarWithBus"
  | "residentialStatus"
  | "setResidentialStatus"
  | "friendlyName"
  | "setFriendlyName"
  | "calendarType"
  | "setCalendarType"
  | "reloadAllData"
  | "setReloadAllData"
  | "settings"
  | "setSettings";

interface DashboardProfileFeatureProps extends Omit<ProfileTabProps, ProfileTabOwnedProps> {
  settings: Settings;
  setSettings: Dispatch<SetStateAction<Settings>>;
  IDs: Credentials;
  setIDs: Dispatch<SetStateAction<Credentials>>;
}

function FeatureLoading() {
  return <PageSkeleton label="Loading profile" />;
}

const ProfileTab = dynamic(() => import("../profile/ProfileTab"), { loading: FeatureLoading });

/** Profile screen and its settings/credential persistence adapters. */
export default function DashboardProfileFeature({
  settings,
  setSettings,
  IDs,
  setIDs,
  ...profileProps
}: DashboardProfileFeatureProps) {
  const { activeProfileSubTab, setActiveProfileSubTab } = useDashboardNavigator();
  const updateSetting = (key: keyof Settings, value: unknown) => {
    setSettings((previous) => {
      const next = { ...previous, [key]: value };
      return next;
    });
  };

  return (
    <div className="animate-fadeIn">
      <ProfileTab
        {...profileProps}
        activeProfileSubTab={activeProfileSubTab}
        setActiveProfileSubTab={setActiveProfileSubTab}
        isLoggedIn={true}
        currSemesterID={settings.currSemesterID}
        setCurrSemesterID={(value: string) => updateSetting("currSemesterID", value)}
        password={IDs.VtopPassword}
        username={IDs.VtopUsername}
        setPassword={(value: string[]) => {
          setIDs((previous) => {
            const next = { ...previous, VtopUsername: value[0], VtopPassword: value[1] };
            localStorage.setItem("IDs", JSON.stringify(next));
            return next;
          });
        }}
        decimalValues={settings.decimalValues}
        setDecimalValues={(value: boolean) => updateSetting("decimalValues", value)}
        isDayscholarWithBus={settings.isDayscholarWithBus}
        setIsDayscholarWithBus={(value: boolean) => updateSetting("isDayscholarWithBus", value)}
        residentialStatus={settings.residentialStatus || "hosteller"}
        setResidentialStatus={(value: "hosteller" | "dayscholar") => updateSetting("residentialStatus", value)}
        friendlyName={settings.friendlyName}
        setFriendlyName={(value: string) => updateSetting("friendlyName", value)}
        calendarType={settings.calendarType}
        setCalendarType={(value: Settings["calendarType"]) => updateSetting("calendarType", value)}
        reloadAllData={settings.reloadAllData}
        setReloadAllData={(value: boolean) => updateSetting("reloadAllData", value)}
        settings={settings}
        setSettings={setSettings}
      />
    </div>
  );
}
