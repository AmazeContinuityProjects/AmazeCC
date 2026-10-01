"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Globe } from "lucide-react";
import { ListRowText, ListShell } from "../shared/primitives";
import { GHOST_BUTTON, LIST_ROW, TONE_ICON_TILE } from "@/lib/uiTokens";

const LINKS = [
  { url: "https://amaze-cc.vercel.app", label: "Amaze-CC on Vercel" },
  { url: "https://amazecc.com", label: "amazecc.com" },
  { url: "https://instagram.com/amazecc", label: "@amazecc on Instagram" },
];

/**
 * The three canonical links, with a copy button each.
 *
 * This was a collapsible section behind a `text-xl` button, which cost a tap to
 * see three rows and did not match anything else on the page. Always-open rows
 * is the same shape as every other list in the app; `title` on the row keeps the
 * full URL reachable on hover, because the label is a friendlier name than the
 * address a reader is about to copy.
 */
export default function Links() {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 1500);
  };

  return (
    <ListShell>
      {LINKS.map((link) => {
        const copied = copiedUrl === link.url;
        return (
          <div key={link.url} className={LIST_ROW}>
            <span
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${TONE_ICON_TILE.sky}`}
            >
              <Globe className="w-4.5 h-4.5" />
            </span>
            <ListRowText
              title={link.label}
              titleTooltip={link.url}
              subtitle={link.url}
            />
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open ${link.url}`}
              aria-label={`Open ${link.label}`}
              className="shrink-0 text-zinc-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              type="button"
              onClick={() => handleCopy(link.url)}
              className={`${GHOST_BUTTON} shrink-0`}
              title={`Copy ${link.url}`}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span className="text-[11px]">{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        );
      })}
    </ListShell>
  );
}
