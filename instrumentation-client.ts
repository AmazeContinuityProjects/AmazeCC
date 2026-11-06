import posthog from "posthog-js";

const posthogProjectToken =
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || "phc_obkUKCrFiFpJGfqSbx9LsJzmZDNdzdHhvpSFDhxSwGUt";
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://shoot.amazecc.com";

if (typeof window !== "undefined") {
  if (posthogProjectToken && posthogHost) {
    posthog.init(posthogProjectToken, {
      api_host: posthogHost,
      defaults: "2026-05-30",
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: true,
      capture_exceptions: true,
      disable_session_recording: true,
      debug: process.env.NODE_ENV === "development",
      logs: {
        serviceName: "amazecc-web",
        environment: process.env.NODE_ENV,
      },
    });
  } else if (process.env.NODE_ENV !== "production") {
    console.warn(
      "[PostHog] NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN or NEXT_PUBLIC_POSTHOG_HOST is missing. Client analytics are inactive.",
    );
  }
}

/**
 * Next.js App Router navigation listener.
 * Captures route changes between top-level pages (/ffcs, /share, /terms, /privacy, /).
 */
export function onRouterTransitionStart(url: string, navigationType: "push" | "replace" | "traverse"): void {
  if (typeof window !== "undefined" && (posthog as unknown as { __loaded?: boolean }).__loaded) {
    posthog.capture("$pageview", {
      $current_url: url,
      navigation_type: navigationType,
    });
  }
}
