"use client";

import ReactDOM from "react-dom";

/**
 * Kick off the default semester report download from the document head,
 * alongside the route's JS, instead of after hydration when the planner's
 * mount effect would otherwise fetch it.
 *
 * `ReactDOM.preload` rather than a literal `<link rel="preload">`: it is the
 * Next 16 recommended API for resource hints, and React's resource system
 * keys by href + as, so re-renders cannot stack duplicate preload tags.
 * `crossOrigin` must match the planner's own `fetch()` (CORS mode) or the
 * browser will ignore the hint.
 */
export default function PreloadReportCsv({ href }: { href: string }) {
  ReactDOM.preload(href, { as: "fetch", crossOrigin: "anonymous" });
  return null;
}
