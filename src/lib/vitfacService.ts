"use client";

import { useEffect, useState } from "react";
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
  vitfac_id?: string | null;
  vitfacId?: string | null;
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
 */
export const ENABLE_VITFAC_INTEGRATION = true;

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

export function resetVitfacCatalogForTesting() {
  catalogPromise = null;
  byEmployeeId = new Map();
  byNormalizedName = new Map();
  isCatalogLoaded = false;
  try {
    safeSessionStorage.removeItem(VITFAC_CACHE_KEY);
    safeSessionStorage.removeItem(VITFAC_CACHE_TIMESTAMP_KEY);
  } catch {}
}

function indexCatalog(list: VitfacFaculty[]) {
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
  if (!ENABLE_VITFAC_INTEGRATION) {
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
  if (!ENABLE_VITFAC_INTEGRATION) return null;

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
  if (!ENABLE_VITFAC_INTEGRATION) return { available: false, ratings: {} };
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
 * Target descriptor for resolving vitfac profiles.
 */
export type VitfacProfileTarget =
  | string
  | {
      employeeId?: string | null;
      vitfac_id?: string | null;
      vitfacId?: string | null;
      name?: string | null;
      id?: string | null;
    }
  | null
  | undefined;

/**
 * Validates if a string is a valid base64 vitfac employee id.
 */
export function isValidVitfacBase64(str: string): boolean {
  if (!str || typeof str !== "string") return false;
  const clean = str.trim();
  if (clean.includes("-") || clean.length > 32) return false;
  if (!/^[A-Za-z0-9+/=]+$/.test(clean)) return false;
  const decoded = decodeVitfacId(clean);
  return /^\d+$/.test(decoded);
}

/**
 * Resolves a faculty target to their valid vitfac base64 profile id.
 * Guaranteed to NEVER return internal database UUIDs.
 */
export function resolveVitfacId(target?: VitfacProfileTarget): string | null {
  if (!target) return null;

  let empId: string | null = null;
  let b64Id: string | null = null;

  if (typeof target === "object") {
    const rawEmp = target.employeeId ? String(target.employeeId).trim() : "";
    if (/^\d+$/.test(rawEmp)) {
      empId = rawEmp;
    }

    const rawVitfac = (target.vitfac_id || target.vitfacId || "").trim();
    if (!empId && rawVitfac && isValidVitfacBase64(rawVitfac)) {
      b64Id = rawVitfac;
    }

    if (!empId && !b64Id && target.name) {
      const match = getFacultyReview({ name: target.name });
      if (match?.employeeId && /^\d+$/.test(match.employeeId.trim())) {
        empId = match.employeeId.trim();
      } else if (match?.id && isValidVitfacBase64(match.id)) {
        b64Id = match.id.trim();
      }
    }

    if (!empId && !b64Id && target.id) {
      const cleanId = String(target.id).trim();
      if (/^\d+$/.test(cleanId)) {
        empId = cleanId;
      } else if (isValidVitfacBase64(cleanId)) {
        b64Id = cleanId;
      } else {
        const match = getFacultyReview({ employeeId: cleanId });
        if (match?.employeeId && /^\d+$/.test(match.employeeId.trim())) {
          empId = match.employeeId.trim();
        } else if (match?.id && isValidVitfacBase64(match.id)) {
          b64Id = match.id.trim();
        }
      }
    }
  } else if (typeof target === "string") {
    const trimmed = target.trim();
    if (!trimmed) return null;

    if (/^\d+$/.test(trimmed)) {
      empId = trimmed;
    } else if (isValidVitfacBase64(trimmed)) {
      b64Id = trimmed;
    } else if (trimmed.includes("-") || /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(trimmed)) {
      const match = getFacultyReview({ employeeId: trimmed });
      if (match?.employeeId && /^\d+$/.test(match.employeeId.trim())) {
        empId = match.employeeId.trim();
      } else if (match?.id && isValidVitfacBase64(match.id)) {
        b64Id = match.id.trim();
      }
    } else {
      const match = getFacultyReview({ name: trimmed });
      if (match?.employeeId && /^\d+$/.test(match.employeeId.trim())) {
        empId = match.employeeId.trim();
      } else if (match?.id && isValidVitfacBase64(match.id)) {
        b64Id = match.id.trim();
      }
    }
  }

  if (empId) {
    return encodeVitfacId(empId);
  }
  return b64Id;
}

/**
 * Fetch detailed profile bundle for a specific professor.
 */
export async function getFacultyProfileBundle(
  idOrEmpIdOrTarget: VitfacProfileTarget
): Promise<VitfacProfileBundle | null> {
  if (!ENABLE_VITFAC_INTEGRATION || !idOrEmpIdOrTarget) return null;

  const b64Id = resolveVitfacId(idOrEmpIdOrTarget);
  if (!b64Id) return null;

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
 * Guaranteed to NEVER output raw database UUIDs.
 */
export function getVitfacProfileUrl(target?: VitfacProfileTarget): string {
  const b64 = resolveVitfacId(target);
  if (!b64) return "https://vitfac.pages.dev";
  return `https://vitfac.pages.dev/profile?id=${encodeURIComponent(b64)}`;
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
  rosterLoaded = list.length > 0;
  rosterListeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

export async function loadFacultyRoster(): Promise<FacultyRosterEntry[]> {
  if (!ENABLE_VITFAC_INTEGRATION) return [];

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
  if (!ENABLE_VITFAC_INTEGRATION) return [];
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
  if (!ENABLE_VITFAC_INTEGRATION) return null;

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
  const [profile, setProfile] = useState<FacultyDirectoryProfile | null>(() => (employeeId ? null : null));
  const [loading, setLoading] = useState<boolean>(!!employeeId);

  useEffect(() => {
    if (!ENABLE_VITFAC_INTEGRATION || !employeeId) {
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
  }, [employeeId]);

  return { profile, loading };
}

/**
 * React hook to access a faculty's vitfac review in components with auto-updating.
 */
export function useVitfacReview(employeeId?: string | null, name?: string | null) {
  const [review, setReview] = useState<VitfacFaculty | null>(() =>
    ENABLE_VITFAC_INTEGRATION ? getFacultyReview({ employeeId, name }) : null,
  );
  const [loading, setLoading] = useState<boolean>(ENABLE_VITFAC_INTEGRATION ? !isCatalogLoaded : false);

  useEffect(() => {
    if (!ENABLE_VITFAC_INTEGRATION) return;
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
  }, [employeeId, name]);

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

export function useChennaiImage(employeeId?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!employeeId) return null;
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
    if (!employeeId) {
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
        // Prefer an already-resolved imageUrl from the worker roster.
        if (entry?.imageUrl) {
          if (cancelled) return;
          setUrl(entry.imageUrl);
          try {
            safeSessionStorage.setItem(
              CHENNAI_IMG_URL_PREFIX + employeeId,
              JSON.stringify({ v: entry.imageUrl, t: Date.now() }),
            );
          } catch {}
          return;
        }
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
        const res = await fetch(`https://chennai.vit.ac.in/wp-json/wp/v2/media/${fm}`);
        if (!res.ok) {
          try {
            safeSessionStorage.setItem(
              CHENNAI_IMG_URL_PREFIX + employeeId,
              JSON.stringify({ v: "__none__", t: Date.now() }),
            );
          } catch {}
          return;
        }
        const data = await res.json();
        const src = data?.source_url || data?.guid?.rendered || null;
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
  }, [employeeId]);

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
