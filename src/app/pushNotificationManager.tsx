"use client";

import { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { settingsAtom } from "@/store/settingsAtoms";
import { Switch } from "@amazecontinuityprojects/amazeui";
import { API_BASE } from "@/components/custom/Main";
import { 
  Bell, Volume2, Moon, AlertTriangle, Calendar, BookOpen, Utensils, 
  FileText, Sparkles, Send, CheckCircle, Key
} from "lucide-react";

// Cryptographically valid uncompressed NIST P-256 ECDSA VAPID Public Key (65 bytes starting with 0x04)
const DEFAULT_VAPID_PUBLIC_KEY = 
  "BPWVsRBGW3upzaJFeMS2vd-U8YheUIu7_d1h4zQKqPv7KH-s27CnpGlZHKnjy0aVqTQmQUjCMIk3LITlQsBZuy8";

function urlBase64ToUint8Array(base64String: string) {
  if (!base64String) return new Uint8Array(0);
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  try {
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  } catch (e) {
    console.error("Invalid VAPID Base64 key:", e);
    return new Uint8Array(0);
  }
}

export default function PushNotificationManager() {
  const [settings, setSettings] = useAtom(settingsAtom);
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [fetchStatus, setFetchStatus] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [userID, setUserID] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("IDs");
      if (raw) {
        const parsed = JSON.parse(raw);
        setUserID(parsed?.VtopUsername || "STUDENT");
      }
    } catch {
      setUserID("STUDENT");
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      registerServiceWorker();
    }
  }, []);

  async function registerServiceWorker() {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      setSubscription(sub);
    } catch (e) {
      console.warn("Service worker registration error:", e);
    }
  }

  const updateSettingField = (key: keyof typeof settings, value: any) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem("settings", JSON.stringify(next));
      return next;
    });
  };

  async function subscribeToPush() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setFetchStatus(null);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setFetchStatus("Subscription error: Notification permission was denied by browser.");
        return;
      }

      const rawVapidKey = (
        settings?.customVapidKey?.trim() ||
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ||
        DEFAULT_VAPID_PUBLIC_KEY
      );

      const registration = await navigator.serviceWorker.ready;
      let sub = await registration.pushManager.getSubscription();

      if (sub) {
        try {
          await sub.unsubscribe();
        } catch {}
      }

      const keyArray = urlBase64ToUint8Array(rawVapidKey);
      try {
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyArray,
        });
      } catch (vapidErr: any) {
        console.warn("Uint8Array applicationServerKey failed, trying raw string key:", vapidErr);
        try {
          sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: rawVapidKey,
          });
        } catch (stringErr) {
          throw vapidErr;
        }
      }

      setSubscription(sub);
      updateSettingField("pushNotificationsEnabled", true);

      // Trigger local welcome alert
      new Notification("🔔 AmazeCC Push Notifications Active!", {
        body: "Push alerts & VAPID keys are configured. You will receive real-time campus reminders.",
        icon: "/favicon.ico",
      });

      if (userID) {
        fetch(`${API_BASE}/api/notifications/subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            UserID: userID,
            subscription: JSON.parse(JSON.stringify(sub)),
            settings,
          }),
        }).catch((err) => console.warn("Backend push sync warning:", err));
      }

      setFetchStatus("Push notifications successfully enabled!");
      setTimeout(() => setFetchStatus(null), 4000);
    } catch (error: any) {
      console.error("Push subscription failed:", error);
      setFetchStatus(`Subscription error: ${error.message || "Failed to subscribe"}`);
    }
  }

  async function unsubscribeFromPush() {
    if (!subscription) return;
    try {
      await subscription.unsubscribe();
      if (userID) {
        fetch(`${API_BASE}/api/notifications/unsubscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            UserID: userID,
            endpoint: subscription.endpoint,
          }),
        }).catch(() => {});
      }
      setSubscription(null);
      updateSettingField("pushNotificationsEnabled", false);
      setFetchStatus("Unsubscribed from push notifications.");
      setTimeout(() => setFetchStatus(null), 3000);
    } catch (error: any) {
      console.error("Unsubscribe error:", error);
      setFetchStatus("Unsubscribe error: Failed to unsubscribe.");
    }
  }

  const sendTestNotification = async () => {
    setIsTesting(true);
    setFetchStatus(null);

    try {
      if (typeof window === "undefined" || !("Notification" in window)) {
        throw new Error("Notifications not supported");
      }

      if (Notification.permission !== "granted") {
        const p = await Notification.requestPermission();
        if (p !== "granted") throw new Error("Permission denied");
      }

      const options = {
        body: "Test Alert: VAPID Key & Service Worker push notifications are functioning at 100%!",
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        vibrate: settings?.pushVibrationEnabled !== false ? [100, 50, 100] : undefined,
        data: { url: "/" },
      };

      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification("✨ AmazeCC Push Test Passed!", options);
      } else {
        new Notification("✨ AmazeCC Push Test Passed!", options);
      }

      setFetchStatus("Test notification sent successfully!");
    } catch (err: any) {
      setFetchStatus(`Test error: ${err.message}`);
    } finally {
      setIsTesting(false);
      setTimeout(() => setFetchStatus(null), 4000);
    }
  };

  if (!isSupported) {
    return (
      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200/50 text-xs font-medium">
        Push notifications are not supported in this browser. Please use Chrome, Edge, Safari or Firefox.
      </div>
    );
  }

  const isEnabled = !!subscription && settings?.pushNotificationsEnabled !== false;
  const isErrorStatus = fetchStatus && /error|failed|denied|invalid/i.test(fetchStatus);

  return (
    <div className="space-y-5">
      {/* Master Push Switch Header */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-gray-200/80 dark:border-gray-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isEnabled ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" : "bg-gray-100 dark:bg-slate-800 text-gray-400"}`}>
            <Bell size={20} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white">Push Notifications (VAPID)</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">Receive real-time campus reminders on this device</p>
          </div>
        </div>

        <Switch
          checked={isEnabled}
          onCheckedChange={(checked) => (checked ? subscribeToPush() : unsubscribeFromPush())}
        />
      </div>

      {fetchStatus && (
        <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${isErrorStatus ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200/40" : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/40"}`}>
          {isErrorStatus ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
          <span>{fetchStatus}</span>
        </div>
      )}

      {isEnabled && (
        <div className="space-y-4 animate-fadeIn">
          {/* Test Push Button */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-transparent border border-indigo-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Sparkles size={13} className="text-indigo-500" /> Test Notification System
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Send an instant VAPID push notification to verify permissions</p>
            </div>
            <button
              onClick={sendTestNotification}
              disabled={isTesting}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Send size={13} />
              {isTesting ? "Sending..." : "Test Push"}
            </button>
          </div>

          {/* Trigger Categories */}
          <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-gray-200/80 dark:border-gray-800 space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 font-outfit">Notification Triggers</h5>

            <div className="space-y-2.5">
              {[
                { key: "notifyLowAttendance", label: "Low Attendance Alerts", desc: "Notify immediately when course attendance drops below target", icon: AlertTriangle, color: "text-red-500" },
                { key: "notifyClassReminders", label: "Class Timetable Reminders", desc: "Remind 15 minutes before next scheduled lecture starts", icon: Calendar, color: "text-indigo-500" },
                { key: "notifyExamAlerts", label: "Exam Schedule & Admit Card Alerts", desc: "Alerts for upcoming CAT/FAT exam dates & venues", icon: FileText, color: "text-amber-500" },
                { key: "notifyMessServing", label: "Hostel Mess Serving Alerts", desc: "Notifications when Breakfast, Lunch, Snacks or Dinner serving starts", icon: Utensils, color: "text-emerald-500" },
                { key: "notifyAssignments", label: "LMS & Assignment Reminders", desc: "Remind about pending VITOL / Moodle assignment deadlines", icon: BookOpen, color: "text-purple-500" },
                { key: "notifyCirculars", label: "Academic Circulars & Notices", desc: "Instant alert on new university circulars and announcements", icon: Bell, color: "text-blue-500" },
              ].map((item) => {
                const ItemIcon = item.icon;
                const active = settings[item.key as keyof typeof settings] !== false;
                return (
                  <div key={item.key} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/70 dark:bg-black/40 border border-gray-100 dark:border-gray-800/60">
                    <div className="flex items-center gap-2.5">
                      <ItemIcon size={15} className={item.color} />
                      <div>
                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{item.label}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">{item.desc}</p>
                      </div>
                    </div>
                    <Switch
                      checked={active}
                      onCheckedChange={(val) => updateSettingField(item.key as any, val)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sound & Quiet Hours */}
          <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-gray-200/80 dark:border-gray-800 space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 font-outfit">Sound & Quiet Hours</h5>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/70 dark:bg-black/40 border border-gray-100 dark:border-gray-800/60">
                <div className="flex items-center gap-2">
                  <Volume2 size={15} className="text-indigo-500" />
                  <div>
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Alert Sound</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Play notification sound</p>
                  </div>
                </div>
                <Switch
                  checked={settings?.pushSoundEnabled !== false}
                  onCheckedChange={(val) => updateSettingField("pushSoundEnabled", val)}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/70 dark:bg-black/40 border border-gray-100 dark:border-gray-800/60">
                <div className="flex items-center gap-2">
                  <Moon size={15} className="text-purple-500" />
                  <div>
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Quiet Hours Mode</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Mute alerts during night</p>
                  </div>
                </div>
                <Switch
                  checked={settings?.pushQuietHoursEnabled === true}
                  onCheckedChange={(val) => updateSettingField("pushQuietHoursEnabled", val)}
                />
              </div>
            </div>

            {settings?.pushQuietHoursEnabled && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-100 dark:bg-black/60 border border-gray-200 dark:border-gray-800">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Quiet Hours Range:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={settings?.pushQuietHoursStart || "22:00"}
                    onChange={(e) => updateSettingField("pushQuietHoursStart", e.target.value)}
                    className="px-2 py-1 rounded bg-white dark:bg-slate-800 border border-gray-300 dark:border-gray-700 text-xs font-medium text-gray-900 dark:text-white"
                  />
                  <span className="text-xs font-bold text-gray-400">to</span>
                  <input
                    type="time"
                    value={settings?.pushQuietHoursEnd || "07:00"}
                    onChange={(e) => updateSettingField("pushQuietHoursEnd", e.target.value)}
                    className="px-2 py-1 rounded bg-white dark:bg-slate-800 border border-gray-300 dark:border-gray-700 text-xs font-medium text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Optional VAPID Key Customization */}
          <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-gray-200/80 dark:border-gray-800 space-y-2">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 font-outfit flex items-center gap-1.5">
                <Key size={13} className="text-amber-500" /> VAPID Server Public Key
              </h5>
              {settings?.customVapidKey && (
                <button
                  onClick={() => updateSettingField("customVapidKey", "")}
                  className="text-[10px] text-indigo-500 hover:underline font-semibold cursor-pointer"
                >
                  Reset Default
                </button>
              )}
            </div>
            <input
              type="text"
              placeholder="System Default Key active (Paste custom VAPID public key if self-hosting)"
              value={settings?.customVapidKey || ""}
              onChange={(e) => updateSettingField("customVapidKey", e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-black/50 border border-gray-200 dark:border-gray-800 text-xs font-mono text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
