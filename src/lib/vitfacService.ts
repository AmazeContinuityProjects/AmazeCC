"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { safeSessionStorage } from "./ffcsGeneratorSessionPrefs";
import type { ParsedCourse } from "@/components/custom/exams/FFCS/types";
import { buildFacultyRatingLookup, type FacultyRatingLookup } from "@/lib/ffcsFacultyRanking";

export interface VitfacLoreItem {
  text: string;
  count: number;
}

export interface VitfacMetrics {
  lecture: number;
  da: number;
  vibe: number;
}

export interface VitfacFaculty {
  id: string; // Base64 encoded employeeId e.g. "MTAwOTA="
  employeeId?: string; // Decoded employeeId e.g. "10090"
  name: string;
  designation?: string;
  dept?: string;
  courses?: string[];
  wPct: number; // 0 - 100
  reviews: number;
  wCount: number;
  lCount: number;
  metrics?: VitfacMetrics;
  lore?: {
    green?: VitfacLoreItem[];
    red?: VitfacLoreItem[];
  };
  image_url?: string | null;
  avatar?: string;
  image?: string | null; // base64 or URL from directorycc
  email?: string | null;
  intercom?: string | null;
  profileUrl?: string | null;
  researchArea?: string[];
  areasOfSpecialization?: string[];
  links?: { orcid?: string; scopus?: string; googleScholar?: string; linkedin?: string } | null;
  education?: any[];
  publications?: any[];
  awards?: string[];
  hIndexScopus?: number | null;
  i10Index?: number | null;
  directoryAvailable?: boolean;
  vitfacAvailable?: boolean;
}

export interface VitfacProfileBundle {
  prof: VitfacFaculty;
  courseStats?: {
    global?: {
      reviews: number;
      wPct: number;
      metrics?: VitfacMetrics;
      lore?: {
        green?: VitfacLoreItem[];
        red?: VitfacLoreItem[];
      };
    };
    courses?: {
      code: string;
      name?: string;
      reviews: number;
      wPct: number;
      metrics?: VitfacMetrics;
      lore?: {
        green?: VitfacLoreItem[];
        red?: VitfacLoreItem[];
      };
    }[];
  };
}

export interface FacultyRosterEntry {
  employeeId: string;
  name: string;
  school: string;
  wpId?: number;
  slug?: string;
  profileUrl?: string;
  wpUrl?: string;
  featuredMedia?: number | null;
  imageUrl?: string | null;
}

export interface FacultyDirectoryProfile {
  employeeId: string;
  name: string | null;
  designation: string | null;
  dept: string | null;
  campus: string | null;
  schoolPage: string | null;
  image: string | null;
  imageUrl: string | null;
  email: string | null;
  intercom: string | null;
  phd: string | null;
  researchArea: string[];
  areasOfSpecialization: string[];
  links: { orcid?: string; scopus?: string; googleScholar?: string; linkedin?: string } | null;
  education: any[];
  publications: any[];
  awards: string[];
  hIndexScopus: number | null;
  i10Index: number | null;
  directoryAvailable: boolean;
  vitfacAvailable: boolean;
  wPct: number;
  reviews: number;
  wCount: number;
  lCount: number;
  metrics: VitfacMetrics | null;
  lore: { green?: VitfacLoreItem[]; red?: VitfacLoreItem[] } | null;
  courses: string[];
}

/**
 * Master killswitch to enable or disable the entire vitfac integration.
 * Set to `false` to instantly turn off all network calls, review pills, and modals across the application.
 *
 * This is the *build-time* switch. Students flip the same integration from
 * Planner Settings at runtime through {@link setVitfacIntegrationEnabled};
 * every gate in this file checks both via {@link isVitfacIntegrationEnabled}.
 */
export const ENABLE_VITFAC_INTEGRATION = true;

/**
 * The student's runtime preference, persisted beside the planner's other
 * settings (localStorage, not the settings record itself: this module is the
 * only thing that reads it, and it must be correct at import time — long
 * before `useFFCSSettings` hydrates — so no screen can paint vitfac data on a
 * visit where the student turned it off).
 */
