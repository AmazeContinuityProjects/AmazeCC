import { useState, useEffect } from "react";
import { API_BASE } from "../../custom/Main";
import { Skeleton } from "@amazecontinuityprojects/amazeui";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Calendar, ExternalLink } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function CommunityFeed({ IDs, loginToVTOP }: { IDs?: any, loginToVTOP?: () => Promise<any> }) {
  const [feed, setFeed] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchFeed = async (currentVtopId?: string) => {
    try {
      const vtopIdParam = currentVtopId ? `?vtop_id=${currentVtopId}` : "";
      const [feedRes, eventsRes] = await Promise.all([
        fetch(`${API_BASE}/api/club-admin/feed${vtopIdParam}`).then(res => res.json()),
        fetch(`${API_BASE}/api/events`).then(res => res.json()).catch(() => [])
      ]);

      if (feedRes.success) {
        setFeed(feedRes.feed || []);
      } else {
        setError(feedRes.error || "Failed to load community feed");
      }
      if (Array.isArray(eventsRes)) {
        setEvents(eventsRes);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while fetching feed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed(IDs?.VtopUsername);
  }, [IDs?.VtopUsername]);

  const handlePromote = async (postId: string) => {
    let currentAuthID = IDs?.VtopUsername;
    
    if (!currentAuthID) {
      if (loginToVTOP) {
        try {
          const creds = await loginToVTOP();
          currentAuthID = creds.authorizedID;
        } catch (e) {
          alert("You must be logged into VTOP to promote posts.");
          return;
        }
      } else {
        alert("You must be logged into VTOP to promote posts.");
        return;
      }
    }

    setActionLoading(postId);
    try {
      const res = await fetch(`${API_BASE}/api/club-admin/feed/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId, vtop_id: currentAuthID })
      });
      const data = await res.json();
      if (data.success) {
        setFeed(prev => prev.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              has_promoted: data.promoted,
              promote_count: data.promoted ? Number(p.promote_count) + 1 : Number(p.promote_count) - 1
            };
          }
          return p;
        }));
      } else {
        alert(data.error || "Failed to promote post");
      }
    } catch (e) {
      alert("An error occurred");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 bg-red-50 dark:bg-red-900/10 text-red-600 rounded-2xl max-w-3xl mx-auto">
        <p>{error}</p>
      </div>
    );
  }

  if (feed.length === 0) {
    return (
      <div className="text-center p-12 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800 max-w-3xl mx-auto">
        <p className="text-gray-500">No community posts yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {feed.map((post) => (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          key={post.id}
          className="p-6 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm"
        >
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 dark:text-white">Club {post.club_id}</span>
              <span className="text-sm text-gray-500">&bull; {new Date(post.created_at).toLocaleDateString()}</span>
            </div>
            {post.event_id && (
              <span className="px-3 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-full">
                Event: {post.event_id}
              </span>
            )}
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 prose-p:leading-relaxed prose-a:text-blue-500 hover:prose-a:text-blue-600 prose-img:rounded-xl">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
          </div>
          
          {post.image_urls && post.image_urls.length > 0 && (
            <div className="mt-4 mb-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {post.image_urls.map((url: string, i: number) => (
                <a key={i} href={url} target="_blank" rel="noreferrer" className="block group rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 h-40">
                  <img src={url} alt="Attached" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </a>
              ))}
            </div>
          )}

          {post.event_id && (
            <div className="mt-5 mb-2">
              {(() => {
                const eventDetails = events.find(e => e.eid === post.event_id);
                if (eventDetails) {
                  return (
                    <div className="bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 rounded-2xl p-5 flex flex-col sm:flex-row gap-4 items-center">
                      <div className="flex-1 w-full">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-[10px] font-bold uppercase tracking-wider">Featured Event</span>
                          {eventDetails.type && <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{eventDetails.type}</span>}
                        </div>
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white leading-tight mb-3">{eventDetails.title}</h4>
                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-300">
                          {eventDetails.date && <div className="flex items-center gap-1.5"><span className="text-purple-500 font-bold">📅</span> {eventDetails.date}</div>}
                          {eventDetails.location && <div className="flex items-center gap-1.5"><span className="text-purple-500 font-bold">📍</span> {eventDetails.location}</div>}
                          {eventDetails.price && <div className="flex items-center gap-1.5"><span className="text-purple-500 font-bold">₹</span> {eventDetails.price}</div>}
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          sessionStorage.setItem("pendingEventOpen", eventDetails.title);
                          // Trigger event to switch tabs if needed, or just let them find it
                          window.dispatchEvent(new CustomEvent('nav-to-events'));
                          alert("Event selected! Navigate to the Event Hub tab to view details.");
                        }}
                        className="w-full sm:w-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium text-sm transition-colors shadow-sm"
                      >
                        View in Hub
                      </button>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          )}

          {post.links && post.links.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {post.links.map((link: any, i: number) => (
                <a key={i} href={link.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-xl transition-colors">
                  {link.title} <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ))}
            </div>
          )}
          
          <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <button 
              onClick={() => handlePromote(post.id)}
              disabled={actionLoading === post.id}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                post.has_promoted
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-100 dark:border-blue-800"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-800/50 dark:text-gray-400 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700"
              }`}
            >
              <ArrowUp className={`w-4 h-4 ${post.has_promoted ? "fill-current" : ""}`} />
              <span className="tabular-nums">{post.promote_count || 0} Promotes</span>
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
