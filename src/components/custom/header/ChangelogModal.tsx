import { useState, useEffect } from "react";
import { X, History, Sparkles, RefreshCcw, ExternalLink, GitCommit, GitBranch, Loader2 } from "lucide-react";
import { fetchGitHubCommits, groupCommitsByDate, GitHubCommit, CommitGroup } from "@/lib/githubChangelog";
import changelogData from "../../../data/changelog.json";

export default function ChangelogModal({ handleClose }: { handleClose: () => void }) {
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const loadCommits = async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await fetchGitHubCommits(forceRefresh);
      if (data && data.length > 0) {
        setCommits(data);
        setError(false);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCommits();
  }, []);

  const commitGroups: CommitGroup[] = commits.length > 0 ? groupCommitsByDate(commits) : [];

  const getTypeBadge = (type: GitHubCommit["type"]) => {
    switch (type) {
      case "feat":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">✨ Feature</span>;
      case "fix":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">🐛 Fix</span>;
      case "refactor":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">⚡ Refactor</span>;
      case "perf":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">🚀 Perf</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">🔨 Update</span>;
    }
  };

  return (
    <div className="w-full h-full flex flex-col relative pb-10 animate-fadeIn">
      <div className="w-full max-w-3xl mx-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between py-6 mb-2 mt-4 sm:mt-8 px-4 sm:px-0">
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="p-2.5 bg-white/60 hover:bg-white dark:hover:bg-slate-800 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 rounded-full transition-all border border-gray-200/50 dark:border-white/10 shadow-sm cursor-pointer"
            >
              <X size={20} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                <History size={20} />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-gray-100 font-outfit">
                  Live Changelog
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    GitHub Sync Active
                  </span>
                  <a
                    href="https://github.com/AmazeContinuityProjects/AmazeCC/commits"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-gray-400 dark:text-gray-500 hover:underline flex items-center gap-0.5"
                  >
                    <GitBranch size={10} />
                    feat/anas
                  </a>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => loadCommits(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800/80 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-all cursor-pointer border border-gray-200/50 dark:border-gray-700 disabled:opacity-50"
          >
            <RefreshCcw size={13} className={refreshing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 max-h-[75vh]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <Loader2 size={32} className="text-blue-500 animate-spin" />
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                Fetching latest commits from GitHub...
              </p>
            </div>
          ) : commitGroups.length > 0 ? (
            commitGroups.map((group, idx) => (
              <div key={group.date} className="relative pl-6 sm:pl-8">
                {/* Timeline vertical bar */}
                {idx !== commitGroups.length - 1 && (
                  <div className="absolute left-[11px] sm:left-[15px] top-8 bottom-[-32px] w-0.5 bg-gray-200 dark:bg-gray-800" />
                )}

                {/* Timeline dot */}
                <div className="absolute left-0 top-1 w-[24px] h-[24px] sm:w-[30px] sm:h-[30px] rounded-full border-4 border-white dark:border-gray-900 bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm flex items-center justify-center">
                  <Sparkles size={11} className="text-white" />
                </div>

                {/* Date header */}
                <div className="mb-3 flex items-center gap-2">
                  <h3 className="text-base font-black text-gray-900 dark:text-gray-100 font-outfit">
                    {group.date}
                  </h3>
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                    {group.commits.length} {group.commits.length === 1 ? "commit" : "commits"}
                  </span>
                </div>

                {/* Commit Items */}
                <div className="space-y-2.5">
                  {group.commits.map((commit) => (
                    <div
                      key={commit.sha}
                      className="p-3.5 rounded-2xl bg-white/70 dark:bg-gray-900/60 border border-gray-200/60 dark:border-gray-800 hover:border-blue-500/40 dark:hover:border-blue-500/40 transition-all shadow-2xs group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="mt-0.5 shrink-0">
                            {getTypeBadge(commit.type)}
                          </div>
                          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-relaxed">
                            {commit.cleanMessage}
                          </p>
                        </div>

                        <a
                          href={commit.url}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-[10px] font-mono text-blue-600 dark:text-blue-400 font-bold hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
                        >
                          <GitCommit size={11} />
                          {commit.shortSha}
                          <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-850 flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500">
                        <span className="font-medium">
                          by <strong className="text-gray-600 dark:text-gray-300 font-bold">{commit.authorName}</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            /* Fallback to static changelog.json if API is offline */
            <div className="space-y-6">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium text-center">
                Offline Mode: Displaying saved version releases
              </div>
              {changelogData.map((release, idx) => (
                <div key={idx} className="relative pl-6">
                  {idx !== changelogData.length - 1 && (
                    <div className="absolute left-[11px] top-8 bottom-[-24px] w-0.5 bg-gray-200 dark:bg-gray-800" />
                  )}
                  <div className="absolute left-0 top-1.5 w-[24px] h-[24px] rounded-full border-4 border-white dark:border-gray-900 bg-blue-500 shadow-sm flex items-center justify-center">
                    {idx === 0 && <Sparkles size={10} className="text-white" />}
                  </div>
                  <div className="mb-1 flex items-baseline gap-3">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{release.version}</h3>
                    <span className="text-sm font-medium text-gray-500">{release.date}</span>
                  </div>
                  <ul className="space-y-2 mt-3">
                    {release.changes.map((change, i) => (
                      <li key={i} className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed flex items-start">
                        <span className="text-blue-500 mr-2 mt-1.5">•</span>
                        <span>{change}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
