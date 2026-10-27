"use client";

import { useEffect } from "react";
const COLOR_PALETTES: Record<string, { accent: string; background?: string; surface?: string }> = {
  default: { accent: "" },
  neonPink: { accent: "#ff2bd6", background: "#fff7fd", surface: "#ffffff" },
  ocean: { accent: "#ff2bd6", background: "#fff7fd", surface: "#ffffff" },
  forest: { accent: "#059669", background: "#f8fffb", surface: "#ffffff" },
  rose: { accent: "#e11d48", background: "#fff8fa", surface: "#ffffff" },
  amber: { accent: "#d97706", background: "#fffdf6", surface: "#ffffff" },
};

export function useAppAppearance(settings: any, theme: any) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const selectedPalette = settings.colorPalette === "ocean" ? "neonPink" : settings.colorPalette;
    const palette =
      selectedPalette === "custom"
        ? settings.customPalette
        : COLOR_PALETTES[selectedPalette || "default"];

    const vars = [
      "--theme-accent",
      "--background",
      "--foreground",
      "--text-heading",
      "--text-primary",
      "--text-secondary",
      "--text-muted",
      "--surface",
      "--surface-raised",
      "--surface-secondary",
      "--surface-tertiary",
      "--surface-hover",
      "--border-muted",
      "--border-strong",
      "--card",
      "--card-foreground",
      "--popover",
      "--popover-foreground",
      "--primary",
      "--primary-foreground",
      "--secondary",
      "--secondary-foreground",
      "--muted",
      "--muted-foreground",
      "--accent",
      "--accent-foreground",
      "--border",
      "--input",
      "--info",
      "--info-foreground",
      "--info-surface",
      "--ring",
      "--chart-1",
      "--chart-2",
      "--chart-3",
      "--sidebar",
      "--sidebar-foreground",
      "--sidebar-primary",
      "--sidebar-primary-foreground",
      "--sidebar-accent",
      "--sidebar-accent-foreground",
      "--sidebar-border",
      "--sidebar-ring",
    ];

    if (!palette || settings.colorPalette === "default") {
      vars.forEach((name) => root.style.removeProperty(name));
      delete root.dataset.colorPalette;
      return;
    }

    const isDarkMode = root.classList.contains("dark");
    const accent = palette.accent || "#0ea5e9";
    const surface = palette.surface || "#ffffff";
    root.dataset.colorPalette = selectedPalette || "custom";
    root.style.setProperty("--theme-accent", accent);

    if (isDarkMode) {
      root.style.setProperty("--background", `color-mix(in oklab, ${accent} 4%, oklch(0.09 0.015 255))`);
      root.style.setProperty("--surface", `color-mix(in oklab, ${accent} 5%, oklch(0.20 0 0))`);
      root.style.setProperty("--surface-raised", `color-mix(in oklab, ${accent} 5%, oklch(0.23 0 0))`);
      root.style.setProperty("--surface-secondary", `color-mix(in oklab, ${accent} 6%, oklch(0.25 0 0))`);
      root.style.setProperty("--surface-tertiary", `color-mix(in oklab, ${accent} 8%, oklch(0.28 0 0))`);
      root.style.setProperty("--surface-hover", `color-mix(in oklab, ${accent} 9%, oklch(0.27 0 0))`);
      root.style.setProperty("--border-muted", `color-mix(in oklab, ${accent} 18%, oklch(0.98 0.004 247 / 0.22))`);
      root.style.setProperty("--border-strong", `color-mix(in oklab, ${accent} 24%, oklch(0.98 0.004 247 / 0.36))`);
      root.style.setProperty("--sidebar", `color-mix(in oklab, ${accent} 5%, oklch(0.18 0 0))`);
      root.style.setProperty("--sidebar-primary", `color-mix(in oklab, ${accent} 8%, oklch(0.22 0 0))`);
      root.style.setProperty("--sidebar-accent", `color-mix(in oklab, ${accent} 8%, oklch(0.22 0 0))`);
      root.style.setProperty("--sidebar-border", `color-mix(in oklab, ${accent} 22%, oklch(0.985 0 0 / 0.12))`);
    } else {
      root.style.setProperty("--background", `color-mix(in oklab, ${accent} 4%, oklch(0.982 0.004 247))`);
      root.style.setProperty("--surface", `color-mix(in oklab, ${accent} 2%, ${surface})`);
      root.style.setProperty("--surface-raised", `color-mix(in oklab, ${accent} 2%, ${surface})`);
      root.style.setProperty("--surface-secondary", `color-mix(in oklab, ${accent} 5%, oklch(0.965 0.005 247))`);
      root.style.setProperty("--surface-tertiary", `color-mix(in oklab, ${accent} 7%, oklch(0.935 0.008 247))`);
      root.style.setProperty("--surface-hover", `color-mix(in oklab, ${accent} 8%, oklch(0.955 0.007 247))`);
      root.style.setProperty("--border-muted", `color-mix(in oklab, ${accent} 14%, oklch(0.88 0.008 247))`);
      root.style.setProperty("--border-strong", `color-mix(in oklab, ${accent} 20%, oklch(0.78 0.011 247))`);
      root.style.setProperty("--sidebar", `color-mix(in oklab, ${accent} 4%, ${surface})`);
      root.style.setProperty("--sidebar-primary", `color-mix(in oklab, ${accent} 8%, oklch(0.9 0 0))`);
      root.style.setProperty("--sidebar-accent", `color-mix(in oklab, ${accent} 8%, oklch(0.95 0 0))`);
      root.style.setProperty("--sidebar-border", `color-mix(in oklab, ${accent} 15%, oklch(0.9 0 0))`);
    }

    root.style.setProperty("--card", "var(--surface)");
    root.style.setProperty("--card-foreground", "var(--text-primary)");
    root.style.setProperty("--popover", "var(--surface-raised)");
    root.style.setProperty("--popover-foreground", "var(--text-primary)");
    root.style.setProperty("--primary", accent);
    root.style.setProperty("--primary-foreground", "#ffffff");
    root.style.setProperty("--secondary", "var(--surface-secondary)");
    root.style.setProperty("--secondary-foreground", "var(--text-primary)");
    root.style.setProperty("--muted", "var(--surface-secondary)");
    root.style.setProperty("--muted-foreground", "var(--text-muted)");
    root.style.setProperty("--accent", "var(--surface-tertiary)");
    root.style.setProperty("--accent-foreground", "var(--text-primary)");
    root.style.setProperty("--border", "var(--border-muted)");
    root.style.setProperty("--input", "var(--border-strong)");
    root.style.setProperty("--info", accent);
    root.style.setProperty("--info-foreground", accent);
    root.style.setProperty("--info-surface", `color-mix(in oklab, ${accent} 14%, transparent)`);
    root.style.setProperty("--ring", accent);
    root.style.setProperty("--sidebar-ring", accent);
    root.style.setProperty("--chart-1", accent);
    root.style.setProperty("--chart-2", `color-mix(in oklab, ${accent} 70%, #10b981)`);
    root.style.setProperty("--chart-3", `color-mix(in oklab, ${accent} 70%, #f59e0b)`);
  }, [settings.colorPalette, settings.customPalette, theme]);

  // The card interior preference: `data-card-surface` on the root is what the
  // `.card-surface` rules in globals.css key on — absent or "gray" paints the
  // grade-insights gray, "zinc" restores the classic glass. Always written, so
  // no reader has to treat absence as a third state.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.cardSurface = settings.cardSurfaceZinc ? "zinc" : "gray";
  }, [settings.cardSurfaceZinc]);


}
