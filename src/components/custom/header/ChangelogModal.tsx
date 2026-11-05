"use client";
import { useState, useEffect } from "react";
import {
  GitBranch,
  GitCommit,
  History,
  RefreshCcw,
  Sparkles,
  Bug,
  Code2,
  Zap,
  FileText,
  Palette,
  Wrench,
} from "lucide-react";
import { fetchGitHubCommits, groupCommitsByDate, GitHubCommit, CommitGroup } from "@/lib/githubChangelog";
import buildInfo from "@/data/buildInfo.json";
import changelogData from "@/data/changelog.json";
import {
  IconButton,
  IconLink,
  ListRowText,
  ListShell,
  ListSkeleton,
  PageShell,
  SectionHeader,
  ToneBadge,
} from "../shared/primitives";

/**
 * Commit type -> visual icon and tactile tint styling.
 *
 * Instead of bulky text badges that consume horizontal space on mobile,
 * each commit type is represented by a crisp, Apple-grade icon well with
 * subtle colored surface depth and crisp micro-borders.
 */
interface CommitTypeConfig {
  icon: typeof Sparkles;
  label: string;
  containerClass: string;
  iconClass: string;
}

const TYPE_CONFIG: Record<string, CommitTypeConfig> = {
  feat: {
    icon: Sparkles,
    label: "Feature",
    containerClass:
      "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/25 text-emerald-600 dark:text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.12)]",
    iconClass: "stroke-[2.2]",
  },
  fix: {
    icon: Bug,
    label: "Bug Fix",
    containerClass:
      "bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/25 text-rose-600 dark:text-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.12)]",
    iconClass: "stroke-[2.2]",
  },
  refactor: {
    icon: Code2,
    label: "Refactor",
    containerClass:
      "bg-indigo-500/10 dark:bg-indigo-500/15 border-indigo-500/25 text-indigo-600 dark:text-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.12)]",
    iconClass: "stroke-[2.2]",
  },
  perf: {
    icon: Zap,
    label: "Performance",
    containerClass:
      "bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/25 text-amber-600 dark:text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.12)]",
    iconClass: "stroke-[2.2]",
  },
  docs: {
    icon: FileText,
    label: "Docs",
    containerClass: "bg-sky-500/10 dark:bg-sky-500/15 border-sky-500/25 text-sky-600 dark:text-sky-400",
    iconClass: "stroke-[2.2]",
  },
  style: {
    icon: Palette,
    label: "Design",
    containerClass:
      "bg-fuchsia-500/10 dark:bg-fuchsia-500/15 border-fuchsia-500/25 text-fuchsia-600 dark:text-fuchsia-400",
    iconClass: "stroke-[2.2]",
  },
  chore: {
    icon: Wrench,
    label: "Chore",
    containerClass: "bg-slate-500/10 dark:bg-zinc-500/15 border-slate-500/25 text-slate-600 dark:text-zinc-400",
    iconClass: "stroke-[2.2]",
  },
};

