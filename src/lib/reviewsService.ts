"use client";

import { useEffect, useState } from "react";
import { safeSessionStorage } from "./ffcsGeneratorSessionPrefs";
import {
  ENABLE_VITFAC_INTEGRATION,
  loadVitfacCatalog,
  getFacultyReview as getVitfacFacultyReview,
  normalizeFacultyName,
  encodeVitfacId,
  type VitfacFaculty,
  type VitfacProfileBundle,
} from "./vitfacService";
import type { ParsedCourse } from "@/components/custom/exams/FFCS/types";
import { buildFacultyRatingLookup, type FacultyRatingLookup } from "./ffcsFacultyRanking";

export type AmazeReviewsMode = "vitfac_only" | "amaze_only" | "hybrid";

export const ENABLE_AMAZE_REVIEWS =
  typeof process !== "undefined" &&
  (process.env.NEXT_PUBLIC_ENABLE_AMAZE_REVIEWS === "true" ||
    process.env.ENABLE_AMAZE_REVIEWS === "true"); // Default OFF: set to "true" via env to enable

export const AMAZE_REVIEWS_MODE: AmazeReviewsMode =
  ((typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_AMAZE_REVIEWS_MODE) as AmazeReviewsMode) || "hybrid";

export const REVIEWS_WORKER_BASE =
  (typeof process !== "undefined" &&
    (process.env.NEXT_PUBLIC_REVIEWS_API_URL ||
      process.env.REVIEWS_WORKER_URL)) ||
  "http://localhost:8787";

export const REVIEWS_API_BASE =
  (typeof process !== "undefined" &&
    (process.env.NEXT_PUBLIC_API_URL ||
      process.env.PRIMARY_API_URL)) ||
  "http://localhost:3000";

const AMAZE_CATALOG_CACHE_KEY = "amaze_faculty_catalog_v3";
const AMAZE_CATALOG_TS_KEY = "amaze_faculty_catalog_ts_v3";
const CATALOG_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Clear older stale cache versions on module load
if (typeof window !== "undefined") {
  try {
    sessionStorage.removeItem("amaze_faculty_catalog_v1");
    sessionStorage.removeItem("amaze_faculty_catalog_ts_v1");
    sessionStorage.removeItem("amaze_faculty_catalog_v2");
    sessionStorage.removeItem("amaze_faculty_catalog_ts_v2");
    localStorage.removeItem("amaze_faculty_catalog_v1");
    localStorage.removeItem("amaze_faculty_catalog_ts_v1");
  } catch {}
}

export interface AmazeFacultyCatalogItem {
  id: string; // UUID
  employee_id: string | null;
  name: string;
  name_norm: string;
  school: string | null;
  designation: string | null;
  image_url: string | null;
  vitfac_id: string | null;
  teaching_grade: number | null;
  teaching_reviews: number;
  teaching_verified_ratio: number;
  project_grade: number | null;
  project_reviews: number;
  updated_at: string;
}

export interface UnifiedFacultyReview extends VitfacFaculty {
  vitfac_id?: string | null;
  vitfacId?: string | null;
  isFirstParty: boolean;
  teachingGrade: number | null;
  projectGrade: number | null;
  projectReviews?: number;
  project_reviews?: number;
  teachingVerifiedRatio?: number;
  legacyVitfac?: boolean;
}

// In-memory catalog indices
let amazeCatalogPromise: Promise<Map<string, UnifiedFacultyReview>> | null = null;
let byEmployeeId = new Map<string, UnifiedFacultyReview>();
let byNormalizedName = new Map<string, UnifiedFacultyReview>();
let byUuid = new Map<string, UnifiedFacultyReview>();
let isCatalogLoaded = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

