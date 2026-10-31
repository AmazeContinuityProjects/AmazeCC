"use client";

import { useEffect, useState } from "react";
import { safeSessionStorage } from "./ffcsGeneratorSessionPrefs";
import type { ParsedCourse } from "@/components/custom/exams/FFCS/types";
import {
  buildFacultyRatingLookup,
  type FacultyRatingLookup,
} from "@/lib/ffcsFacultyRanking";

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

/**
 * Master killswitch to enable or disable the entire vitfac integration.
 * Set to `false` to instantly turn off all network calls, review pills, and modals across the application.
 */
export const ENABLE_VITFAC_INTEGRATION = true;

export const VITFAC_WORKER_BASE = "https://vitfac.amazecc.com";
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
export function getFacultyReview(params: {
  employeeId?: string | null;
  name?: string | null;
}): VitfacFaculty | null {
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
  courses: readonly ParsedCourse[]
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

/**
 * React hook to access a faculty's vitfac review in components with auto-updating.
 */
export function useVitfacReview(employeeId?: string | null, name?: string | null) {
  const [review, setReview] = useState<VitfacFaculty | null>(() =>
    ENABLE_VITFAC_INTEGRATION ? getFacultyReview({ employeeId, name }) : null
  );
  const [loading, setLoading] = useState<boolean>(
    ENABLE_VITFAC_INTEGRATION ? !isCatalogLoaded : false
  );

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