const DEFAULT_TYPE_CONFIG: CommitTypeConfig = {
  icon: GitCommit,
  label: "Update",
  containerClass: "bg-blue-500/10 dark:bg-blue-500/15 border-blue-500/25 text-blue-600 dark:text-blue-400",
  iconClass: "stroke-[2.2]",
};

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

  return (
    <PageShell
      eyebrow="About"
      title="Live Changelog"
      subtitle="Straight from the repository's commit history"
      onBack={handleClose}
      actions={
        <>
          <IconLink
            href="https://github.com/AmazeContinuityProjects/AmazeCC/commits"
            title="feat/anas on GitHub"
            ariaLabel="Open the commit history on GitHub"
          >
            <GitBranch className="w-4 h-4" />
          </IconLink>
          <IconButton onClick={() => void loadCommits(true)} title="Refresh commits" disabled={refreshing || loading}>
            <RefreshCcw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </IconButton>
        </>
      }
    >
      <div className="space-y-6">
        <div className="flex items-center gap-2 px-1">
          <ToneBadge tone={error ? "amber" : "emerald"} icon={<span className="w-1.5 h-1.5 rounded-full bg-current" />}>
            {error ? "Offline — showing saved releases" : "GitHub sync active"}
          </ToneBadge>
        </div>

        {/*
         * The summary of the build this device is actually running — the same
         * content the retired "What's New" toast used to pop over the app
         * after every update. Pinned at the top of the log instead of shown
         * as an interruption; sourced from the generated `buildInfo.json`, so
         * it renders even with no network.
         */}
        <div className="space-y-3">
          <SectionHeader
            icon={Sparkles}
            title="What's new in this build"
            count={buildInfo.changes.length}
            right={<span className="text-[10px] font-bold text-text-muted shrink-0">{buildInfo.date}</span>}
          />
          <ListShell>
            {buildInfo.changes.map((change, i) => (
              <div key={i} className="flex items-start gap-2.5 py-2.5 px-4">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                <span className="text-xs font-medium leading-relaxed text-text-secondary dark:text-text-muted flex-1 min-w-0">
                  {change}
                </span>
                {i === 0 && buildInfo.commitHash !== "unknown" && (
                  <a
                    href={`https://github.com/AmazeContinuityProjects/AmazeCC/commit/${buildInfo.commitHash}`}
                    target="_blank"
                    rel="noreferrer"
                    title={`Open commit ${buildInfo.commitHash} on GitHub`}
                    className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-surface-tertiary dark:bg-surface-secondary px-2 py-1 text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 border border-border-muted hover:border-indigo-500/40 transition-colors"
                  >
                    <GitCommit className="h-2.5 w-2.5" />
                    {buildInfo.commitHash}
                  </a>
                )}
              </div>
            ))}
          </ListShell>
        </div>

        {loading ? (
          <ListSkeleton rows={6} leading="dot" trailing />
        ) : commitGroups.length > 0 ? (
          /* The hand-drawn timeline spine and its gradient dots are gone. Each
             day is a section header and its commits are rows, which is the same
             thing the calendar and course pages do with a grouped list — and it
             stops the last group having to special-case its own connector. */
          commitGroups.map((group) => (
            <div key={group.date} className="space-y-3">
              <SectionHeader
                icon={History}
                title={group.date}
                count={group.commits.length}
                right={
                  <span className="text-[10px] font-bold text-text-muted shrink-0">
                    {group.commits.length === 1 ? "commit" : "commits"}
                  </span>
                }
              />
              <ListShell>
                {group.commits.map((commit) => {
                  const conf = TYPE_CONFIG[commit.type] ?? DEFAULT_TYPE_CONFIG;
                  const Icon = conf.icon;
                  return (
                    <div
                      key={commit.sha}
                      className="flex items-start gap-3 py-3 px-3.5 sm:px-4 hover:bg-surface-secondary/40 transition-colors group"
                    >
                      {/* Modern Tactile Icon Well */}
                      <div
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center border shrink-0 mt-0.5 transition-transform group-hover:scale-105 ${conf.containerClass}`}
                        title={conf.label}
                        aria-label={conf.label}
                      >
                        <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${conf.iconClass}`} />
                      </div>

                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="text-xs font-semibold text-text-heading leading-relaxed line-clamp-2 sm:line-clamp-none">
                          {commit.cleanMessage}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5 text-[10.5px] font-medium text-text-muted">
                          <span>
                            by{" "}
                            <span className="font-bold text-text-secondary dark:text-text-secondary">
                              {commit.authorName}
                            </span>
                          </span>
                          <span className="text-border-muted opacity-60">·</span>
                          <span className="text-[10px] font-semibold text-text-muted capitalize">{conf.label}</span>
                        </div>
                      </div>

                      <a
                        href={commit.url}
                        target="_blank"
                        rel="noreferrer"
                        title={`Open commit ${commit.shortSha} on GitHub`}
                        className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-surface-tertiary dark:bg-surface-secondary px-2 py-1 text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 border border-border-muted hover:border-indigo-500/40 active:scale-95 transition-all"
                      >
                        <GitCommit className="h-2.5 w-2.5" />
                        {commit.shortSha}
                      </a>
                    </div>
                  );
                })}
              </ListShell>
            </div>
          ))
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-center text-xs font-medium text-amber-600 dark:text-amber-400">
              Offline mode: showing saved version releases
            </div>
            {changelogData.map((release) => (
              <div key={release.version} className="space-y-3">
                <SectionHeader
                  icon={Sparkles}
                  title={release.version}
                  right={<span className="text-[10px] font-bold text-text-muted shrink-0">{release.date}</span>}
                />
                <ListShell>
                  {release.changes.map((change, i) => (
                    <div key={i} className="flex items-start gap-2.5 py-2.5 px-4">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                      <span className="text-xs font-medium leading-relaxed text-text-secondary dark:text-text-muted">
                        {change}
                      </span>
                    </div>
                  ))}
                </ListShell>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
