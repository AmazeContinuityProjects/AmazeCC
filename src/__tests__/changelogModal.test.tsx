import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import ChangelogModal from "../components/custom/header/ChangelogModal";
import * as githubChangelog from "@/lib/githubChangelog";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const mockCommits: githubChangelog.GitHubCommit[] = [
  {
    sha: "a1b2c3d4e5f6",
    shortSha: "a1b2c3d",
    message: "feat: add instant offline caching for timetable",
    cleanMessage: "add instant offline caching for timetable",
    type: "feat",
    authorName: "Sugeeth",
    date: "2026-11-05T10:00:00Z",
    formattedDate: "Nov 5, 2026",
    url: "https://github.com/AmazeContinuityProjects/AmazeCC/commit/a1b2c3d4e5f6",
  },
  {
    sha: "b2c3d4e5f6a1",
    shortSha: "b2c3d4e",
    message: "fix: resolve attendance percentage rounding issue",
    cleanMessage: "resolve attendance percentage rounding issue",
    type: "fix",
    authorName: "Anas",
    date: "2026-11-05T09:30:00Z",
    formattedDate: "Nov 5, 2026",
    url: "https://github.com/AmazeContinuityProjects/AmazeCC/commit/b2c3d4e5f6a1",
  },
  {
    sha: "c3d4e5f6a1b2",
    shortSha: "c3d4e5f",
    message: "perf: optimize course list render performance",
    cleanMessage: "optimize course list render performance",
    type: "perf",
    authorName: "AmazeCC Team",
    date: "2026-11-05T08:00:00Z",
    formattedDate: "Nov 5, 2026",
    url: "https://github.com/AmazeContinuityProjects/AmazeCC/commit/c3d4e5f6a1b2",
  },
];

describe("ChangelogModal Live Changelog Icon Redesign", () => {
  it("renders commits with modern tactile icon wells instead of bulky text badges", async () => {
    vi.spyOn(githubChangelog, "fetchGitHubCommits").mockResolvedValue(mockCommits);

    render(<ChangelogModal handleClose={vi.fn()} />);

    // Wait for commits to load
    await waitFor(() => {
      expect(screen.getByText("add instant offline caching for timetable")).toBeDefined();
    });

    // Verify commit messages
    expect(screen.getByText("resolve attendance percentage rounding issue")).toBeDefined();
    expect(screen.getByText("optimize course list render performance")).toBeDefined();

    // Verify tactile icon elements by title/aria-label instead of text badges
    const featureIcon = screen.getByTitle("Feature");
    expect(featureIcon).toBeDefined();
    expect(featureIcon.className).toContain("rounded-xl");
    expect(featureIcon.className).toContain("border-emerald-500");

    const fixIcon = screen.getByTitle("Bug Fix");
    expect(fixIcon).toBeDefined();
    expect(fixIcon.className).toContain("border-rose-500");

    const perfIcon = screen.getByTitle("Performance");
    expect(perfIcon).toBeDefined();
    expect(perfIcon.className).toContain("border-amber-500");

    // Verify author names and commit hashes are present and readable
    expect(screen.getByText(/Sugeeth/i)).toBeDefined();
    expect(screen.getByText(/Anas/i)).toBeDefined();
    expect(screen.getByText("a1b2c3d")).toBeDefined();
    expect(screen.getByText("b2c3d4e")).toBeDefined();
  });
});
