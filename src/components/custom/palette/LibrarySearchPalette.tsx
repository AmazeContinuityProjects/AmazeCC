"use client";

import CatalogSearch from "../libraries/CatalogSearch";

/**
 * The command palette's library subpage.
 *
 * The catalog used to be implemented twice — once here and once in the Libraries
 * page — and the two copies drifted. This is now just the shared component in
 * its compact (top-docked) variant.
 */
export default function LibrarySearchPalette() {
  return <CatalogSearch variant="palette" />;
}
