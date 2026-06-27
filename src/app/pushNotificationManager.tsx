'use client'

import { useState, useEffect, useCallback } from 'react'
import { Switch } from "@/components/ui/switch"
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

    if (!isSupported) {
        return <p>Push notifications are not supported in this browser.</p>
    }

    return (
        <div className="w-full flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <p className="text-lg font-semibold text-gray-800 dark:text-gray-200 midnight:text-gray-100">
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
                <div className="mt-3 flex flex-col gap-4 p-4 border border-gray-200 dark:border-gray-800 midnight:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900/50 midnight:bg-black/40">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 midnight:text-gray-100">
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
                            <div className="flex flex-col gap-2 p-3 bg-white dark:bg-black/50 midnight:bg-black/50 rounded-lg border border-gray-100 dark:border-gray-800 midnight:border-gray-800 mt-2">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Schedule Time</label>
                                <div className="flex gap-2">
                                    <select 
                                        className="text-sm flex-1 p-2 rounded-md border border-gray-300 dark:border-gray-700 midnight:border-gray-700 bg-transparent midnight:text-gray-200"
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
                                        className="text-sm flex-1 p-2 rounded-md border border-gray-300 dark:border-gray-700 midnight:border-gray-700 bg-transparent midnight:text-gray-200"
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
        </div>
    )
}