const VITFAC_ENABLED_KEY = "ffcs_vitfac_enabled";

function readVitfacEnabled(): boolean {
  try {
    const raw = globalThis.localStorage?.getItem(VITFAC_ENABLED_KEY);
    if (raw === "false") return false;
    if (raw === "true") return true;
  } catch {
    // Storage unavailable (private mode, SSR) — integration stays on.
  }
  return true;
}

let vitfacEnabled = readVitfacEnabled();
const enableListeners = new Set<() => void>();

/** Both switches: built into this app *and* switched on by the student. */
export function isVitfacIntegrationEnabled(): boolean {
  return ENABLE_VITFAC_INTEGRATION && vitfacEnabled;
}

/**
 * Turn the integration on or off at runtime (Planner Settings → Faculty
 * filters), notifying every hook that renders vitfac state.
 *
 * Disabling drops the in-memory catalog and roster indexes so *nothing* can
 * resolve a review while off — including work already in flight when the
 * toggle flipped (see the guard in `indexCatalog`). The sessionStorage
 * caches are deliberately left alone: they are data at rest, no request
 * happens to keep them, and re-enabling re-indexes them instantly instead of
 * paying for a fresh download.
 */
export function setVitfacIntegrationEnabled(enabled: boolean): void {
  if (enabled === vitfacEnabled) return;
  vitfacEnabled = enabled;
  try {
    globalThis.localStorage?.setItem(VITFAC_ENABLED_KEY, String(enabled));
  } catch {
    // Preference simply won't persist; the live value still applies.
  }
  if (!enabled) {
    byEmployeeId = new Map();
    byNormalizedName = new Map();
    isCatalogLoaded = false;
    catalogPromise = null;
    rosterLoaded = false;
    rosterPromise = null;
  }
  // Review hooks re-derive their null state from these two notifications.
  notifyListeners();
  enableListeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

/** Server snapshot: the build switch's answer, before any local preference. */
const VITFAC_ENABLED_SSR = () => true;

/** Live subscription to {@link isVitfacIntegrationEnabled} for components. */
export function useVitfacEnabled(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      enableListeners.add(onChange);
      return () => {
        enableListeners.delete(onChange);
      };
    },
    isVitfacIntegrationEnabled,
    VITFAC_ENABLED_SSR,
  );
}

export const VITFAC_WORKER_BASE = "https://cache.amazecc.com";
export const CACHE_BASE = VITFAC_WORKER_BASE;
const VITFAC_CACHE_KEY = "vitfac_faculty_catalog_v1";
const VITFAC_CACHE_TIMESTAMP_KEY = "vitfac_faculty_catalog_ts_v1";
const CATALOG_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function decodeVitfacId(base64Id: string): string {
  try {
    if (typeof atob === "function") {
      return atob(base64Id).trim();
    }
    if (typeof Buffer !== "undefined") {
      return Buffer.from(base64Id, "base64").toString("utf-8").trim();
    }
  } catch {
    // If decoding fails, return as-is
  }
  return base64Id;
}

export function encodeVitfacId(empId: string): string {
  const clean = empId.trim();
  try {
    if (typeof btoa === "function") {
      return btoa(clean);
    }
    if (typeof Buffer !== "undefined") {
      return Buffer.from(clean, "utf-8").toString("base64");
    }
  } catch {
    // fallback
  }
  return clean;
}

export function normalizeFacultyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(dr|prof|mr|mrs|ms)\.?\s+/i, "")
    .replace(/[^a-z0-9]/g, "");
}

// In-memory catalog indices
let catalogPromise: Promise<Map<string, VitfacFaculty>> | null = null;
let byEmployeeId = new Map<string, VitfacFaculty>();
let byNormalizedName = new Map<string, VitfacFaculty>();
let isCatalogLoaded = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

