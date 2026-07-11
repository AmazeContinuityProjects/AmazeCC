# AmazeCC App Routes Documentation

> This document was automatically generated to assist in translating and understanding the codebase.

Total Files: 10

---

## File: `AmazeCC\src\app\error.tsx`

### Imports
```typescript
import { useEffect } from "react";
import ErrorDiagnosticCard from "@/components/custom/ErrorDiagnosticCard";
```

### Exports
```typescript
export default function ErrorPage({
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";

import { useEffect } from "react";
import ErrorDiagnosticCard from "@/components/custom/ErrorDiagnosticCard";

type ErrorWithDigest = Error & { digest?: string };

export default function ErrorPage({
  error,
  reset,
}: {
  error: ErrorWithDigest;
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AmazeCC client route error]", error);
    if (
      error.name === "ChunkLoadError" ||
      error.message?.includes("Loading chunk") ||
      error.message?.includes("Loading CSS chunk")
    ) {
      const lastReload = sessionStorage.getItem("last_chunk_load_reload");
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem("last_chunk_load_reload", now.toString());
        console.warn("ChunkLoadError detected. Reloading page to fetch latest bundle...");
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <ErrorDiagnosticCard
      title="Something failed while loading this page"
      description="Share this report with the developer to diagnose user-specific crashes that are difficult to reproduce."
      error={error}
      onRetry={reset}
    />
  );
}

```
</details>

---

## File: `AmazeCC\src\app\global-error.tsx`

### Imports
```typescript
import { useEffect } from "react";
import ErrorDiagnosticCard from "@/components/custom/ErrorDiagnosticCard";
```

### Exports
```typescript
export default function GlobalError({
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";

import { useEffect } from "react";
import ErrorDiagnosticCard from "@/components/custom/ErrorDiagnosticCard";

type ErrorWithDigest = Error & { digest?: string };

export default function GlobalError({
  error,
  reset,
}: {
  error: ErrorWithDigest;
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AmazeCC global app error]", error);
    if (
      error.name === "ChunkLoadError" ||
      error.message?.includes("Loading chunk") ||
      error.message?.includes("Loading CSS chunk")
    ) {
      const lastReload = sessionStorage.getItem("last_chunk_load_reload");
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem("last_chunk_load_reload", now.toString());
        console.warn("ChunkLoadError detected. Reloading page to fetch latest bundle...");
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-gray-100 text-foreground transition-colors duration-300  dark:bg-black">
        <ErrorDiagnosticCard
          title="A critical app error occurred"
          description="The app shell failed to render. Copy the full report and send it to support for root-cause analysis."
          error={error}
          onRetry={reset}
        />
      </body>
    </html>
  );
}

```
</details>

---

## File: `AmazeCC\src\app\layout.tsx`

### Imports
```typescript
import * as React from "react"
import { ThemeProvider } from "@amazecontinuityprojects/amazeui";
import { GoogleAnalytics } from "@next/third-parties/google";
import IconUpdater from "../components/custom/IconUpdater";
import type { Viewport, Metadata } from "next";
import './globals.css';
```

### Exports
```typescript
export const viewport: Viewport = {
export const metadata: Metadata = {
export default function RootLayout({ children }: { children: React.ReactNode }) {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import * as React from "react"
import { ThemeProvider } from "@amazecontinuityprojects/amazeui";
import { GoogleAnalytics } from "@next/third-parties/google";
import IconUpdater from "../components/custom/IconUpdater";
import type { Viewport, Metadata } from "next";
import './globals.css';

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
};

const APP_NAME = "AmazeCC";
const APP_DESCRIPTION = "Showing data from VTOP in a clean and simple way.";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_NAME,
    template: "%s - AmazeCC App",
  },
  description: APP_DESCRIPTION,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon/favicon.ico' },
      { url: '/favicon/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon/favicon.svg', type: 'image/svg+xml' }
    ],
    shortcut: '/favicon/favicon.ico',
    apple: '/favicon/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Geist:wght@100..900&family=Geist+Mono:wght@100..900&display=swap" rel="stylesheet" />
      </head>
      <body
        suppressHydrationWarning
        className="antialiased font-sans"
      >
        <IconUpdater />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
          value={{ light: "light", dark: "dark" }}
        >
          {children}
        </ThemeProvider>
      </body>
      <GoogleAnalytics gaId="G-40NYS6B13N" />
      <GoogleAnalytics gaId="G-2H76BLP4VK" />
    </html>
  );
}

```
</details>

