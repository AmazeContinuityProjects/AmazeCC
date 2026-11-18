"use client";

import ProfileTab from "../profile/ProfileTab";
import type { ComponentProps, Dispatch, SetStateAction } from "react";
import { useAtomValue } from "jotai";
import { unifiedIdentityAtom } from "@/store";
import type { UnifiedUserIdentity } from "@/types";
import type { Credentials } from "@/store/authAtoms";
import type { Settings } from "@/store/settingsAtoms";
import { useDashboardNavigator } from "./DashboardNavigator";

type ProfileTabProps = ComponentProps<typeof ProfileTab>;
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

/** Profile screen and its settings/credential persistence adapters. */
export default function DashboardProfileFeature({
  settings,
  setSettings,
  IDs,
  setIDs,
  ...profileProps
}: DashboardProfileFeatureProps) {
  const { activeProfileSubTab, setActiveProfileSubTab } = useDashboardNavigator();
  const unifiedIdentity: UnifiedUserIdentity = useAtomValue(unifiedIdentityAtom);
  const updateSetting = (key: keyof Settings, value: unknown) => {
    setSettings((previous) => {
      const next = { ...previous, [key]: value };
      return next;
    });
  };

  return (
    <div>
      <ProfileTab
        {...profileProps}
        activeProfileSubTab={activeProfileSubTab}
        setActiveProfileSubTab={setActiveProfileSubTab}
        isLoggedIn={true}
        currSemesterID={settings.currSemesterID}
        setCurrSemesterID={(value: string) => updateSetting("currSemesterID", value)}
        password={IDs?.VtopPassword || ""}
        username={IDs?.VtopUsername || unifiedIdentity.regNumber}
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
        friendlyName={settings.friendlyName || unifiedIdentity.friendlyName}
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