function indexCatalog(list: VitfacFaculty[]) {
  // A fetch that started before the student switched vitfac off must not
  // repopulate the indexes the switch just cleared.
  if (!isVitfacIntegrationEnabled()) return new Map();

  const empMap = new Map<string, VitfacFaculty>();
  const nameMap = new Map<string, VitfacFaculty>();

  for (const item of list) {
    const decodedEmpId = decodeVitfacId(item.id);
    const enriched: VitfacFaculty = {
      ...item,
      employeeId: decodedEmpId,
    };

    if (decodedEmpId) {
      empMap.set(decodedEmpId, enriched);
    }
    if (item.id) {
      empMap.set(item.id, enriched);
    }

    if (item.name) {
      const norm = normalizeFacultyName(item.name);
      if (norm && !nameMap.has(norm)) {
        nameMap.set(norm, enriched);
      }
    }
  }

  byEmployeeId = empMap;
  byNormalizedName = nameMap;
  isCatalogLoaded = true;
  notifyListeners();
  return empMap;
}

/**
 * Load the faculty review catalog from the worker.
 */
export async function loadVitfacCatalog(): Promise<Map<string, VitfacFaculty>> {
  if (!isVitfacIntegrationEnabled()) {
    return new Map();
  }

  if (isCatalogLoaded && byEmployeeId.size > 0) {
    return byEmployeeId;
  }

  if (catalogPromise) {
    return catalogPromise;
  }

  catalogPromise = (async () => {
    // 1. Try reading from safeSessionStorage
    try {
      const cached = safeSessionStorage.getItem(VITFAC_CACHE_KEY);
      const ts = safeSessionStorage.getItem(VITFAC_CACHE_TIMESTAMP_KEY);
      if (cached && ts) {
        const age = Date.now() - parseInt(ts, 10);
        if (age < CATALOG_TTL_MS) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return indexCatalog(parsed);
          }
        }
      }
    } catch {
      // Fall through to network
    }

    // 2. Fetch from worker
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(`${VITFAC_WORKER_BASE}/faculty`, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`Vitfac catalog returned HTTP ${res.status}`);
      }
      const json = await res.json();
      const list: VitfacFaculty[] = json?.data?.faculty || [];
      if (Array.isArray(list) && list.length > 0) {
        try {
          safeSessionStorage.setItem(VITFAC_CACHE_KEY, JSON.stringify(list));
          safeSessionStorage.setItem(VITFAC_CACHE_TIMESTAMP_KEY, String(Date.now()));
        } catch {
          // ignore storage quota errors
        }
        return indexCatalog(list);
      }
    } catch (err) {
      console.warn("Failed to fetch vitfac faculty catalog:", err);
    } finally {
      clearTimeout(timeout);
    }

    return byEmployeeId;
  })();

  return catalogPromise;
}

/**
 * Synchronous lookup from memory index.
 */
export function getFacultyReview(params: { employeeId?: string | null; name?: string | null }): VitfacFaculty | null {
  if (!isVitfacIntegrationEnabled()) return null;

  if (!isCatalogLoaded) {
    loadVitfacCatalog().catch(() => {});
  }

  const { employeeId, name } = params;

  if (employeeId) {
    const cleanId = String(employeeId).trim();
    if (byEmployeeId.has(cleanId)) {
      return byEmployeeId.get(cleanId)!;
    }
    const b64 = encodeVitfacId(cleanId);
    if (byEmployeeId.has(b64)) {
      return byEmployeeId.get(b64)!;
    }
  }

  if (name) {
    const norm = normalizeFacultyName(name);
    if (byNormalizedName.has(norm)) {
      return byNormalizedName.get(norm)!;
    }
  }

  return null;
}

/**
 * Load the catalog once and prepare the selected report's ratings for the
 * worker. The return value is plain structured-cloneable data; when Vitfac is
 * disabled or unavailable, an empty lookup leaves schedule ranking untouched.
 */
export async function loadVitfacRankingData(
  courses: readonly ParsedCourse[],
): Promise<{ available: boolean; ratings: FacultyRatingLookup }> {
  if (!isVitfacIntegrationEnabled()) return { available: false, ratings: {} };
  const catalog = await loadVitfacCatalog();
  const ratings = buildFacultyRatingLookup(courses, ({ employeeId, faculty }) => {
    const review = getFacultyReview({ employeeId, name: faculty });
    if (!review || review.reviews <= 0) return null;
    return {
      wPct: review.wPct,
      lecture: review.metrics?.lecture ?? null,
      da: review.metrics?.da ?? null,
      vibe: review.metrics?.vibe ?? null,
      reviews: review.reviews,
    };
  });
  return { available: catalog.size > 0, ratings };
}