---

## File: `AmazeCC\src\app\not-found.tsx`

### Imports
```typescript
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@amazecontinuityprojects/amazeui";
import {
import { HelpCircle } from "lucide-react";
```

### Exports
```typescript
export default function NotFoundPage() {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@amazecontinuityprojects/amazeui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@amazecontinuityprojects/amazeui";
import { HelpCircle } from "lucide-react";

export default function NotFoundPage() {
  const pathname = usePathname();

  return (
    <main className="min-h-screen w-full bg-slate-50 px-4 text-foreground transition-colors duration-300 dark:bg-[#03060F] flex items-center justify-center py-10">
      <div className="w-full max-w-xl animate-in fade-in duration-300">
        <Card className="w-full border-slate-200 bg-white/70 backdrop-blur-md shadow-2xl dark:border-neutral-900 dark:bg-neutral-950/40 rounded-3xl overflow-hidden relative text-center">
          {/* Subtle background gradient glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-full pointer-events-none -z-10" />

          <CardHeader className="pt-8">
            {/* Professional Search/404 Icon */}
            <div className="flex justify-center mb-6">
              <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-650 dark:text-indigo-400">
                <HelpCircle className="w-10 h-10 stroke-[2]" />
                <div className="absolute inset-0 rounded-full border border-indigo-500/35 animate-pulse duration-2000 pointer-events-none" />
              </div>
            </div>

            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500 font-[family-name:var(--font-outfit)]">Routing Error</p>
            <CardTitle className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white mt-1">Page not found</CardTitle>
            <CardDescription className="text-xs md:text-sm mt-2 text-slate-500 dark:text-gray-400 font-medium max-w-sm mx-auto leading-relaxed">
              The requested resource does not exist, has been moved, or may be temporary unavailable.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 px-6 md:px-8 pb-8">
            <div className="rounded-2xl border border-slate-205 dark:border-neutral-900 bg-slate-50/50 dark:bg-neutral-950/20 p-4 text-xs font-semibold text-slate-700 dark:text-gray-300 leading-relaxed text-left flex justify-between items-center">
              <span className="text-slate-455 dark:text-gray-550 font-bold uppercase tracking-wider text-[9px]">Requested path</span>
              <span className="font-mono text-slate-500 dark:text-gray-400 truncate max-w-[65%]">{pathname || "unknown"}</span>
            </div>

            <div className="flex justify-center gap-3">
              <Button asChild className="rounded-xl font-bold text-xs py-2 min-h-[38px] px-6 cursor-pointer">
                <Link href="/">Dashboard</Link>
              </Button>
              <Button variant="outline" onClick={() => window.history.back()} className="rounded-xl font-bold text-xs py-2 min-h-[38px] px-6 cursor-pointer">
                Go back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

```
</details>

---

## File: `AmazeCC\src\app\page.tsx`

### Imports
```typescript
import Main from "../components/custom/Main";
```

### Exports
```typescript
export default function Home() {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import Main from "../components/custom/Main";

export default function Home() {
  return (
    <div>
      <Main />
    </div>
  );
}

```
</details>

---

## File: `AmazeCC\src\app\privacy\page.tsx`

### Imports
```typescript
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
```

