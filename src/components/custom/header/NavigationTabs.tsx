"use client";

import { NavigationTabs as AmazeUINavigationTabs } from "@amazecontinuityprojects/amazeui";
import { getAssetPath } from "@/lib/utils";
import config from "../../../../config.json";
import { shouldShowGpa, shouldShowProfilePhoto } from "@/lib/settingsVisibility";
import { getActiveApiUrl, setActiveApiUrl, PRIMARY_API_URL, BACKUP_API_URL } from "@/lib/fetch-utils";
import { useEffect, useState } from "react";

export default function NavigationTabs(props: any) {
  const [activeApi, setActiveApi] = useState("");

  useEffect(() => {
    setActiveApi(getActiveApiUrl());
  }, []);

  const handleApiChange = (newUrl: string) => {
    setActiveApiUrl(newUrl);
    setActiveApi(newUrl);
  };

  // We only render after mounting to avoid hydration mismatch with local storage config
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <AmazeUINavigationTabs
      {...props}
      assetPrefix={getAssetPath("")}
      semesterIDs={config.semesterIDs}
      showGpa={shouldShowGpa(props.settings || {})}
      showProfilePhoto={shouldShowProfilePhoto(props.settings || {})}
      activeApi={activeApi || PRIMARY_API_URL}
      onApiChange={handleApiChange}
      primaryApiUrl={PRIMARY_API_URL}
      backupApiUrl={BACKUP_API_URL}
    />
  );
}
