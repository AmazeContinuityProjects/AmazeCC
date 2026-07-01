import { motion, AnimatePresence } from "framer-motion";
import { X, Globe, Instagram, MessageCircle, Link as LinkIcon, User, Calendar, Star } from "lucide-react";
import { useState, useEffect } from "react";
import { API_BASE } from "../../custom/Main";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ClubDetailsModalProps {
  club: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function ClubDetailsModal({ club, isOpen, onClose }: ClubDetailsModalProps) {
  const [landingPage, setLandingPage] = useState<any>(null);
  const [loadingLp, setLoadingLp] = useState(false);

  useEffect(() => {
    if (isOpen && club?.club_id) {
      setLoadingLp(true);
      fetch(`${API_BASE}/api/club-admin/landing-page?club_id=${club.club_id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.landingPage) {
            setLandingPage(data.landingPage);
          } else {
            setLandingPage(null);
          }
        })
        .catch(console.error)
        .finally(() => setLoadingLp(false));
    }
  }, [isOpen, club]);

  if (!club) return null;

  const themeColor = landingPage?.theme?.primary_color || "#3B82F6";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 z-[101] w-[95%] max-w-2xl max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col border border-gray-100 dark:border-gray-800"
          >
            {/* Header */}
            <div className="relative p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex items-start gap-4">
              {club.logo_url && (
                <img src={club.logo_url} alt={`${club.club_name} Logo`} className="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-sm" />
              )}
              <div className="flex-1">
                <button
                  onClick={onClose}
                  className="absolute right-4 top-4 p-2 rounded-full bg-gray-200/50 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </button>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white pr-8" style={landingPage?.theme ? { color: themeColor } : {}}>
                  {club.club_name}
                </h2>
                {club.club_id && (
                  <p className="mt-1 text-sm font-medium text-gray-500 dark:text-gray-400">
                    {club.club_id}
                  </p>
                )}
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar relative">
              
              {loadingLp && (
                <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm z-10 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: themeColor }}></div>
                </div>
              )}
              
              {/* Mission */}
              {club.mission && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Our Mission</h3>
                  <p className="text-gray-800 dark:text-gray-200 leading-relaxed italic border-l-4 pl-4 py-1" style={{ borderColor: themeColor }}>
                    "{club.mission}"
                  </p>
                </div>
              )}

              {/* Description */}
              {(club.description || (!club.mission && !club.description && !club.hiring_process)) && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">About Us</h3>
                  {club.description ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 prose-p:leading-relaxed prose-a:text-blue-500 hover:prose-a:text-blue-600 prose-img:rounded-xl">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{club.description}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">No detailed description provided.</p>
                  )}
                </div>
              )}

              {/* Showcase Projects */}
              {landingPage?.showcase_projects && landingPage.showcase_projects.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <Star className="w-4 h-4" /> Showcase Projects
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {landingPage.showcase_projects.map((proj: any, i: number) => (
                      <div key={i} className="group relative rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/50 overflow-hidden hover:shadow-md transition-shadow">
                        {proj.image_url && (
                          <div className="h-32 bg-gray-100 dark:bg-gray-800 w-full">
                            <img src={proj.image_url} alt={proj.title} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="p-4">
                          <h4 className="font-bold text-gray-900 dark:text-white">{proj.title}</h4>
                          {proj.description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{proj.description}</p>}
                          {proj.link && (
                            <a href={proj.link} target="_blank" rel="noreferrer" className="inline-block mt-3 text-sm font-medium hover:underline" style={{ color: themeColor }}>
                              View Project &rarr;
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Popular Events */}
              {landingPage?.popular_events && landingPage.popular_events.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Popular Events
                  </h3>
                  <div className="space-y-3">
                    {landingPage.popular_events.map((ev: any, i: number) => (
                      <div key={i} className="flex gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800">
                        <div className="shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-xl text-white font-bold text-sm" style={{ backgroundColor: themeColor }}>
                          {ev.year?.slice(-2) || 'XX'}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 dark:text-white">{ev.name}</h4>
                          {ev.description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-snug">{ev.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hiring Process */}
              {club.hiring_process && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Hiring Process</h3>
                  <div className="p-4 rounded-2xl border" style={{ backgroundColor: `${themeColor}10`, borderColor: `${themeColor}30` }}>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 prose-p:leading-relaxed prose-a:text-blue-500 hover:prose-a:text-blue-600 prose-img:rounded-xl">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{club.hiring_process}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}

              {/* Socials & Links */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Connect & Join</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {club.website && (
                    <a href={club.website} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-colors border border-gray-100 dark:border-gray-800">
                      <Globe className="w-5 h-5" />
                      <span className="font-medium text-sm">Website</span>
                    </a>
                  )}
                  {club.instagram && (
                    <a href={club.instagram.startsWith('http') ? club.instagram : `https://instagram.com/${club.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-pink-50 dark:hover:bg-pink-900/20 hover:text-pink-600 transition-colors border border-gray-100 dark:border-gray-800">
                      <Instagram className="w-5 h-5" />
                      <span className="font-medium text-sm">Instagram</span>
                    </a>
                  )}
                  {club.whatsapp && (
                    <a href={club.whatsapp} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600 transition-colors border border-gray-100 dark:border-gray-800">
                      <MessageCircle className="w-5 h-5" />
                      <span className="font-medium text-sm">WhatsApp Group</span>
                    </a>
                  )}
                  {club.recruitment_link && (
                    <a href={club.recruitment_link} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-600 transition-colors border border-gray-100 dark:border-gray-800">
                      <LinkIcon className="w-5 h-5" />
                      <span className="font-medium text-sm">Recruitment Link</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Point of Contact */}
              {club.poc && (
                <div className="flex items-center gap-3 p-4 bg-gray-100/50 dark:bg-gray-800/80 rounded-2xl border border-gray-200/50 dark:border-gray-700/50">
                  <div className="p-2 bg-white dark:bg-gray-700 rounded-full shadow-sm">
                    <User className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-0.5">Point of Contact</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{club.poc}</p>
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