### Exports
```typescript
export default function PrivacyPolicyPage() {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full px-4 py-12 bg-gray-50/50  dark:bg-black transition-colors duration-300 relative overflow-hidden">
      {/* Ambient Background Glows */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10  dark:bg-blue-500/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10  dark:bg-emerald-500/5 blur-[120px]" />
      </div>

      <div className="w-full max-w-2xl space-y-6 relative z-10">
        {/* Back Link */}
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600  dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 dark:hover:text-blue-400 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Login
        </Link>

        {/* Content Card */}
        <div className="bg-white dark:bg-gray-900  border border-gray-200/50  dark:border-white/10 rounded-2xl p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)]  dark:shadow-[0_8px_30px_rgba(255,255,255,0.02)] space-y-6 text-gray-700  dark:text-gray-300">
          <div className="border-b border-gray-100  dark:border-white/10 pb-4">
            <h1 className="text-3xl font-black text-gray-900  dark:text-white leading-tight">
              Privacy Policy
            </h1>
            <p className="text-xs text-gray-500  dark:text-gray-400 mt-1">
              Last updated: 11 Nov, 2025
            </p>
          </div>

          <div className="space-y-5 text-sm leading-relaxed">
            <p>
              This Privacy Policy describes how <strong>AmazeCC</strong> handles data when you use the app.
            </p>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900  dark:text-white">
                Data Storage
              </h2>
              <p>
                All data fetched from <strong>VTOP</strong> (including your academic data, credentials, or
                related content) is stored <strong>locally on your device</strong>. No information from VTOP is
                ever uploaded, transmitted, or stored on any external servers controlled by this app, with the exception of the Grade Prediction feature.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900  dark:text-white">
                Grade Prediction & Statistics
              </h2>
              <p>
                To calculate global class statistics (mean and standard deviation) for the Grade Prediction feature, your academic marks are temporarily sent to our server via an encrypted connection. 
                The server strictly processes the numbers in-memory to incrementally update the class-wide averages using Welford's Algorithm and then <strong>immediately discards</strong> your individual marks. 
                We do not store, map, or link any marks to any user. The process is completely anonymous. 
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900  dark:text-white">
                Cookies & Analytics
              </h2>
              <p>
                <strong>AmazeCC</strong> uses <strong>Vercel Analytics</strong> and <strong>Google Analytics</strong> to gather <em>anonymous, aggregate data</em> such as page visits, device types, and general interaction information. These analytics help improve the app’s performance and user experience.
              </p>
              <p>
                This data does <strong>not</strong> include any personally identifiable information such as names, login credentials, or academic records. The analytics cookies are handled entirely by <strong>Google</strong> and <strong>Vercel</strong> under their respective privacy policies.
              </p>
              <p>
                AmazeCC does not track users, create profiles, sell data, or share analytics with any third party. These analytics are used purely for <strong>educational and experimental</strong> purposes and can be cleared anytime by removing browser cookies.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900  dark:text-white">
                Notifications
              </h2>
              <p>
                The app may send push notifications if you opt in. You can disable push notifications at any time through your browser settings. There are no background processes that track or monitor user behavior.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900  dark:text-white">
                Local Storage
              </h2>
              <p>
                Settings, preferences, and any cached data are stored using your browser’s local storage mechanism. This data never leaves your device and can be cleared manually at any time from within the app.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900  dark:text-white">
                Open Source
              </h2>
              <p>
                <strong>AmazeCC</strong> is an <strong>open-source project</strong> created for learning and experimentation purposes. The source code is publicly available, and anyone is welcome to explore, modify, or contribute improvements through the project’s GitHub repository.
              </p>
              <p>
                Contributions are voluntary and governed by the project’s open-source license. No data collected by contributors or modifications affects user privacy or transmits information externally.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900  dark:text-white">
                Contact
              </h2>
              <p>
                For any concerns or questions about this Privacy Policy, you can reach out to the developer at <strong>sugeeth2007@gmail.com</strong>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

```
</details>

---

## File: `AmazeCC\src\app\pushNotificationManager.tsx`

### Imports
```typescript
import { useState, useEffect, useCallback } from 'react'
import { Switch } from "@amazecontinuityprojects/amazeui"
import { API_BASE } from "@/components/custom/Main";
```

