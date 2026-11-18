/**
 * Unified App Settings & Diagnostic Domain Types for AmazeCC.
 *
 * Unifies UI themes, diagnostic flags, support tickets, activity graph data,
 * and GitHub changelog state.
 */

import type { SupportTicket, GitHubChangelogCache, CustomSyncMode } from "./storage";

export interface UnifiedAppSettings {
  /** Visual theme */
  theme: "light" | "dark" | "system";
  /** PostHog debug instrumentation flag */
  phDebug: boolean;
  /** Custom application icon choice */
  appIcon: string;
  /** Activity tree recorded contribution years */
  activityTreeYears: number[];
  /** Open and resolved customer support tickets */
  supportTickets: SupportTicket[];
  /** User-configured sync engine modes */
  customSyncModes: CustomSyncMode[];
  /** Cached GitHub release changelog */
  changelog?: GitHubChangelogCache;
  /** Whether student has completed initial onboarding tour */
  hasSelectedInterface: boolean;
  /** Whether the push notification prompt was dismissed */
  isPushPromptDismissed: boolean;
}