/**
 * Update or enrich a faculty entry in the in-memory catalog with live stats.
 */
export function updateFacultyInCatalog(updatedProf: VitfacFaculty) {
  const decodedEmpId = updatedProf.employeeId || decodeVitfacId(updatedProf.id);
  const enriched: VitfacFaculty = {
    ...updatedProf,
    employeeId: decodedEmpId,
  };
  if (decodedEmpId) byEmployeeId.set(decodedEmpId, enriched);
  if (updatedProf.id) byEmployeeId.set(updatedProf.id, enriched);
  if (updatedProf.name) {
    const norm = normalizeFacultyName(updatedProf.name);
    if (norm) byNormalizedName.set(norm, enriched);
  }
  notifyListeners();
}

/**
 * Fetch detailed profile bundle for a specific professor.
 */
export async function getFacultyProfileBundle(idOrEmpId: string): Promise<VitfacProfileBundle | null> {
  if (!isVitfacIntegrationEnabled()) return null;

  const b64Id = /^[0-9]+$/.test(idOrEmpId.trim()) ? encodeVitfacId(idOrEmpId.trim()) : idOrEmpId.trim();

  try {
    const res = await fetch(`${VITFAC_WORKER_BASE}/profile/${encodeURIComponent(b64Id)}`);
    if (!res.ok) return null;
    const json = await res.json();
    const bundle: VitfacProfileBundle | null = json?.data || null;

    if (bundle && bundle.prof) {
      const global = bundle.courseStats?.global;
      if (global) {
        if (typeof global.wPct === "number") bundle.prof.wPct = Math.round(global.wPct);
        if (typeof global.reviews === "number") bundle.prof.reviews = global.reviews;
        if (global.metrics) bundle.prof.metrics = global.metrics;
        if (global.lore) bundle.prof.lore = global.lore;
      }
      updateFacultyInCatalog(bundle.prof);
    }

    return bundle;
  } catch (err) {
    console.warn("Failed to fetch vitfac profile bundle:", err);
    return null;
  }
}

/**
 * Generates external profile URL to vitfac.pages.dev.
 */
export function getVitfacProfileUrl(idOrEmpId: string): string {
  const b64Id = /^[0-9]+$/.test(idOrEmpId.trim()) ? encodeVitfacId(idOrEmpId.trim()) : idOrEmpId.trim();
  return `https://vitfac.pages.dev/profile?id=${encodeURIComponent(b64Id)}`;
}

// ---------- cache.amazecc.com : VIT faculty roster + directory profiles ----------

const ROSTER_CACHE_KEY = "amazecc_faculty_roster_v1";
const ROSTER_CACHE_TS_KEY = "amazecc_faculty_roster_ts_v1";
const ROSTER_TTL_MS = 24 * 60 * 60 * 1000; // 24h — roster changes rarely

let rosterPromise: Promise<FacultyRosterEntry[]> | null = null;
let rosterLoaded = false;
const rosterListeners = new Set<() => void>();