function mapCatalogItemToUnified(item: AmazeFacultyCatalogItem): UnifiedFacultyReview {
  // Map 1.0 - 5.0 grade to win percentage equivalent (0 - 100%)
  const wPct = item.teaching_grade
    ? Math.round(((item.teaching_grade - 1.0) / 4.0) * 100)
    : 0;

  const vitfacId =
    item.vitfac_id ||
    (item.employee_id && /^\d+$/.test(item.employee_id.trim())
      ? encodeVitfacId(item.employee_id.trim())
      : undefined);

  return {
    id: item.id,
    employeeId: item.employee_id || undefined,
    vitfac_id: vitfacId,
    vitfacId: vitfacId,
    name: item.name,
    designation: item.designation || undefined,
    dept: item.school || undefined,
    wPct,
    reviews: item.teaching_reviews,
    wCount: Math.round((wPct / 100) * item.teaching_reviews),
    lCount: Math.max(0, item.teaching_reviews - Math.round((wPct / 100) * item.teaching_reviews)),
    image_url:
      item.image_url ||
      (item.employee_id && /^\d+$/.test(item.employee_id.trim())
        ? `https://blfxhlmpvdhcpdwgrffr.supabase.co/storage/v1/object/public/images/${item.employee_id.trim()}.webp`
        : null),
    isFirstParty: true,
    teachingGrade: item.teaching_grade,
    projectGrade: item.project_grade,
    projectReviews: item.project_reviews || 0,
    project_reviews: item.project_reviews || 0,
    teachingVerifiedRatio: item.teaching_verified_ratio,
    legacyVitfac: false,
  };
}

function indexAmazeCatalog(list: AmazeFacultyCatalogItem[]) {
  const empMap = new Map<string, UnifiedFacultyReview>();
  const nameMap = new Map<string, UnifiedFacultyReview>();
  const uuidMap = new Map<string, UnifiedFacultyReview>();
  const seenEmployees = new Set<string>();

  for (const raw of list) {
    const rawName = (raw.name || "").trim();
    // Filter out scraper junk or unnormalized duplicates (e.g. "50432 Shola Usha Rani Scope")
    if (/^\d{4,6}\s+/i.test(rawName)) {
      continue;
    }
    if (/^(assistant|associate|adjunct)?\s*professor$/i.test(rawName)) {
      continue;
    }

    // Deduplicate by employee_id if already indexed
    const empId = raw.employee_id ? raw.employee_id.trim() : null;
    if (empId) {
      if (seenEmployees.has(empId)) {
        continue;
      }
      seenEmployees.add(empId);
    }

    const unified = mapCatalogItemToUnified(raw);
    uuidMap.set(unified.id, unified);

    if (unified.employeeId) {
      empMap.set(unified.employeeId.trim(), unified);
    }

    if (unified.name) {
      const norm = normalizeFacultyName(unified.name);
      if (norm && !nameMap.has(norm)) {
        nameMap.set(norm, unified);
      }
    }
  }

  byEmployeeId = empMap;
  byNormalizedName = nameMap;
  byUuid = uuidMap;
  isCatalogLoaded = true;
  notifyListeners();
  return empMap;
}

/**
 * Returns all faculty members in the first-party catalog.
 */
export function getAllAmazeFaculty(): UnifiedFacultyReview[] {
  return Array.from(byUuid.values());
}

export function invalidateAmazeCatalog(): void {
  try {
    safeSessionStorage.removeItem(AMAZE_CATALOG_CACHE_KEY);
    safeSessionStorage.removeItem(AMAZE_CATALOG_TS_KEY);
  } catch {}
  isCatalogLoaded = false;
  amazeCatalogPromise = null;
}

/**
 * Loads the first-party catalog from Cloudflare Worker snapshot with fallback to local Next API.
 */
