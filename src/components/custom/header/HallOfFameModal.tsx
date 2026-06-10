import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Github, Star, ExternalLink, ChevronLeft } from 'lucide-react';

const credits = [
    {
        name: "UniCC Core",
        author: "Arya4930",
        description: "The original foundational vision, architecture, and core of UniCC.",
        repo: "https://github.com/Arya4930/UniCC"
    },
    {
        name: "MarksApp",
        author: "Miihir79",
        description: "Innovative marks calculation logic and grades fetching architecture.",
        repo: "https://github.com/Miihir79/MarksApp"
    },
    {
        name: "FFCSonTheGo",
        author: "vatz88",
        description: "Pioneering algorithms for FFCS timetable aggregation and social schedules.",
        repo: "https://github.com/vatz88/FFCSonTheGo"
    },
    {
        name: "VIT-Verse",
        author: "Divyanshu Patel",
        description: "Robust data scraping architecture and attendance mechanics. (Clone only exists)",
        repo: "https://codeberg.org/fkvit/fkvit/"
    },
    {
        name: "JeeHub",
        author: "dhruv-programmes",
        description: "Authentication and UI/UX inspiration for seamless student experiences.",
        repo: "https://github.com/dhruv-programmes/JeeHub"
    },
    {
        name: "Project-PAS",
        author: "SugeethJSA",
        description: "Advanced GPA predictor systems and grade estimation logic.",
        repo: "https://github.com/SugeethJSA/project-pas"
    }
];

export default function HallOfFameModal({ handleClose }: { handleClose: () => void }) {
    return (
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="fixed inset-0 z-[100] bg-gray-50/80 dark:bg-slate-900/80 midnight:bg-black/80 backdrop-blur-3xl overflow-hidden flex flex-col"
            >
                {/* Ambient Glows */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                    <div className="absolute -top-[10%] -right-[5%] w-[60%] h-[60%] bg-amber-400/40 dark:bg-amber-500/30 midnight:bg-amber-500/20 rounded-full blur-[100px]" />
                    <div className="absolute top-[30%] -left-[10%] w-[50%] h-[50%] bg-orange-500/40 dark:bg-orange-600/30 midnight:bg-orange-600/20 rounded-full blur-[100px]" />
                </div>

                <div className="relative z-10 w-full max-w-3xl mx-auto h-full flex flex-col px-4 sm:px-6">
                    {/* Header */}
                    <div className="flex items-center gap-4 py-6 mb-2 mt-4 sm:mt-8">
                        <button 
                            onClick={handleClose}
                            className="p-2.5 bg-white/50 hover:bg-white dark:bg-slate-800/50 dark:hover:bg-slate-800 midnight:bg-white/5 midnight:hover:bg-white/10 text-gray-700 dark:text-gray-300 midnight:text-gray-200 rounded-full transition-all border border-gray-200/50 dark:border-gray-700/50 midnight:border-white/10 backdrop-blur-md shadow-sm"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-gradient-to-tr from-amber-400 to-orange-500 rounded-xl shadow-lg shadow-orange-500/20">
                                <Trophy size={20} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-500">Hall of Fame</h2>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 midnight:text-gray-400">The giants whose shoulders we stand on</p>
                            </div>
                        </div>
                    </div>



                    <div className="relative z-10 flex-1 overflow-y-auto pb-24 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {credits.map((credit, idx) => (
                            <motion.a 
                                href={credit.repo}
                                target="_blank"
                                rel="noopener noreferrer"
                                key={idx}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="group block p-4 rounded-2xl bg-white/50 dark:bg-slate-800/50 midnight:bg-white/[0.02] hover:bg-white/80 dark:hover:bg-slate-800/80 midnight:hover:bg-white/[0.04] border border-gray-100/50 dark:border-gray-700/30 midnight:border-white/5 transition-all cursor-pointer"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2.5 bg-gray-100/80 dark:bg-slate-900/80 midnight:bg-black/80 rounded-xl text-gray-700 dark:text-gray-300 midnight:text-gray-400 group-hover:text-amber-500 group-hover:scale-110 transition-all">
                                            <Github size={22} />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-gray-900 dark:text-white midnight:text-gray-100 flex items-center gap-2 leading-tight">
                                                {credit.name}
                                            </h3>
                                            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 midnight:text-blue-400 mt-0.5">
                                                by {credit.author}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="p-1.5 bg-gray-100/50 dark:bg-slate-800/50 midnight:bg-white/5 rounded-full text-gray-400 midnight:text-gray-500 group-hover:text-amber-500 group-hover:bg-amber-50 dark:group-hover:bg-amber-500/10 transition-colors">
                                        <ExternalLink size={16} />
                                    </div>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 midnight:text-gray-400 leading-relaxed font-medium">
                                    {credit.description}
                                </p>
                            </motion.a>
                            ))}
                        </div>

                        <div className="relative z-10 mt-10 mb-8 pt-6 border-t border-gray-200/50 dark:border-gray-800/50 midnight:border-white/10 text-center">
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 midnight:text-gray-400 flex items-center justify-center gap-2">
                                Curated with <Star size={16} className="text-amber-500" /> by <span className="text-gray-900 dark:text-white midnight:text-gray-100 font-bold">SugeethJSA</span>
                            </p>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
