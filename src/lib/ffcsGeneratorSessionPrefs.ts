import type { CourseLock } from "@/components/custom/exams/FFCS/types";
import type { RankingMode } from "@/lib/ffcsRanking";
import type { FacultyMetricWeights, FacultyScoreFilters } from "@/lib/ffcsFacultyRanking";
import type { RankingPriority } from "@/lib/ffcsSettings";
import type { DayId } from "@/lib/slots";
import type { SortBy } from "@/lib/timetableMetrics";

export interface GeneratorSessionPreferences {
  preference?: "compact" | "spread" | "morning" | "evening";
  strictTheoryPreference?: boolean;
  uniqueFaculties?: boolean;
  noLimit?: boolean;
  resultCap?: number;
  rankingMode?: RankingMode | null;
  rankingPriorityOrder?: RankingPriority[];
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
