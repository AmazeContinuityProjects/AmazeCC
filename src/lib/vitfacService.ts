"use client";

import { useEffect, useState } from "react";
import { safeSessionStorage } from "./ffcsGeneratorSessionPrefs";

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
 * Master killswitch to enable or disable the entire vitfac.pages.dev integration.
 * Set to `false` to instantly turn off all network calls, review pills, and modals across the application.
 */
export const ENABLE_VITFAC_INTEGRATION = true;

export const VITFAC_WORKER_BASE = "https://vitfac-cache.vit-fac.workers.dev";
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
 * Load the faculty review catalog from vitfac.
 * Uses sessionStorage if fresh (< 24h), otherwise fetches from Cloudflare Worker.
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

    // 2. Fetch from Cloudflare Worker
    try {
      const res = await fetch(`${VITFAC_WORKER_BASE}/faculty`);
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
    }

    return byEmployeeId;
  })();

  return catalogPromise;
}

/**
 * Synchronous lookup from memory index.
 * If catalog is not loaded yet, triggers background load automatically.
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
 * Harmonizes worker stats by prioritizing aggregated courseStats.global over stale table columns.
 */
export async function getFacultyProfileBundle(
  idOrEmpId: string
): Promise<VitfacProfileBundle | null> {
  if (!ENABLE_VITFAC_INTEGRATION) return null;

  const b64Id = /^[0-9]+$/.test(idOrEmpId.trim())
    ? encodeVitfacId(idOrEmpId.trim())
    : idOrEmpId.trim();

  try {
    const res = await fetch(`${VITFAC_WORKER_BASE}/profile/${encodeURIComponent(b64Id)}`);
    if (!res.ok) return null;
    const json = await res.json();
    const bundle: VitfacProfileBundle | null = json?.data || null;

    if (bundle && bundle.prof) {
      // Synchronize prof stats with courseStats.global if present
      // (Resolves worker discrepancy where bundle.prof has partial/stale counters while courseStats.global has the true aggregated numbers)
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
  const b64Id = /^[0-9]+$/.test(idOrEmpId.trim())
    ? encodeVitfacId(idOrEmpId.trim())
    : idOrEmpId.trim();
  return `https://vitfac.pages.dev/profile?id=${encodeURIComponent(b64Id)}`;
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
