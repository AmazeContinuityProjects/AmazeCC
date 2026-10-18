"use client";

import { SegmentedControl } from "./primitives";
import { estimateModeCost, type SyncMode } from "@/lib/sync-engine/sync-modes";

/**
 * Mode switcher for the sync sheet: Quick / Balanced / Full + customs.
 * Compact by design — the sheet is small, so costs live in tooltips.
 * The default mode carries a star; selecting any mode also makes it default.
 */
export default function SyncModePicker({
  modes,
  activeId,
  defaultId,
  onSelect,
}: {
  modes: SyncMode[];
  activeId: string;
  defaultId?: string;
  onSelect: (id: string) => void;
}) {
  if (modes.length === 0) return null;
  return (
    <div className="w-full">
      <SegmentedControl
        scroll
        value={activeId}
        onChange={onSelect}
        options={modes.map((m) => {
          const cost = estimateModeCost(m);
          const short = m.builtIn ? m.label.replace(" Sync", "").replace(" Only", "") : m.label;
          const isDefault = defaultId === m.id;
          return {
            value: m.id,
            // Star prefixes the default instead of using the icon slot: the
            // control hides icon+label pairs on small screens.
            label: isDefault ? `★ ${short}` : short,
            title: `${m.label} — ${m.description} (${m.steps.length} ops · ${cost.label})${
              isDefault ? " · default — selecting another mode changes it" : " · tap to run and set as default"
            }`,
          };
        })}
      />
    </div>
  );
}
