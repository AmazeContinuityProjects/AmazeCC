import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { API_BASE } from "@/components/custom/Main";

function urlBase64ToUint8Array(base64String: string) {
    if (!base64String) return new Uint8Array(0);
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export default function PushPromptModal({ UserID }: { UserID: string }) {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (!UserID) return;
        
        // Only show once
        const hasSeenPrompt = localStorage.getItem('hasSeenPushPrompt');
        if (!hasSeenPrompt && 'serviceWorker' in navigator && 'PushManager' in window) {
            // Delay slightly so it doesn't interrupt immediate dashboard load
            const timer = setTimeout(() => {
                setIsOpen(true);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [UserID]);

    const handleClose = () => {
        localStorage.setItem('hasSeenPushPrompt', 'true');
        setIsOpen(false);
    };

    const handleEnable = async () => {
        handleClose();

        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return;

            const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!vapidPublicKey) {
                console.error('VAPID public key not found. Push notifications are disabled.');
                return;
            }

            const registration = await navigator.serviceWorker.register('/sw.js');
            await navigator.serviceWorker.ready;

            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
            });

            await fetch(`${API_BASE}/api/notifications/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    UserID,
                    subscription: JSON.parse(JSON.stringify(sub)),
                    vitol_enabled: false,
                    vitol_reminder_day: 1,
                    vitol_reminder_time: "10:00"
                }),
            });

            new Notification("Welcome to AmazeCC Alerts!", {
                body: "Push notifications are now enabled. Head to Profile > Push Notifications to set up your VITOL class reminder.",
                icon: "/favicon.ico"
            });
        } catch (error) {
            console.error("Push enrollment failed:", error);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div 
                    initial={{ opacity: 0, y: 40, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 30, scale: 0.92 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="fixed bottom-24 md:bottom-6 right-4 left-4 md:left-auto md:w-[350px] bg-white/95 dark:bg-black/95 backdrop-blur-md border border-gray-250 dark:border-gray-850 rounded-2xl p-5 shadow-2xl z-[120] pointer-events-auto"
                >
                    <button 
                        onClick={handleClose}
                        className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-650 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:hover:bg-gray-800 dark:bg-gray-900 rounded-full transition-colors cursor-pointer"
                    >
                        <X size={14} />
                    </button>
                    
                    <div className="flex gap-3.5 mt-1">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                            <Bell size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">
                                Never Miss a Class!
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-normal">
                                AmazeCC can send you push notifications for your weekly VITOL classes directly to this device.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4">
                        <button 
                            onClick={handleEnable}
                            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                        >
                            Enable Alerts
                        </button>
                        <button 
                            onClick={handleClose}
                            className="flex-1 py-2 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                        >
                            Maybe Later
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
