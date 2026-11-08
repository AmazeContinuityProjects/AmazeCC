"use client";

import { useEffect } from "react";

/**
 * Calm Notebook accent palettes (AmazeUI 2.0). Each seed has a light and a dark
 * value, both checked for contrast. Only the accent moves: surfaces, lines and
 * text stay the neutral notebook tokens so a palette can never tint the page.
 */
export const ACCENT_SEEDS: Record<string, { light: string; dark: string; label: string }> = {
  default: { light: "#24508f", dark: "#8fb4ea", label: "Ink" },
  forest: { light: "#1f7a4d", dark: "#6fcf9b", label: "Forest" },
  rust: { light: "#b5470b", dark: "#e9844e", label: "Rust" },
  plum: { light: "#8b3a8f", dark: "#cf7fd3", label: "Plum" },
  graphite: { light: "#46524d", dark: "#b9c2be", label: "Graphite" },
};

/** v1 palette ids still stored in settings, mapped onto the nearest seed. */
const LEGACY_IDS: Record<string, string> = {
  neonPink: "plum",
  ocean: "default",
  lavender: "plum",
  rose: "rust",
  amber: "rust",
  sunset: "rust",
};

export function normalizePaletteId(id: string | undefined): string {
  if (!id) return "default";
  return LEGACY_IDS[id] ?? id;
}

const VARS = [
  "--palette-accent-light",
  "--palette-accent-dark",
  "--palette-accent-soft-light",
  "--palette-accent-soft-dark",
];

export function useAppAppearance(settings: any, theme: any) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const id = normalizePaletteId(settings.colorPalette);
    const custom = id === "custom" ? settings.customPalette?.accent : undefined;
    const seed = custom ? { light: custom, dark: custom } : ACCENT_SEEDS[id];

    if (!seed || id === "default") {
      VARS.forEach((name) => root.style.removeProperty(name));
      delete root.dataset.colorPalette;
      return;
    }

    root.dataset.colorPalette = id;
    root.style.setProperty("--palette-accent-light", seed.light);
    root.style.setProperty("--palette-accent-dark", seed.dark);
    root.style.setProperty("--palette-accent-soft-light", `color-mix(in oklab, ${seed.light} 12%, white)`);
    root.style.setProperty("--palette-accent-soft-dark", `color-mix(in oklab, ${seed.dark} 16%, #000000)`);
  }, [settings.colorPalette, settings.customPalette, theme]);

  // Retired: the v1 "card look" toggle. Cards are always the solid surface.
  useEffect(() => {
    if (typeof document === "undefined") return;
    delete document.documentElement.dataset.cardSurface;
  }, [settings.cardSurfaceZinc]);
}
