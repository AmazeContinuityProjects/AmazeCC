"use client";

import { useEffect } from "react";
import { getAssetPath } from "@/lib/utils";

export default function IconUpdater() {
  useEffect(() => {
    const updateIcon = () => {
      const savedIcon = localStorage.getItem("app-icon") || "default";
      const iconUrl = getAssetPath(savedIcon === "fire" ? "/images/icons/fire.png" : "/logo.png");
      
      // Update ALL link[rel~="icon"] tags
      const iconLinks = document.querySelectorAll("link[rel~='icon']");
      if (iconLinks.length > 0) {
        iconLinks.forEach((link) => {
          (link as HTMLLinkElement).href = iconUrl;
        });
      } else {
        const newIconLink = document.createElement("link");
        newIconLink.rel = "icon";
        newIconLink.href = iconUrl;
        document.head.appendChild(newIconLink);
      }

      // Update ALL link[rel="apple-touch-icon"]
      const appleIconLinks = document.querySelectorAll("link[rel='apple-touch-icon']");
      if (appleIconLinks.length > 0) {
        appleIconLinks.forEach((link) => {
          (link as HTMLLinkElement).href = iconUrl;
        });
      } else {
        const newAppleIconLink = document.createElement("link");
        newAppleIconLink.rel = "apple-touch-icon";
        newAppleIconLink.href = iconUrl;
        document.head.appendChild(newAppleIconLink);
      }

      // Dynamically update the manifest to a real static file
      const manifestUrl = getAssetPath(savedIcon === "fire" ? "/manifest-fire.json" : "/manifest.json");
      let manifestLink = document.querySelector("link[rel='manifest']") as HTMLLinkElement;
      if (!manifestLink) {
        manifestLink = document.createElement("link");
        manifestLink.rel = "manifest";
        document.head.appendChild(manifestLink);
      }
      manifestLink.href = manifestUrl;
    };

    // Run on mount
    updateIcon();

    // Listen to custom event for real-time updates
    window.addEventListener("app-icon-changed", updateIcon);
    return () => window.removeEventListener("app-icon-changed", updateIcon);
  }, []);

  return null;
}
