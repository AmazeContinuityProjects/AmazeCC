import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';

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
        // Redirect or open the notification prompt.
        // The easiest way is to request permission right here.
        if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                // If they grant it here, they still need to turn it on in the profile page for Vitol
                // But giving permission is a great first step. 
                new Notification("Welcome to AmazeCC!", {
                    body: "Push permissions granted! Go to your Profile > Push Notifications to set up your VITOL class reminder.",
                    icon: "/favicon.ico"
                });
            }
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="bg-white dark:bg-slate-900 midnight:bg-black border border-gray-200 dark:border-gray-800 midnight:border-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative"
                    >
                        <button 
                            onClick={handleClose}
                            className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 midnight:bg-gray-900 midnight:hover:bg-gray-800 rounded-full transition-colors"
                        >
                            <X size={16} />
                        </button>
                        
                        <div className="flex justify-center mb-4 mt-2">
                            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 midnight:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                <Bell size={24} />
                            </div>
                        </div>

                        <h3 className="text-xl font-bold text-center text-gray-900 dark:text-white midnight:text-gray-100 mb-2">
                            Never Miss a Class!
                        </h3>
                        
                        <p className="text-sm text-center text-gray-600 dark:text-gray-400 midnight:text-gray-400 mb-6">
                            AmazeCC can now send you push notifications for your weekly VITOL classes directly to your device. Would you like to enable this?
                        </p>

                        <div className="flex flex-col gap-2">
                            <button 
                                onClick={handleEnable}
                                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition-colors"
                            >
                                Enable Notifications
                            </button>
                            <button 
                                onClick={handleClose}
                                className="w-full py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 midnight:hover:bg-gray-900 font-medium rounded-lg transition-colors"
                            >
                                Maybe Later
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
