import { X, History, Sparkles } from "lucide-react";
import { Button } from "@amazecontinuityprojects/amazeui";
import changelogData from "../../../data/changelog.json";

export default function ChangelogModal({ handleClose }) {
    return (
        <div className="w-full h-full flex flex-col relative pb-10 animate-fadeIn">
            <div className="w-full max-w-3xl mx-auto flex flex-col">
                <div className="flex items-center gap-4 py-6 mb-2 mt-4 sm:mt-8">
                    <button 
                        onClick={handleClose}
                        className="p-2.5 bg-white/50 hover:bg-white dark:hover:bg-slate-800 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 rounded-full transition-all border border-gray-200/50 dark:border-white/10 shadow-sm"
                    >
                        <X size={24} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                            <History size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Changelog</h2>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    {changelogData.map((release, idx) => (
                        <div key={idx} className="relative pl-6">
                            {/* Timeline line */}
                            {idx !== changelogData.length - 1 && (
                                <div className="absolute left-[11px] top-8 bottom-[-24px] w-0.5 bg-gray-200  dark:bg-gray-800"></div>
                            )}
                            
                            {/* Timeline dot */}
                            <div className="absolute left-0 top-1.5 w-[24px] h-[24px] rounded-full border-4 border-white  dark:border-gray-900 bg-blue-500 shadow-sm flex items-center justify-center">
                                {idx === 0 && <Sparkles size={10} className="text-white" />}
                            </div>

                            <div className="mb-1 flex items-baseline gap-3">
                                <h3 className="text-lg font-bold text-gray-900  dark:text-gray-100">{release.version}</h3>
                                <span className="text-sm font-medium text-gray-500  dark:text-gray-500">{release.date}</span>
                            </div>

                            <ul className="space-y-2 mt-3">
                                {release.changes.map((change, i) => (
                                    <li key={i} className="text-gray-700  dark:text-gray-300 text-sm leading-relaxed flex items-start">
                                        <span className="text-blue-500 mr-2 mt-1.5">•</span>
                                        <span>{change}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