export async function loadAmazeCatalog(forceRefresh: boolean = false): Promise<Map<string, UnifiedFacultyReview>> {
  if (!ENABLE_AMAZE_REVIEWS) {
    return new Map();
  }

  if (forceRefresh) {
    try {
      safeSessionStorage.removeItem(AMAZE_CATALOG_CACHE_KEY);
      safeSessionStorage.removeItem(AMAZE_CATALOG_TS_KEY);
    } catch {}
    isCatalogLoaded = false;
    amazeCatalogPromise = null;
  } else if (isCatalogLoaded && byEmployeeId.size > 0) {
    return byEmployeeId;
  }

  if (amazeCatalogPromise) {
    return amazeCatalogPromise;
  }

  amazeCatalogPromise = (async () => {
    // 1. Try safeSessionStorage if not force refreshing
    if (!forceRefresh) {
      try {
        const cached = safeSessionStorage.getItem(AMAZE_CATALOG_CACHE_KEY);
        const ts = safeSessionStorage.getItem(AMAZE_CATALOG_TS_KEY);
        if (cached && ts) {
          const age = Date.now() - parseInt(ts, 10);
          if (age < CATALOG_TTL_MS) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return indexAmazeCatalog(parsed);
            }
          }
        }
      } catch {}
    }

    // 2. Fetch from Edge Worker or Next API with cache buster on forceRefresh
    const cacheBuster = forceRefresh ? `?_t=${Date.now()}` : "";
    const endpoints = [
      `${REVIEWS_WORKER_BASE}/api/reviews/catalog${cacheBuster}`,
      `${REVIEWS_API_BASE}/api/reviews/catalog${cacheBuster}`,
    ];

    for (const url of endpoints) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(url, { signal: controller.signal }).finally(() =>
          clearTimeout(timeout)
        );

        const contentType = res.headers.get("content-type") || "";
        if (res.ok && contentType.includes("application/json")) {
          const json = await res.json().catch(() => null);
          if (!json || json.schemaVersion !== "1.0.0") {
            continue;
          }
          const list: AmazeFacultyCatalogItem[] = json?.faculty || [];
          if (Array.isArray(list) && list.length > 0) {
            try {
              safeSessionStorage.setItem(AMAZE_CATALOG_CACHE_KEY, JSON.stringify(list));
              safeSessionStorage.setItem(AMAZE_CATALOG_TS_KEY, String(Date.now()));
            } catch {}
            return indexAmazeCatalog(list);
          }
        }
      } catch (err) {
        console.warn(`[reviewsService] Endpoint ${url} unreachable:`, err);
      }
    }

    return byEmployeeId;
  })();

  return amazeCatalogPromise;
}

/**
 * Unified synchronous review lookup respecting AMAZE_REVIEWS_MODE.
 */
export function getUnifiedFacultyReview(params: {
  employeeId?: string | null;
  name?: string | null;
  id?: string | null;
}): UnifiedFacultyReview | null {
  // If Amaze Reviews disabled or mode is vitfac_only, defer directly to vitfac
  if (!ENABLE_AMAZE_REVIEWS || AMAZE_REVIEWS_MODE === "vitfac_only") {
    const vf = getVitfacFacultyReview(params);
    if (!vf) return null;
    return {
      ...vf,
      isFirstParty: false,
      teachingGrade: null,
      projectGrade: null,
      legacyVitfac: true,
    };
  }

  if (!isCatalogLoaded) {
    loadAmazeCatalog().catch(() => {});
  }

  const { employeeId, name, id } = params;

  // 1. Check first-party Amaze catalog
  let match: UnifiedFacultyReview | null = null;

  if (id && byUuid.has(id)) {
    match = byUuid.get(id)!;
  }

  if (!match && employeeId) {
    const cleanId = String(employeeId).trim();
    if (byEmployeeId.has(cleanId)) {
      match = byEmployeeId.get(cleanId)!;
    }
  }

  if (!match && name) {
    const norm = normalizeFacultyName(name);
    if (byNormalizedName.has(norm)) {
      match = byNormalizedName.get(norm)!;
    }
  }

  // If matched and has sufficient first-party data, return it
  if (match && match.reviews > 0) {
    return match;
  }

  // 2. Hybrid Mode: Fallback to legacy vitfac if first-party has no reviews
  if (AMAZE_REVIEWS_MODE === "hybrid" && ENABLE_VITFAC_INTEGRATION) {
    const legacy = getVitfacFacultyReview(params);
    if (legacy && legacy.reviews > 0) {
      return {
        ...legacy,
        id: match?.id || legacy.id, // Preserve first-party UUID if known
        isFirstParty: false,
        teachingGrade: null,
        projectGrade: null,
        legacyVitfac: true,
      };
    }
  }

  // If first-party faculty entry exists (even with 0 reviews), return it
  if (match) {
    return match;
  }

  return null;
}

/**
 * Fetches the granular profile snapshot from worker or API.
 */