function indexRoster(list: FacultyRosterEntry[]) {
  // roster is consumed as a list; nothing to index here beyond the cache.
  // Same in-flight rule as `indexCatalog`: off means nothing lands in memory.
  if (!isVitfacIntegrationEnabled()) return;
  rosterLoaded = list.length > 0;
  rosterListeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

export async function loadFacultyRoster(): Promise<FacultyRosterEntry[]> {
  if (!isVitfacIntegrationEnabled()) return [];

  if (rosterLoaded) {
    try {
      const cached = safeSessionStorage.getItem(ROSTER_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed as FacultyRosterEntry[];
      }
    } catch {}
  }

  if (rosterPromise) return rosterPromise;

  rosterPromise = (async () => {
    // The static roster (generated by scripts/fetch-vit-faculty.mjs, shipped in
    // public/data/vit-faculty/roster.json) is the complete, reliable floor:
    // chennai.vit.ac.in blocks Cloudflare's edge for several schools, so the
    // worker's live roster is only a partial subset. Load the static file
    // first so the UI never waits on the network and never shrinks.
    let base: FacultyRosterEntry[] = [];
    try {
      const res = await fetch("/data/vit-faculty/roster.json");
      if (res.ok) {
        const list = (await res.json()) as FacultyRosterEntry[];
        if (Array.isArray(list) && list.length > 0) {
          const seen = new Set<string>();
          base = list.filter((e) => {
            if (seen.has(e.employeeId)) return false;
            seen.add(e.employeeId);
            return true;
          });
        }
      }
    } catch {}

    // Best-effort enhancement: merge in whatever the worker managed to fetch
    // (freshness + any entries the static file lacks). Worker entries win on
    // conflict; the static floor is never lost.
    let merged = base;
    try {
      const cached = safeSessionStorage.getItem(ROSTER_CACHE_KEY);
      const ts = safeSessionStorage.getItem(ROSTER_CACHE_TS_KEY);
      const fresh = !cached || !ts || Date.now() - parseInt(ts, 10) < ROSTER_TTL_MS;
      let workerList: FacultyRosterEntry[] | null = null;
      if (fresh && cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) workerList = parsed as FacultyRosterEntry[];
        } catch {}
      }
      if (!workerList) {
        const res = await fetch(`${VITFAC_WORKER_BASE}/faculty/roster`);
        if (res.ok) {
          const json = await res.json();
          const list: FacultyRosterEntry[] = json?.data?.faculty || [];
          if (Array.isArray(list) && list.length > 0) {
            workerList = list;
            try {
              safeSessionStorage.setItem(ROSTER_CACHE_KEY, JSON.stringify(list));
              safeSessionStorage.setItem(ROSTER_CACHE_TS_KEY, String(Date.now()));
            } catch {}
          }
        }
      }
      if (workerList && workerList.length > 0) {
        const byId = new Map<string, FacultyRosterEntry>();
        for (const e of base) byId.set(e.employeeId, e);
        for (const e of workerList) byId.set(e.employeeId, e); // worker overrides
        merged = Array.from(byId.values());
      }
    } catch (err) {
      console.warn("Faculty roster worker enhancement failed (static floor kept):", err);
    }

    if (merged.length > 0) {
      indexRoster(merged);
      return merged;
    }
    return [];
  })();

  return rosterPromise;
}

export async function searchFacultyDirectory(params: {
  q?: string | null;
  school?: string | null;
}): Promise<FacultyRosterEntry[]> {
  if (!isVitfacIntegrationEnabled()) return [];
  const roster = await loadFacultyRoster();
  const q = (params.q || "").toLowerCase().trim();
  const school = (params.school || "").toLowerCase().trim();
  return roster.filter((r) => {
    if (school && r.school.toLowerCase() !== school) return false;
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) || r.employeeId.toLowerCase().includes(q) || r.school.toLowerCase().includes(q)
    );
  });
}

