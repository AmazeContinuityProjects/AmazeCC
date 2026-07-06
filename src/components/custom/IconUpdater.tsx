"use client";

import { useEffect } from "react";
import { getAssetPath } from "@/lib/utils";

export default function IconUpdater() {
  useEffect(() => {
    const updateIcon = () => {
      const savedIcon = localStorage.getItem("app-icon") || "default";
      
      // Update ALL link[rel~="icon"] tags
      const iconLinks = document.querySelectorAll("link[rel~='icon']");
      const appleIconLinks = document.querySelectorAll("link[rel='apple-touch-icon']");

      if (savedIcon === "fire") {
        const fireIconUrl = getAssetPath("/images/icons/fire.png");
        if (iconLinks.length > 0) {
          iconLinks.forEach((link) => {
            (link as HTMLLinkElement).href = fireIconUrl;
          });
        } else {
          const newIconLink = document.createElement("link");
          newIconLink.rel = "icon";
          newIconLink.href = fireIconUrl;
          document.head.appendChild(newIconLink);
        }

        if (appleIconLinks.length > 0) {
          appleIconLinks.forEach((link) => {
            (link as HTMLLinkElement).href = fireIconUrl;
          });
        } else {
          const newAppleIconLink = document.createElement("link");
          newAppleIconLink.rel = "apple-touch-icon";
          newAppleIconLink.href = fireIconUrl;
          document.head.appendChild(newAppleIconLink);
        }
      } else {
        const defaultIconUrl = getAssetPath("/favicon/favicon.ico");
        const defaultAppleIconUrl = getAssetPath("/favicon/apple-touch-icon.png");

        if (iconLinks.length > 0) {
          iconLinks.forEach((link) => {
            const sizes = (link as HTMLLinkElement).getAttribute("sizes");
            const type = (link as HTMLLinkElement).getAttribute("type");
            if (type === "image/svg+xml") {
              (link as HTMLLinkElement).href = getAssetPath("/favicon/favicon.svg");
            } else if (sizes === "96x96") {
              (link as HTMLLinkElement).href = getAssetPath("/favicon/favicon-96x96.png");
            } else {
              (link as HTMLLinkElement).href = defaultIconUrl;
            }
          });
        } else {
          const newIconLink = document.createElement("link");
          newIconLink.rel = "icon";
          newIconLink.href = defaultIconUrl;
          document.head.appendChild(newIconLink);
        }

        if (appleIconLinks.length > 0) {
          appleIconLinks.forEach((link) => {
            (link as HTMLLinkElement).href = defaultAppleIconUrl;
          });
        } else {
          const newAppleIconLink = document.createElement("link");
          newAppleIconLink.rel = "apple-touch-icon";
          newAppleIconLink.href = defaultAppleIconUrl;
          document.head.appendChild(newAppleIconLink);
        }
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
