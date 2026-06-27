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
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="bg-white dark:bg-slate-900 midnight:bg-black border border-gray-200 dark:border-gray-800 midnight:border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh]"
                    >
                        {/* Background Decoration */}
                        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[40px] pointer-events-none" />
                        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 blur-[40px] pointer-events-none" />

                        <button 
                            onClick={handleClose}
                            className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 midnight:bg-gray-900 midnight:hover:bg-gray-800 rounded-full transition-colors z-10"
                        >
                            <X size={16} />
                        </button>
                        
                        <div className="flex items-center gap-3 mb-5 mt-2">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
                                <Sparkles size={20} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white midnight:text-gray-100">
                                    What's New!
                                </h3>
                                <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                                    Version {latestVersion.version}
                                </p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            <div className="space-y-3">
                                {latestVersion.changes.map((change, idx) => (
                                    <motion.div 
                                        key={idx}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.1 + idx * 0.05 }}
                                        className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/80 dark:bg-gray-800/50 midnight:bg-gray-900/50 border border-gray-100 dark:border-gray-800/80"
                                    >
                                        <div className="mt-0.5 shrink-0">
                                            <CheckCircle2 size={16} className="text-emerald-500" />
                                        </div>
                                        <p className="text-sm text-gray-700 dark:text-gray-300 midnight:text-gray-300 leading-snug">
                                            {change}
                                        </p>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        <div className="pt-5 mt-auto">
                            <button 
                                onClick={handleClose}
                                className="w-full py-3 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 text-white font-bold rounded-xl shadow-md transition-colors"
                            >
                                Awesome, let's go!
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