export async function getFacultyDirectoryProfile(idOrEmpId: string): Promise<FacultyDirectoryProfile | null> {
  if (!isVitfacIntegrationEnabled()) return null;

  const empId = idOrEmpId.trim();
  const b64Id = /^[0-9]+$/.test(empId) ? encodeVitfacId(empId) : empId;

  // sessionStorage cache first
  const cacheKey = `amazecc_dir_profile_${empId}`;
  const DIR_PROFILE_TTL_MS = 24 * 60 * 60 * 1000;
  try {
    const cached = safeSessionStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      // New format: { v, t }. Old format (bare profile) is treated as expired.
      if (
        parsed &&
        parsed.v &&
        parsed.v.employeeId &&
        typeof parsed.t === "number" &&
        Date.now() - parsed.t < DIR_PROFILE_TTL_MS
      ) {
        return parsed.v as FacultyDirectoryProfile;
      }
      if (parsed && parsed.employeeId && !parsed.v) {
        // Legacy bare profile: accept once, then re-wrap on next fetch.
        return parsed as FacultyDirectoryProfile;
      }
    }
  } catch {}

  // worker
  try {
    const res = await fetch(`${VITFAC_WORKER_BASE}/faculty/profile/${encodeURIComponent(b64Id)}`);
    if (res.ok) {
      const json = await res.json();
      const bundle = json?.data;
      const prof = bundle?.prof || bundle;
      const dir = bundle?.directory;
      if (prof || dir) {
        const profile: FacultyDirectoryProfile = {
          employeeId: dir?.employeeId || prof?.employeeId || empId,
          name: dir?.name || prof?.name || null,
          designation: dir?.designation || prof?.designation || null,
          dept: prof?.dept || null,
          campus: prof?.campus || null,
          schoolPage: prof?.schoolPage || null,
          image: dir?.image || prof?.image || null,
          imageUrl: prof?.image_url || prof?.imageUrl || null,
          email: dir?.email || null,
          intercom: dir?.intercom || null,
          phd: dir?.phd || null,
          researchArea: dir?.researchArea || [],
          areasOfSpecialization: dir?.areasOfSpecialization || [],
          links: dir?.links || null,
          education: dir?.education || [],
          publications: dir?.publications || [],
          awards: dir?.awards || [],
          hIndexScopus: dir?.metrics?.hIndexScopus ?? dir?.hIndexScopus ?? null,
          i10Index: dir?.metrics?.i10Index ?? dir?.i10Index ?? null,
          directoryAvailable: dir?.available ?? !!dir,
          vitfacAvailable: prof?.vitfacAvailable ?? true,
          wPct: prof?.wPct ?? 0,
          reviews: prof?.reviews ?? 0,
          wCount: prof?.wCount ?? 0,
          lCount: prof?.lCount ?? 0,
          metrics: prof?.metrics || prof?.vitfacMetrics || null,
          lore: prof?.lore || null,
          courses: prof?.courses || [],
        };
        try {
          safeSessionStorage.setItem(cacheKey, JSON.stringify({ v: profile, t: Date.now() }));
        } catch {}
        // also enrich the in-memory vitfac catalog entry if present
        if (prof?.name) {
          updateFacultyInCatalog({
            id: prof.id || encodeVitfacId(empId),
            employeeId: empId,
            name: prof.name,
            designation: profile.designation || undefined,
            dept: profile.dept || undefined,
            image_url: profile.imageUrl || undefined,
            image: profile.image || undefined,
            email: profile.email || undefined,
            intercom: profile.intercom || undefined,
            links: profile.links || undefined,
            researchArea: profile.researchArea,
            areasOfSpecialization: profile.areasOfSpecialization,
            wPct: profile.wPct,
            reviews: profile.reviews,
            wCount: profile.wCount,
            lCount: profile.lCount,
            metrics: profile.metrics || undefined,
            lore: profile.lore || undefined,
            courses: profile.courses,
          } as any);
        }
        return profile;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch directory profile from cache worker:", err);
  }

  return null;
}

export function useVitfacDirectoryProfile(employeeId?: string | null) {
  const enabled = useVitfacEnabled();
  const [profile, setProfile] = useState<FacultyDirectoryProfile | null>(() => (employeeId ? null : null));
  const [loading, setLoading] = useState<boolean>(!!employeeId);

  useEffect(() => {
    if (!enabled || !employeeId) {
      // Off means *nothing* vitfac stays on screen, including a profile a
      // previous render already fetched.
      setProfile(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    getFacultyDirectoryProfile(employeeId)
      .then((p) => {
        if (active) setProfile(p);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [employeeId, enabled]);

  return { profile, loading };
}

/**
 * React hook to access a faculty's vitfac review in components with auto-updating.
 */
export function useVitfacReview(employeeId?: string | null, name?: string | null) {
  const enabled = useVitfacEnabled();
  const [review, setReview] = useState<VitfacFaculty | null>(() =>
    isVitfacIntegrationEnabled() ? getFacultyReview({ employeeId, name }) : null,
  );
  const [loading, setLoading] = useState<boolean>(isVitfacIntegrationEnabled() ? !isCatalogLoaded : false);

  useEffect(() => {
    // Reacting to `enabled` is what makes the settings toggle clear review
    // pills already on screen without remounting the components showing them.
    if (!enabled) {
      setReview(null);
      setLoading(false);
      return;
    }
    let active = true;

    const update = () => {
      if (!active) return;
      const found = getFacultyReview({ employeeId, name });
      setReview(found);
      setLoading(false);
    };

    update();

    if (!isCatalogLoaded) {
      listeners.add(update);
      loadVitfacCatalog().finally(() => {
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
  }, [employeeId, name, enabled]);

  return { review, loading };
}

// ---------- local image cache for non-local faculty pics ----------
//
// Faculty photos arrive from non-local space (vitfac image_url, directorycc
// base64). Once one has been fetched we keep a copy in sessionStorage so the
// next render (and the next visit) is instant and does not hit the network
// again. Base64 payloads are stored as-is; external URLs are fetched once,
// converted to a data URL, and cached. Entries larger than the size cap are
// skipped, and quota failures evict the whole namespace and retry once.

const IMG_CACHE_PREFIX = "amazecc_img_";
const IMG_CACHE_MAX_BYTES = 60 * 1024; // 60 KB per image
const IMG_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function useCachedImage(url: string | null | undefined): string | null {
  const [src, setSrc] = useState<string | null>(url || null);

  useEffect(() => {
    if (!url) {
      setSrc(null);
      return;
    }
    if (url.startsWith("data:")) {
      setSrc(url);
      return;
    }

    let cancelled = false;

    // 1. Serve from local cache if present (with TTL).
    try {
      const key = IMG_CACHE_PREFIX + url;
      const cached = safeSessionStorage.getItem(key);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === "object" && "d" in parsed) {
            if (Date.now() - (parsed.t || 0) < IMG_CACHE_TTL_MS) {
              if (!cancelled) setSrc(parsed.d);
              return;
            }
            // expired — fall through and refetch
          } else {
            // legacy bare dataUrl — treat as expired
          }
        } catch {
          // legacy bare dataUrl — treat as expired
        }
      }
    } catch {}

    // 2. Fetch once, cache, then swap the src in.
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const blob = await res.blob();
        if (blob.size > IMG_CACHE_MAX_BYTES) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          if (cancelled) return;
          const dataUrl = reader.result as string;
          if (!dataUrl) return;
          setSrc(dataUrl);
          try {
            safeSessionStorage.setItem(IMG_CACHE_PREFIX + url, JSON.stringify({ d: dataUrl, t: Date.now() }));
          } catch {
            // Quota exceeded: drop the whole image namespace and retry once.
            try {
              Object.keys(sessionStorage)
                .filter((k) => k.startsWith(IMG_CACHE_PREFIX))
                .forEach((k) => sessionStorage.removeItem(k));
              safeSessionStorage.setItem(IMG_CACHE_PREFIX + url, JSON.stringify({ d: dataUrl, t: Date.now() }));
            } catch {}
          }
        };
        reader.readAsDataURL(blob);
      } catch {
        // leave src as the original url (browser fetches directly)
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return src;
}

// ---------- chennai.vit.ac.in faculty images ----------
//
// The WP media endpoint for a faculty member's featured_media returns a
// source_url pointing at their photo. Resolved lazily per employee id and
// cached in sessionStorage so the lookup happens once per faculty, ever.

const CHENNAI_IMG_URL_PREFIX = "chennai_img_url_";
const CHENNAI_IMG_URL_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days for a resolved URL
const CHENNAI_IMG_NONE_TTL_MS = 60 * 60 * 1000; // 1 hour for "no image" (retry transient failures)

/** The photo URL behind a WordPress media id, or null if it has none. */
function readMediaSrc(data: any): string | null {
  return data?.source_url || data?.guid?.rendered || null;
}

/**
 * Resolve a `featured_media` id to the faculty member's photo URL.
 *
 * Returns `null` when the lookup definitively says "no photo", and
 * `undefined` when it could not find out — the distinction matters because
 * only the former is worth caching as "no image".
 *
 * Images are fetched directly by AmazeCC itself (the browser) from
 * chennai.vit.ac.in — never routed through the cache worker. workerd's strict
 * TLS verification rejects VIT's incomplete certificate chain, so the worker
 * path silently lost photos; the browser repairs that chain via AIA fetching.
 */
async function resolveChennaiImageUrl(featuredMedia: number): Promise<string | null | undefined> {
  try {
    const res = await fetch(`https://chennai.vit.ac.in/wp-json/wp/v2/media/${featuredMedia}`);
    if (!res.ok) return null;
    return readMediaSrc(await res.json().catch(() => null));
  } catch {
    return undefined;
  }
}

export function useChennaiImage(employeeId?: string | null): string | null {
  const enabled = useVitfacEnabled();
  const [url, setUrl] = useState<string | null>(() => {
    if (!employeeId || !isVitfacIntegrationEnabled()) return null;
    try {
      const cached = safeSessionStorage.getItem(CHENNAI_IMG_URL_PREFIX + employeeId);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === "object" && "v" in parsed) {
            const ttl = parsed.v && parsed.v !== "__none__" ? CHENNAI_IMG_URL_TTL_MS : CHENNAI_IMG_NONE_TTL_MS;
            if (Date.now() - (parsed.t || 0) < ttl) return parsed.v === "__none__" ? null : parsed.v;
          }
        } catch {
          // legacy bare string — treated as expired
        }
      }
    } catch {}
    return null;
  });

  useEffect(() => {
    // Off: resolve nothing and write nothing — the roster below would be
    // empty anyway, and caching its "__none__" answer would suppress a real
    // photo for an hour after the student switches back on. The URL cache in
    // sessionStorage is left intact (data at rest) for that re-enable.
    if (!employeeId || !enabled) {
      setUrl(null);
      return;
    }
    try {
      const cached = safeSessionStorage.getItem(CHENNAI_IMG_URL_PREFIX + employeeId);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === "object" && "v" in parsed) {
            const ttl = parsed.v && parsed.v !== "__none__" ? CHENNAI_IMG_URL_TTL_MS : CHENNAI_IMG_NONE_TTL_MS;
            if (Date.now() - (parsed.t || 0) < ttl) {
              setUrl(parsed.v === "__none__" ? null : parsed.v);
              return;
            }
          }
        } catch {
          // legacy bare string — fall through and refetch
        }
      }
    } catch {}

    let cancelled = false;
    (async () => {
      try {
        const roster = await loadFacultyRoster();
        const entry = roster.find((r) => r.employeeId === employeeId);
        const fm = entry?.featuredMedia;
        if (!fm) {
          try {
            safeSessionStorage.setItem(
              CHENNAI_IMG_URL_PREFIX + employeeId,
              JSON.stringify({ v: "__none__", t: Date.now() }),
            );
          } catch {}
          return;
        }
        // Resolved by AmazeCC itself, directly from chennai.vit.ac.in (the
        // browser repairs VIT's incomplete certificate chain via AIA fetching).
        const src = await resolveChennaiImageUrl(fm);
        if (src === undefined) {
          // Neither path resolved. Cache "no image" briefly so a transient
          // failure does not retry on every render.
          try {
            safeSessionStorage.setItem(
              CHENNAI_IMG_URL_PREFIX + employeeId,
              JSON.stringify({ v: "__none__", t: Date.now() }),
            );
          } catch {}
          return;
        }
        if (cancelled) return;
        setUrl(src);
        try {
          safeSessionStorage.setItem(
            CHENNAI_IMG_URL_PREFIX + employeeId,
            JSON.stringify({ v: src || "__none__", t: Date.now() }),
          );
        } catch {}
      } catch {
        // network/TLS failure: leave uncached so it retries next load
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [employeeId, enabled]);

  return url;
}

/**
 * Drop every faculty-related entry from sessionStorage. Useful for a manual
 * "clear cache" action or when the worker's data has changed and a fresh fetch
 * is wanted before the natural TTL expiry.
 */
export function clearFacultyCache() {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith("amazecc_") || k.startsWith("vitfac_"))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {}
}
