/**
 * `CH25260101` → `Fall 2025-2026`.
 *
 * Canonical copy: this helper existed five times across the codebase
 * (`courseHelpers`, `NavigationTabs`, `SimplifiedAcademicsPage`,
 * `AmazeOnboardingFlow`, `officialOd` — the last missing the `length !== 10`
 * guard, which formatted malformed ids into garbage like `Term 12-`).
 * Anything that is not a 10-character `CH…` code passes through unchanged.
 */
export function formatSemesterName(semId: string): string {
  if (!semId || !semId.toUpperCase().startsWith("CH") || semId.length !== 10) return semId;
  const year1 = semId.substring(2, 6);
  const year2 = semId.substring(6, 8);
  const term = semId.substring(8, 10);
  let termName = "";
  if (term === "01") termName = "Fall";
  else if (term === "05") termName = "Winter";
  else if (term === "07") termName = "Summer";
  else termName = `Term ${term}`;
  return `${termName} ${year1}-${year2}`;
}