export async function getFacultyProfileSnapshot(
  facultyId: string
): Promise<any | null> {
  const endpoints = [
    `${REVIEWS_WORKER_BASE}/api/reviews/faculty/${encodeURIComponent(facultyId)}`,
    `${REVIEWS_API_BASE}/api/reviews/faculty/${encodeURIComponent(facultyId)}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url);
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        const data = await res.json().catch(() => null);
        if (data) return data;
      }
    } catch {}
  }
  return null;
}

/**
 * Hook to consume faculty review with automatic reactive updates.
 */
export function useFacultyReview(
  employeeId?: string | null,
  name?: string | null,
  id?: string | null
) {
  const [review, setReview] = useState<UnifiedFacultyReview | null>(() =>
    getUnifiedFacultyReview({ employeeId, name, id })
  );
  const [loading, setLoading] = useState<boolean>(!isCatalogLoaded);

  useEffect(() => {
    let active = true;

    const update = () => {
      if (!active) return;
      const found = getUnifiedFacultyReview({ employeeId, name, id });
      setReview(found);
      setLoading(false);
    };

    update();

    if (!isCatalogLoaded) {
      listeners.add(update);
      Promise.all([
        loadAmazeCatalog(),
        ENABLE_VITFAC_INTEGRATION ? loadVitfacCatalog() : Promise.resolve(new Map()),
      ]).finally(() => {
        if (active) setLoading(false);
      });
      return () => {
        active = false;
        listeners.delete(update);
      };
    }

    return () => {
      active = false;
    };
  }, [employeeId, name, id]);

  return { review, loading };
}

/**
 * Integrates first-party Amaze reviews with the FFCS timetable ranking engine.
 */
export async function loadRankingDataWithAmazeReviews(
  courses: readonly ParsedCourse[]
): Promise<{ available: boolean; ratings: FacultyRatingLookup }> {
  await Promise.all([
    loadAmazeCatalog(),
    ENABLE_VITFAC_INTEGRATION ? loadVitfacCatalog() : Promise.resolve(new Map()),
  ]);

  const ratings = buildFacultyRatingLookup(courses, ({ employeeId, faculty }) => {
    const rev = getUnifiedFacultyReview({ employeeId, name: faculty });
    if (!rev || rev.reviews <= 0) return null;
    return {
      wPct: rev.wPct,
      lecture: rev.metrics?.lecture ?? (rev.teachingGrade || null),
      da: rev.metrics?.da ?? null,
      vibe: rev.metrics?.vibe ?? null,
      reviews: rev.reviews,
    };
  });

  return { available: Object.keys(ratings).length > 0, ratings };
}

/**
 * Client-visible allowlist for review moderation UI. This is only a UI gate —
 * the API's RBAC check is the actual authority. Provide real admin register
 * numbers/usernames, comma-separated.
 * Example: NEXT_PUBLIC_REVIEW_ADMIN_IDS=25BCE1001,staff01
 */
function parseAdminIds(): Set<string> {
  return new Set(
    (process.env.NEXT_PUBLIC_REVIEW_ADMIN_IDS || "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
  );
}

export const REVIEW_ADMIN_IDS = typeof process !== "undefined" ? parseAdminIds() : new Set<string>([]);

export function isCurrentUserReviewAdmin(): boolean {
  if (typeof window === "undefined") return false;
  if (REVIEW_ADMIN_IDS.size === 0) return false;
  const authId = getStudentAuthorizedId();
  return Boolean(authId) && REVIEW_ADMIN_IDS.has(authId.toUpperCase());
}
/**
 * Retrieves the current student's authorized ID for verified review authentication.
 * Returns "" when the student is not signed in / not cached — callers must treat
 * an empty result as unauthenticated and skip review requests entirely. It must
 * never fall back to a hardcoded ID: those would submit/eligibility-check as a
 * real (other) student and would contaminate verified reviews.
 */
export function getStudentAuthorizedId(): string {
  if (typeof window === "undefined") return "";
  try {
    // 1. Explicit profile register number
    const profileRaw = localStorage.getItem("profile");
    if (profileRaw) {
      const p = JSON.parse(profileRaw);
      if (p.registerNo && String(p.registerNo).trim()) {
        return String(p.registerNo).trim();
      }
    }
    // 2. Cache payments register number
    const paymentsRaw = localStorage.getItem("cache_payments");
    if (paymentsRaw) {
      const pm = JSON.parse(paymentsRaw);
      if (pm.studentInfo?.registerNo && String(pm.studentInfo.registerNo).trim()) {
        return String(pm.studentInfo.registerNo).trim();
      }
    }
    // 3. Raw authorizedID / VTOP username (plain value, no translation)
    const raw = localStorage.getItem("authorizedID");
    if (raw && raw.trim()) {
      return raw.trim();
    }
    const ids = JSON.parse(localStorage.getItem("IDs") || "{}");
    if (ids.authorizedID && String(ids.authorizedID).trim()) {
      return String(ids.authorizedID).trim();
    }
    if (ids.VtopUsername && String(ids.VtopUsername).trim()) {
      return String(ids.VtopUsername).trim();
    }
  } catch {}
  return "";
}
