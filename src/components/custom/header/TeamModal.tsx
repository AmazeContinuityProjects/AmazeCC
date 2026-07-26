import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Github, Linkedin, ChevronLeft } from 'lucide-react';
import teamData from '../../../data/team.json';

export default function TeamModal({ handleClose }: { handleClose: () => void }) {
    // Sort committees by order
    const sortedCommittees = [...teamData.committees].sort((a, b) => a.order - b.order);

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="w-full h-full flex flex-col relative pb-10"
            >
                {/* Ambient Glows */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 hidden sm:block">
                    <div className="absolute -top-[10%] -right-[5%] w-[60%] h-[60%] bg-blue-400/40 dark:bg-blue-500/20 rounded-full blur-[100px]" />
                    <div className="absolute top-[30%] -left-[10%] w-[50%] h-[50%] bg-indigo-500/40 dark:bg-indigo-600/20 rounded-full blur-[100px]" />
                </div>

                <div className="relative z-10 w-full max-w-3xl mx-auto flex flex-col">
                    {/* Header */}
                    <div className="flex items-center gap-4 py-6 mb-2 mt-4 sm:mt-8">
                        <button 
                            onClick={handleClose}
                            className="p-2.5 bg-white/50 hover:bg-white dark:hover:bg-slate-800 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 rounded-full transition-all border border-gray-200/50 dark:border-white/10 shadow-sm"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20">
                                <Users size={20} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">Amaze Continuity Projects</h2>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">The team building AmazeCC</p>
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10 w-full pb-8">
                        <div className="space-y-12">
                            {sortedCommittees.map((committee) => {
                                if (!committee.members || committee.members.length === 0) return null;
                                
                                const sortedMembers = [...committee.members].sort((a, b) => a.order - b.order);

                                return (
                                    <div key={committee.id} className="space-y-4">
                                        <div className="border-b border-gray-200 dark:border-gray-800 pb-2">
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{committee.name}</h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{committee.description}</p>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {sortedMembers.map((member, idx) => (
                                                <motion.div 
                                                    key={idx}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: idx * 0.05 }}
                                                    className="p-4 rounded-2xl bg-white/50 dark:bg-white/[0.02] border border-gray-100/50 dark:border-white/5 flex items-start gap-4"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center shrink-0 border border-white/50 dark:border-white/5 shadow-sm overflow-hidden">
                                                        {member.avatar ? (
                                                            <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="font-bold text-blue-600 dark:text-blue-400">
                                                                {member.name.charAt(0)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="flex-1 min-w-0 pt-0.5">
                                                        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{member.name}</h4>
                                                        <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2 truncate">{member.role}</p>
                                                        
                                                        <div className="flex items-center gap-2">
                                                            {member.github && (
                                                                <a href={`https://github/${member.github}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                                                                    <Github size={14} />
                                                                </a>
                                                            )}
                                                            {member.linkedin && (
                                                                <a href={member.linkedin} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                                                    <Linkedin size={14} />
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
