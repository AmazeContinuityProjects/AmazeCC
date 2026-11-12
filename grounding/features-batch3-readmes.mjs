// Overwrites scaffold stubs with proper feature READMEs for batch 3 folders.
import { writeFileSync } from "node:fs";

const R = {
  qbank: ["QBank", "question bank per course: papers, model answers, search"],
  "paper-scanner": ["Paper Scanner", "camera → crop → OCR → PDF, fully on-device"],
  "student-report": ["Student Report", "complete personal academic report, generated on-device"],
  "settings-and-profile": ["Settings & Profile", "account, appearance, sync modes, API host, about"],
  "notifications-and-push": ["Notifications & Push", "opt-in reminders, quiet hours, per-category"],
  "feedback-and-support": ["Feedback & Support", "in-app bug reporter with optional session replay"],
  "changelog-and-about": ["Changelog & About", "version history, credits, build identity"],
  "about-and-licensing": ["About & Licensing", "what this is, who built it, under what licenses"],
  onboarding: ["Onboarding", "first-run flow: sign-in → sync → welcome"],
  "guest-landing": ["Guest Landing", "the public page at /: hero, FAQ, install CTA"],
};

for (const [k, [t, tag]] of Object.entries(R)) {
  const p = `docs/05-${k}/README.md`;
  writeFileSync(
    p,
    `# 05 — ${t}\n\n> **In one line:** ${tag}.\n\n- [overview.md](overview.md) · [architecture.md](architecture.md) · [data-model.md](data-model.md)\n- [ui-map.md](ui-map.md) · [storage-and-state.md](storage-and-state.md) · [testing.md](testing.md)\n- [known-issues.md](known-issues.md) · [history.md](history.md)\n\nSource anchor: see the paths inside each page.\n`,
    "utf8",
  );
}
console.log("done");
