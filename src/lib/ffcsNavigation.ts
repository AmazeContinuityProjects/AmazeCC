import { getAssetPath } from "@/lib/utils";

/** Canonical standalone FFCS planner route. */
export const FFCS_PLANNER_PATH = "/ffcs/";

/** Navigate from the main app to its standalone FFCS planner page. */
export function navigateToFFCSPlanner(): void {
  if (typeof window === "undefined") return;
  window.location.assign(getAssetPath(FFCS_PLANNER_PATH));
}
