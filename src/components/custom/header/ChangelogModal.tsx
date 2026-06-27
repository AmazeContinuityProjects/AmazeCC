import { X, History, Sparkles } from "lucide-react";
import { Button } from "../../ui/button";
import changelogData from "../../../data/changelog.json";

export default function ChangelogModal({ handleClose }) {
    return (
        <div className="fixed inset-0 z-[60] bg-black/60  flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white  dark:bg-gray-900 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl border border-gray-200  dark:border-gray-800 animate-slideUp">
                <div className="flex items-center justify-between p-5 border-b border-gray-100  dark:border-gray-800">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-50  dark:bg-blue-900/30 text-blue-600  dark:text-blue-400 rounded-lg">
                            <History size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900  dark:text-gray-100">Changelog</h2>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleClose} className="rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 dark:hover:bg-gray-800">
                        <X size={20} className="text-gray-500  dark:text-gray-400" />
                    </Button>
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