### Exports
```typescript
export default function PushNotificationManager() {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Switch } from "@amazecontinuityprojects/amazeui"
import { API_BASE } from "@/components/custom/Main";

function urlBase64ToUint8Array(base64String: string) {
    if (!base64String) return new Uint8Array(0);
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export default function PushNotificationManager() {
    const [isSupported, setIsSupported] = useState(false)
    const [subscription, setSubscription] = useState<PushSubscription | null>(null)
    const [vitolEnabled, setVitolEnabled] = useState(false)
    const [vitolReminderDay, setVitolReminderDay] = useState<number>(1)
    const [vitolReminderTime, setVitolReminderTime] = useState<string>("10:00")
    const [fetchError, setFetchError] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [userID, setUserID] = useState<string | null>(null)

    // Class Reminders State
    const [classRemindersEnabled, setClassRemindersEnabled] = useState(false)
    const [classReminderOffset, setClassReminderOffset] = useState(15)

    useEffect(() => {
        try {
            const raw = localStorage.getItem("IDs");
            if (raw) {
                const parsed = JSON.parse(raw);
                setUserID(parsed?.VtopUsername || null);
            }
        } catch {
            setUserID(null);
        }
        
        // Load class reminder settings
        const enabled = localStorage.getItem("classRemindersEnabled") === "true";
        const offset = parseInt(localStorage.getItem("classReminderOffset") || "15", 10);
        setClassRemindersEnabled(enabled);
        setClassReminderOffset(offset);
    }, [])

    useEffect(() => {
        if (!userID) return;

        fetch(`${API_BASE}/api/notifications/status?UserID=${userID}`)
            .then(res => res.json())
            .then(data => {
                setVitolEnabled(!!data.vitol);
                if (data.vitol_reminder_day !== undefined) setVitolReminderDay(data.vitol_reminder_day);
                if (data.vitol_reminder_time) setVitolReminderTime(data.vitol_reminder_time);
            })
            .catch(() => {
                setVitolEnabled(false);
            });
    }, [userID]);

    useEffect(() => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true)
            registerServiceWorker()
        }
    }, [])

    async function registerServiceWorker() {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js')
            await navigator.serviceWorker.ready
            const sub = await registration.pushManager.getSubscription()
            setSubscription(sub)
        } catch (e) {
            console.error("Service worker registration failed", e);
        }
    }

    async function subscribeToPush() {
        if (!userID) {
            setFetchError("User not logged in.");
            return;
        }

        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
            console.error('VAPID public key not found. Push notifications are disabled.');
            setFetchError('Push notifications are not configured correctly (missing VAPID key).');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready

            let sub = await registration.pushManager.getSubscription()

            if (!sub) {
                sub = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
                })
            }

            setSubscription(sub)

            if (Notification.permission === 'granted') {
                new Notification("Welcome to AmazeCC Alerts!", {
                    body: "Push notifications are now enabled. You will receive scheduled reminders directly on this device.",
                    icon: "/favicon.ico"
                });
            }

            await fetch(`${API_BASE}/api/notifications/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    UserID: userID,
                    subscription: JSON.parse(JSON.stringify(sub)),
                    vitol_enabled: vitolEnabled,
                    vitol_reminder_day: vitolReminderDay,
                    vitol_reminder_time: vitolReminderTime
                }),
            })
        } catch (error: any) {
            console.error("Subscription failed:", error);
            setFetchError(error.message);
        }
    }

    async function unsubscribeFromPush() {
        if (!subscription || !userID) return

        try {
            await subscription.unsubscribe()

            await fetch(`${API_BASE}/api/notifications/unsubscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    UserID: userID,
                    endpoint: subscription.endpoint,
                }),
            })

            setSubscription(null)
        } catch (error: any) {
            console.error("Unsubscribe failed:", error);
            setFetchError("Failed to unsubscribe from push notifications.");
        }
    }

    async function updateSchedule() {
        if (!subscription || !userID) return;
        setIsSaving(true);
        
        try {
            await fetch(`${API_BASE}/api/notifications/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    UserID: userID,
                    subscription: JSON.parse(JSON.stringify(subscription)),
                    vitol_enabled: vitolEnabled,
                    vitol_reminder_day: vitolReminderDay,
                    vitol_reminder_time: vitolReminderTime
                }),
            });
            setFetchError("Schedule updated successfully!");
            setTimeout(() => setFetchError(null), 3000);
        } catch (err) {
            setFetchError("Failed to update schedule.");
        } finally {
            setIsSaving(false);
        }
    }

    const handleVitolToggle = useCallback((checked: boolean) => {
        setVitolEnabled(checked)
        if (subscription && userID) {
            fetch(`${API_BASE}/api/notifications/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    UserID: userID,
                    subscription: JSON.parse(JSON.stringify(subscription)),
                    vitol_enabled: checked,
                    vitol_reminder_day: vitolReminderDay,
                    vitol_reminder_time: vitolReminderTime
                }),
            }).catch(err => {
                console.error("Failed to update VITOL preference:", err);
                setFetchError("Failed to update VITOL preference.");
            });
        }
    }, [subscription, userID, vitolReminderDay, vitolReminderTime])

    const updateClassReminders = async (enabled: boolean, offset: number) => {
        try {
            const { LocalNotifications } = await import("@capacitor/local-notifications");
            if (!enabled) {
                const pending = await LocalNotifications.getPending();
                if (pending.notifications.length > 0) {
                    await LocalNotifications.cancel({ notifications: pending.notifications });
                }
                return;
            }
            
            const attRaw = localStorage.getItem("attendance");
            if (attRaw) {
                const attendance = JSON.parse(attRaw);
                const { scheduleClassNotifications } = await import("@/lib/notifications");
                await scheduleClassNotifications(attendance, offset);
            }
        } catch (e) {
            console.error("Failed to update class reminders", e);
        }
    };

    const handleClassReminderToggle = (checked: boolean) => {
        setClassRemindersEnabled(checked);
        localStorage.setItem("classRemindersEnabled", String(checked));
        updateClassReminders(checked, classReminderOffset);
    };

    const handleOffsetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = Number(e.target.value);
        setClassReminderOffset(val);
        localStorage.setItem("classReminderOffset", String(val));
        if (classRemindersEnabled) {
            updateClassReminders(true, val);
        }
    };

    if (!isSupported) {
        return <p>Push notifications are not supported in this browser.</p>
    }

    return (
        <div className="w-full flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <p className="text-lg font-semibold text-gray-800  dark:text-gray-100">
                        Push Notifications
                    </p>
                </div>

                <Switch
                    checked={!!subscription}
                    onCheckedChange={(checked) => {
                        checked ? subscribeToPush() : unsubscribeFromPush()
                    }}
                />
            </div>

            {subscription && (
                <div className="mt-3 flex flex-col gap-4 p-4 border border-gray-200  dark:border-gray-800 rounded-xl bg-gray-50  dark:bg-black/40">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-800  dark:text-gray-100">
                                    VITOL Course Reminder
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Set a weekly recurring reminder for your online course.
                                </p>
                            </div>

                            <Switch
                                checked={vitolEnabled}
                                disabled={!subscription}
                                onCheckedChange={handleVitolToggle}
                            />
                        </div>

                        {vitolEnabled && (
                            <div className="flex flex-col gap-2 p-3 bg-white  dark:bg-black/50 rounded-lg border border-gray-100  dark:border-gray-800 mt-2">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Schedule Time</label>
                                <div className="flex gap-2">
                                    <select 
                                        className="text-sm flex-1 p-2 rounded-md border border-gray-300  dark:border-gray-700 bg-transparent dark:text-gray-200"
                                        value={vitolReminderDay}
                                        onChange={(e) => setVitolReminderDay(Number(e.target.value))}
                                    >
                                        <option value={0}>Sunday</option>
                                        <option value={1}>Monday</option>
                                        <option value={2}>Tuesday</option>
                                        <option value={3}>Wednesday</option>
                                        <option value={4}>Thursday</option>
                                        <option value={5}>Friday</option>
                                        <option value={6}>Saturday</option>
                                    </select>
                                    <input 
                                        type="time" 
                                        className="text-sm flex-1 p-2 rounded-md border border-gray-300  dark:border-gray-700 bg-transparent dark:text-gray-200"
                                        value={vitolReminderTime}
                                        onChange={(e) => setVitolReminderTime(e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                    <span className={`text-xs ${fetchError?.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                                        {fetchError}
                                    </span>
                                    <button 
                                        onClick={updateSchedule}
                                        disabled={isSaving}
                                        className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        {isSaving ? "Saving..." : "Save Schedule"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Class Reminders (Local Device Only) */}
            <div className="mt-3 flex flex-col gap-4 p-4 border border-gray-200  dark:border-gray-800 rounded-xl bg-gray-50  dark:bg-black/40">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-800  dark:text-gray-100">
                                Class Reminders
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Get local alerts on this device before your class starts.
                            </p>
                        </div>
                        <Switch
                            checked={classRemindersEnabled}
                            onCheckedChange={handleClassReminderToggle}
                        />
                    </div>

                    {classRemindersEnabled && (
                        <div className="flex flex-col gap-2 p-3 bg-white  dark:bg-black/50 rounded-lg border border-gray-100  dark:border-gray-800 mt-2">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Alert me</label>
                            <select 
                                className="text-sm p-2 rounded-md border border-gray-300  dark:border-gray-700 bg-transparent dark:text-gray-200"
                                value={classReminderOffset}
                                onChange={handleOffsetChange}
                            >
                                <option value={5}>5 minutes before</option>
                                <option value={10}>10 minutes before</option>
                                <option value={15}>15 minutes before</option>
                                <option value={30}>30 minutes before</option>
                                <option value={60}>1 hour before</option>
                            </select>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

```
</details>

---

## File: `AmazeCC\src\app\sw.ts`

### Imports
```typescript
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { BackgroundSyncQueue, Serwist } from "serwist";
import { defaultCache } from "@serwist/next/worker";
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { BackgroundSyncQueue, Serwist } from "serwist";
import { defaultCache } from "@serwist/next/worker";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();

self.addEventListener("activate", () => self.clients.claim());

const queue = new BackgroundSyncQueue("myQueueName");

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    cleanupOutdatedCaches: true,
    concurrency: 10,
    ignoreURLParametersMatching: [],
  },
  skipWaiting: false,
  clientsClaim: false,
  navigationPreload: false,
  disableDevLogs: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/~offline/",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === "POST" && url.origin === location.origin && url.pathname === "/legacy-post") {
    const backgroundSync = async () => {
      try {
        const response = await fetch(event.request.clone());
        return response;
      } catch (error) {
        await queue.pushRequest({ request: event.request });
        return Response.error();
      }
    };
    event.respondWith(backgroundSync());
  }
});

serwist.addEventListeners();

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

self.addEventListener('push', function (event) {
  if (event.data) {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: data.icon || `${basePath}/logo.png`,
      badge: `${basePath}/logo.png`,
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '2',
      },
    }
    event.waitUntil(self.registration.showNotification(data.title, options))
  }
})
 
self.addEventListener('notificationclick', function (event: any) {
  event.notification.close()
  event.waitUntil((self as any).clients.openWindow(basePath || '/'))
})
```
</details>

---

## File: `AmazeCC\src\app\terms\page.tsx`

### Imports
```typescript
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
```

### Exports
```typescript
export default function TermsOfServicePage() {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function TermsOfServicePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full px-4 py-12 bg-gray-50/50  dark:bg-black transition-colors duration-300 relative overflow-hidden">
      {/* Ambient Background Glows */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10  dark:bg-blue-500/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10  dark:bg-emerald-500/5 blur-[120px]" />
      </div>

      <div className="w-full max-w-2xl space-y-6 relative z-10">
        {/* Back Link */}
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600  dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 dark:hover:text-blue-400 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Login
        </Link>

        {/* Content Card */}
        <div className="bg-white dark:bg-gray-900  border border-gray-200/50  dark:border-white/10 rounded-2xl p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)]  dark:shadow-[0_8px_30px_rgba(255,255,255,0.02)] space-y-6 text-gray-700  dark:text-gray-300">
          <div className="border-b border-gray-100  dark:border-white/10 pb-4">
            <h1 className="text-3xl font-black text-gray-900  dark:text-white leading-tight">
              Terms of Service
            </h1>
            <p className="text-xs text-gray-500  dark:text-gray-400 mt-1">
              Last updated: June 23, 2026
            </p>
          </div>

          <div className="space-y-5 text-sm leading-relaxed">
            <p>
              Welcome to <strong>AmazeCC</strong>. By using this application, you agree to the following Terms of Service. Please read them carefully before using the app.
            </p>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900  dark:text-white">
                Purpose
              </h2>
              <p>
                <strong>AmazeCC</strong> is an experimental web application created solely for educational and personal use. It provides tools to help students view and organize their academic data retrieved from <strong>VTOP</strong> (VIT’s official portal). This app is not an official VIT product and is <strong>not affiliated, endorsed, or maintained by Vellore Institute of Technology (VIT)</strong> in any manner. 
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900  dark:text-white">
                Data Handling
              </h2>
              <p>
                The app does <strong>not collect, store, or transmit any personal information</strong> to any server. All your login credentials, academic data, and settings remain <strong>entirely on your local device</strong> via browser local storage. Once you close or clear your browser data, all information is removed. 
              </p>
              <p>
                When you log in, the app connects directly to the official <strong>VTOP</strong> website to retrieve your academic data for display. This data is processed locally in your browser and never shared externally. At the same time, the applicatiion also connects to the <strong>Events Hub</strong> website to retrieve your registered events for display. It allows you to download your receipts, your certificates by streaming the download. The app does not handle payments gateway of any sort or kind, and will not receive or send payments. This app provides a beta feature - "Pay Now" button that redirects to the official payment portal, as such does not handle payments. By clicking the pay now button, you automatically accept to the Event Hub Terms and Conditions, and similarly thereof absolve the developer of this site of any responsibility. This data is also processed locally in your browser and never shared externally.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900  dark:text-white">
                No Monetization or Commercial Use
              </h2>
              <p>
                <strong>AmazeCC</strong> is a free and non-commercial project. The developer does not earn revenue, display advertisements, sell data, or monetize the service in any way. The app is provided purely for fun, learning, and experimentation purposes.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900  dark:text-white">
                Disclaimer of Liability
              </h2>
              <p>
                The app is provided on an &ldquo;as-is&rdquo; basis with no guarantees of accuracy, reliability, or availability. The developer is <strong>not responsible for any data inaccuracies, login failures, or service interruptions</strong> that may occur due to VTOP updates, VIT Event Hubs updates,or other external factors. 
              </p>
              <p>
                Users are solely responsible for the use of their VTOP credentials within the app. It is recommended to use this app only on trusted devices and networks. You use this application at your own risk and discretion.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900  dark:text-white">
                Affiliation
              </h2>
              <p>
                This app is an <strong>independent student project</strong> and is in no way affiliated with, endorsed by, or supported by Vellore Institute of Technology (VIT) or any of its departments. This project is created out of personal interest, curiosity and learning, and is not an official VIT product.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900  dark:text-white">
                Changes to Terms
              </h2>
              <p>
                These terms may be updated periodically to reflect improvements or changes in app behavior. Continued use of the app after updates constitutes acceptance of the revised terms.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900  dark:text-white">
                Contact
              </h2>
              <p>
                For any concerns, questions, or feedback related to this app or these Terms of Service, you can contact the developer at <strong>sugeeth2007@gmail.com</strong>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

```
</details>

---

## File: `AmazeCC\src\app\~offline\page.tsx`

### Imports
```typescript
import { WifiOff } from 'lucide-react';
import Link from 'next/link';
```

### Exports
```typescript
export default function OfflinePage() {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import { WifiOff } from 'lucide-react';
import Link from 'next/link';

export default function OfflinePage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-black p-4">
            <div className="bg-white  dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 max-w-md w-full text-center shadow-lg">
                <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
                    <WifiOff className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    You're Offline
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                    It looks like you've lost your internet connection. We couldn't load this page from the cache.
                </p>
                <Link href="/">
                    <span className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors">
                        Go to Home
                    </span>
                </Link>
            </div>
        </div>
    );
}

```
</details>

---

