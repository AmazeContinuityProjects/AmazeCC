"use client";

import React, { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";

/**
 * Cover URLs come straight from the Koha OPAC, which is inconsistent about how
 * it spells them. Normalising here means one place to fix instead of a
 * broken-image box in every list row.
 *
 * - `http://` is upgraded: the app is served over https, so a plain http URL is
 *   dropped by the browser as mixed content before it ever reaches the network.
 * - `//host/path` is protocol-relative and resolves against the page scheme,
 *   which is fine in theory but breaks when the OPAC only serves http.
 * - Anything that is not an absolute http(s) URL is rejected rather than
 *   requested, so the placeholder shows immediately instead of 404ing.
 */
export function normalizeCoverUrl(url?: string | null): string {
  const raw = (url || "").trim();
  if (!raw) return "";
  if (/^data:/i.test(raw)) return raw;

  if (raw.startsWith("//")) return `https:${raw}`;

  if (/^http:\/\//i.test(raw)) return `https://${raw.slice(7)}`;

  if (/^https?:\/\//i.test(raw)) return raw;

  return "";
}

interface BookCoverProps {
  url?: string | null;
  /** Tailwind sizing + radius for the frame, e.g. "w-9 h-12 rounded-lg". */
  className?: string;
  /** Tailwind sizing for the <img> inside the frame. Defaults to filling it. */
  imgClassName?: string;
  alt?: string;
}

/**
 * A cover thumbnail that degrades to a neutral placeholder instead of showing
 * a broken-image glyph, and never renders at all when the URL is unusable.
 */
export default function BookCover({
  url,
  className = "w-9 h-12 rounded-lg",
  imgClassName = "w-full h-full object-cover",
  alt = "",
}: BookCoverProps) {
  const src = normalizeCoverUrl(url);
  const [failed, setFailed] = useState(false);

  // A new URL deserves a fresh attempt, otherwise a result that previously
  // 404ed would stay on the placeholder for the rest of the session.
  useEffect(() => {
    setFailed(false);
  }, [src]);

  const frameClass = `${className} shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center`;

  if (!src || failed) {
    return (
      <span className={frameClass}>
        <BookOpen className="w-4 h-4 text-zinc-300 dark:text-zinc-600" />
      </span>
    );
  }

  return (
    <span className={frameClass}>
      {/* next/image cannot be used: the host is an arbitrary Koha instance and
          the site is a static export with unoptimized images. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        // Koha OPAC hosts commonly reject requests that carry a Referer.
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={imgClassName}
      />
    </span>
  );
}
