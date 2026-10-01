"use client";
import { useState, useEffect } from "react";
import { GitBranch, GitCommit, History, RefreshCcw, Sparkles } from "lucide-react";
import { fetchGitHubCommits, groupCommitsByDate, GitHubCommit, CommitGroup } from "@/lib/githubChangelog";
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
 * Commit type -> tone.
 *
 * These were five hand-written gradient pills; they are now five entries in one
 * map so `ToneBadge` owns the recipe, which is the same rule the rest of the app
 * follows. The emoji stays in the label — it is the part readers scan for, and
 * the tone alone does not distinguish `fix` from `perf` at a glance.
 *
 * Typed as a plain lookup rather than `Record<GitHubCommit["type"], …>`: the
 * commit type union has eight members and only the four interesting ones are
 * named here, so a `Record` would demand seven more rows of filler and still be
 * wrong the moment the classifier grows a branch. Everything unnamed falls
 * through to `other`.
 */
const TYPE_TONE: Record<string, { tone: string; label: string }> = {
  feat: { tone: "emerald", label: "✨ Feature" },
  fix: { tone: "red", label: "🐛 Fix" },
  refactor: { tone: "indigo", label: "⚡ Refactor" },
  perf: { tone: "amber", label: "🚀 Perf" },
};

const typeBadge = (type: GitHubCommit["type"]) => {
  const entry = TYPE_TONE[type] ?? { tone: "blue", label: "🔨 Update" };
  return <ToneBadge tone={entry.tone}>{entry.label}</ToneBadge>;
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
          <IconButton
            onClick={() => void loadCommits(true)}
            title="Refresh commits"
            disabled={refreshing || loading}
          >
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
                {group.commits.map((commit) => (
                  <div key={commit.sha} className="flex items-start gap-3 py-3 px-4">
                    <span className="shrink-0 pt-0.5">{typeBadge(commit.type)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-text-heading leading-relaxed">
                        {commit.cleanMessage}
                      </p>
                      <p className="mt-1 text-[10px] font-medium text-text-muted">
                        by{" "}
                        <span className="font-bold text-text-secondary dark:text-text-secondary">
                          {commit.authorName}
                        </span>
                      </p>
                    </div>
                    <a
                      href={commit.url}
                      target="_blank"
                      rel="noreferrer"
                      title={`Open commit ${commit.shortSha} on GitHub`}
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-surface-tertiary dark:bg-surface-secondary px-2 py-1 text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 border border-border-muted hover:border-indigo-500/40 transition-colors"
                    >
                      <GitCommit className="h-2.5 w-2.5" />
                      {commit.shortSha}
                    </a>
                  </div>
                ))}
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
                  right={
                    <span className="text-[10px] font-bold text-text-muted shrink-0">
                      {release.date}
                    </span>
                  }
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
