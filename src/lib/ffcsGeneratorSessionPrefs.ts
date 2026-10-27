import type { CourseLock } from "@/components/custom/exams/FFCS/types";
import type { RankingFactor, RankingMode } from "@/lib/ffcsRanking";
import type { FacultyMetricWeights, FacultyScoreFilters } from "@/lib/ffcsFacultyRanking";
import type { RankingPriority } from "@/lib/ffcsSettings";
import type { DayId } from "@/lib/slots";
import type { SortBy } from "@/lib/timetableMetrics";

/** The four Vitfac metrics a faculty score can be built from. */
export type FacultyMetricKey = "wPct" | "lecture" | "da" | "vibe";

export interface GeneratorSessionPreferences {
  preference?: "compact" | "spread" | "morning" | "evening";
  strictTheoryPreference?: boolean;
  separateLabDays?: boolean;
  avoidConsecutiveLabs?: boolean;
  lunchBreakSeparatesLabs?: boolean;
  uniqueFaculties?: boolean;
  noLimit?: boolean;
  resultCap?: number;
  rankingMode?: RankingMode | null;
  rankingPriorityOrder?: RankingPriority[];
  /** The generator's ranked factor list: priority order + per-factor off switch. */
  rankingFactorOrder?: RankingFactor[];
  rankingFactorDisabled?: RankingFactor[];
  /** Faculty sub-list (metric priorities), same recipe as the factor list. */
  facultyMetricOrder?: FacultyMetricKey[];
  facultyMetricDisabled?: FacultyMetricKey[];
  facultyMetricWeights?: FacultyMetricWeights;
  facultyScoreFilters?: FacultyScoreFilters;
  minHalfDays?: number;
  minStartTime?: string;
  maxEndTime?: string;
  maxEndTimeByDay?: Partial<Record<DayId, string>>;
  sortBy?: SortBy;
  syncFriendsClasses?: boolean;
  syncFriendClasses?: boolean; // alias for backwards compatibility
  maximizeFreeTimeFriends?: string[];
  targets?: CourseLock[];
  isReviewing?: boolean;
}

const memoryStore = new Map<string, string>();

export const safeSessionStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        return window.sessionStorage.getItem(key);
      }
    } catch {
      // Fall back to memoryStore
    }
    return memoryStore.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.setItem(key, value);
        return;
      }
    } catch {
      // Fall back to memoryStore
    }
    memoryStore.set(key, value);
  },
  removeItem(key: string): void {
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.removeItem(key);
        return;
      }
    } catch {
      // Fall back to memoryStore
    }
    memoryStore.delete(key);
  },
  clear(): void {
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.clear();
      }
    } catch {
      // Fall back to memoryStore
    }
    memoryStore.clear();
  },
};

export const FFCS_GENERATOR_SESSION_KEY = "ffcs_generator_session_prefs";

export function loadSessionPreferences(): GeneratorSessionPreferences {
  try {
    const raw = safeSessionStorage.getItem(FFCS_GENERATOR_SESSION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as GeneratorSessionPreferences;
  } catch {
    return {};
  }
}

export function saveSessionPreferences(prefs: GeneratorSessionPreferences): void {
  try {
    safeSessionStorage.setItem(FFCS_GENERATOR_SESSION_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore quota or serialisation failures
  }
}

export function clearSessionPreferences(): void {
  safeSessionStorage.removeItem(FFCS_GENERATOR_SESSION_KEY);
}
