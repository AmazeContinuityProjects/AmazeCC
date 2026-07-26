export interface GitHubCommit {
  sha: string;
  shortSha: string;
  message: string;
  cleanMessage: string;
  type: "feat" | "fix" | "refactor" | "docs" | "style" | "perf" | "chore" | "other";
  authorName: string;
  authorAvatar?: string;
  date: string;
  formattedDate: string;
  url: string;
}

export interface CommitGroup {
  date: string;
  commits: GitHubCommit[];
}

const REPO_OWNER = "AmazeContinuityProjects";
const REPO_NAME = "AmazeCC";
const GITHUB_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits?per_page=30`;

let memoryCache: { data: GitHubCommit[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

export function parseCommitType(message: string): "feat" | "fix" | "refactor" | "docs" | "style" | "perf" | "chore" | "other" {
  const lower = message.toLowerCase();
  if (lower.startsWith("feat")) return "feat";
  if (lower.startsWith("fix")) return "fix";
  if (lower.startsWith("refactor")) return "refactor";
  if (lower.startsWith("perf")) return "perf";
  if (lower.startsWith("docs")) return "docs";
  if (lower.startsWith("style")) return "style";
  if (lower.startsWith("chore")) return "chore";
  return "other";
}

export function cleanCommitMessage(message: string): string {
  let firstLine = message.split("\n")[0].trim();
  firstLine = firstLine.replace(/^(feat|fix|refactor|docs|style|perf|chore)(\([^)]+\))?:\s*/i, "");
  return firstLine;
}

export async function fetchGitHubCommits(forceRefresh = false): Promise<GitHubCommit[]> {
  if (!forceRefresh && memoryCache && Date.now() - memoryCache.timestamp < CACHE_TTL_MS) {
    return memoryCache.data;
  }

  if (!forceRefresh && typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem("github_changelog_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_TTL_MS && Array.isArray(parsed.data)) {
          memoryCache = parsed;
          return parsed.data;
        }
      }
    } catch {}
  }

  try {
    const res = await fetch(GITHUB_API_URL, {
      headers: { Accept: "application/vnd.github.v3+json" },
    });

    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

    const rawCommits = await res.json();
    if (!Array.isArray(rawCommits)) throw new Error("Invalid response format");

    const commits: GitHubCommit[] = rawCommits
      .filter((c: any) => {
        const msg = c?.commit?.message || "";
        return !msg.startsWith("Merge pull request") && !msg.startsWith("Merge branch");
      })
      .map((c: any) => {
        const rawMsg = c?.commit?.message || "";
        const sha = c.sha || "";
        const dateStr = c?.commit?.author?.date || c?.commit?.committer?.date || new Date().toISOString();
        const dateObj = new Date(dateStr);

        return {
          sha,
          shortSha: sha.substring(0, 7),
          message: rawMsg,
          cleanMessage: cleanCommitMessage(rawMsg),
          type: parseCommitType(rawMsg),
          authorName: c?.commit?.author?.name || c?.author?.login || "AmazeCC Contributor",
          authorAvatar: c?.author?.avatar_url,
          date: dateStr,
          formattedDate: dateObj.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          url: c.html_url || `https://github.com/${REPO_OWNER}/${REPO_NAME}/commit/${sha}`,
        };
      });

    const cachePayload = { data: commits, timestamp: Date.now() };
    memoryCache = cachePayload;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("github_changelog_cache", JSON.stringify(cachePayload));
      } catch {}
    }

    return commits;
  } catch (err) {
    console.warn("Failed to fetch commits from GitHub, using cache/fallback:", err);
    if (memoryCache) return memoryCache.data;
    return [];
  }
}

export function groupCommitsByDate(commits: GitHubCommit[]): CommitGroup[] {
  const map: Record<string, GitHubCommit[]> = {};
  commits.forEach((c) => {
    if (!map[c.formattedDate]) {
      map[c.formattedDate] = [];
    }
    map[c.formattedDate].push(c);
  });

  return Object.entries(map).map(([date, commits]) => ({
    date,
    commits,
  }));
}
