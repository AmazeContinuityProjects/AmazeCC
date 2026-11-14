/**
 * Mount spec loader.
 *
 * The default mount order lives in `spec.json` (checked in). A deployment can
 * replace it whole-cloth by setting `NEXT_PUBLIC_API_MOUNTS` to the same JSON
 * shape - env wins. Invalid output never crashes boot: unknown `lib`s are
 * dropped with a warning, and a missing `order` falls back to spec order.
 */
import bundled from "./spec.json";

export interface MountSpecEntry {
  lib: string;
  baseUrl?: string;
  name?: string;
  enabled?: boolean;
}
export interface MountSpec {
  order: string[];
  mounts: Record<string, MountSpecEntry>;
}

interface RawSpec {
  order?: unknown;
  mounts?: unknown;
}

function parseJson(value: string): RawSpec | null {
  try {
    const parsed = JSON.parse(value) as RawSpec;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // fall through
  }
  return null;
}

function normalize(raw: RawSpec, source: string): MountSpec | null {
  const mountsIn = raw.mounts;
  if (!mountsIn || typeof mountsIn !== "object") return null;
  const mounts: Record<string, MountSpecEntry> = {};
  for (const [id, entry] of Object.entries(mountsIn as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.lib !== "string" || !e.lib) {
      console.warn(`[apis] mount '${id}' in ${source} has no 'lib' - skipped`);
      continue;
    }
    mounts[id] = {
      lib: e.lib,
      baseUrl: typeof e.baseUrl === "string" ? e.baseUrl.replace(/\/+$/, "") : undefined,
      name: typeof e.name === "string" ? e.name : undefined,
      enabled: e.enabled !== false,
    };
  }
  const orderRaw = Array.isArray(raw.order) ? raw.order.filter((x): x is string => typeof x === "string") : [];
  const known = Object.keys(mounts);
  const order = orderRaw.filter((id) => known.includes(id));
  const missing = known.filter((id) => !order.includes(id) && mounts[id].enabled !== false);
  if (missing.length) {
    console.warn(`[apis] mounts missing from 'order' in ${source}, appending: ${missing.join(", ")}`);
    order.push(...missing);
  }
  return { order, mounts };
}

let cached: MountSpec | null = null;

/** Resolve the active mount spec: env override, else the bundled default. */
export function loadMountSpec(): MountSpec {
  if (cached) return cached;
  const envRaw = process.env.NEXT_PUBLIC_API_MOUNTS;
  if (envRaw) {
    const parsed = parseJson(envRaw);
    const normalized = parsed ? normalize(parsed, "NEXT_PUBLIC_API_MOUNTS") : null;
    if (normalized) {
      cached = normalized;
      return normalized;
    }
    console.warn(
      "[apis] NEXT_PUBLIC_API_MOUNTS is invalid JSON or has no 'mounts' object - falling back to bundled spec.json",
    );
  }
  cached = normalize(bundled as RawSpec, "spec.json")!;
  return cached;
}
