import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, CheckCircle2 } from 'lucide-react';
import changelogData from '../../data/changelog.json';

export default function ChangelogModal() {
    const [isOpen, setIsOpen] = useState(false);
    const latestVersion = changelogData[0];

    useEffect(() => {
        // Wait a bit so we don't spam the user immediately on load
        const timer = setTimeout(() => {
            const lastSeenVersion = localStorage.getItem('lastSeenChangelogVersion');
            if (lastSeenVersion !== latestVersion.version) {
                setIsOpen(true);
                localStorage.setItem('lastSeenChangelogVersion', latestVersion.version);
            }
        }, 1500);

        return () => clearTimeout(timer);
    }, [latestVersion.version]);

    const handleClose = () => {
        setIsOpen(false);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div 
                    initial={{ opacity: 0, y: -40, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -30, scale: 0.92 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="fixed top-4 right-4 left-4 md:left-auto md:w-[360px] bg-white/95 dark:bg-black/95 backdrop-blur-md border border-gray-250 dark:border-gray-850 rounded-2xl p-5 shadow-2xl z-[120] overflow-hidden flex flex-col max-h-[60vh] md:max-h-[480px] pointer-events-auto"
                >
                    {/* Background Decoration */}
                    <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[35px] pointer-events-none" />
                    <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 blur-[35px] pointer-events-none" />

                    <button 
                        onClick={handleClose}
                        className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:hover:bg-gray-800 dark:bg-gray-900 rounded-full transition-colors z-10 cursor-pointer"
                    >
                        <X size={14} />
                    </button>
                    
                    <div className="flex items-center gap-3 mb-4 mt-1">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shrink-0">
                            <Sparkles size={18} />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 leading-tight">
                                What's New!
                            </h3>
                            <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                Version {latestVersion.version}
                            </p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-850 max-h-[30vh] md:max-h-[250px]">
                        <div className="space-y-2">
                            {latestVersion.changes.map((change, idx) => (
                                <motion.div 
                                    key={idx}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.08 + idx * 0.04 }}
                                    className="flex items-start gap-2.5 p-2.5 rounded-xl bg-gray-50/70 dark:bg-gray-950/40 border border-gray-100 dark:border-gray-850/50"
                                >
                                    <div className="mt-0.5 shrink-0">
                                        <CheckCircle2 size={14} className="text-emerald-500" />
                                    </div>
                                    <p className="text-xs text-gray-700 dark:text-gray-300 leading-snug">
                                        {change}
                                    </p>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 mt-auto">
                        <button 
                            onClick={handleClose}
                            className="w-full py-2.5 bg-gray-950 hover:bg-gray-900 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-950 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
                        >
                            Awesome, let's go!
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
