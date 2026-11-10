/**
 * Content-Security-Policy for the static export.
 *
 * The site is a static export served from GitHub Pages, which cannot set
 * response headers, so the policy ships as a `<meta http-equiv>` tag in the
 * root layout. A meta CSP cannot use `frame-ancestors`, `report-uri` or
 * report-only mode, and Next.js's static export emits inline bootstrap
 * scripts without nonces, so `script-src` has to allow `'unsafe-inline'`.
 *
 * What this policy still buys, given credentials live in localStorage:
 *  - scripts load only from this origin and the analytics/OCR hosts below, so
 *    an injected `<script src="https://attacker">` does not run;
 *  - no plugins (`object-src 'none'`) and no `<base>` hijacking;
 *  - forms post only to this origin or EventHub (the one cross-site form);
 *  - workers come only from this origin, blob: URLs or the OCR CDN.
 *
 * `connect-src` and `img-src` stay open to any https host on purpose: the
 * profile page lets a student point the app at their own API URL, and
 * images come from many campus and library hosts. Tightening those needs the
 * site on a host that can send headers (for nonces) and is a follow-up.
 */

const SCRIPT_HOSTS = [
  // Google Analytics (`@next/third-parties/google`)
  "https://www.googletagmanager.com",
  // PostHog: the reverse proxy and PostHog's own asset hosts (recorder, surveys)
  "https://shoot.amazecc.com",
  "https://*.posthog.com",
  // tesseract.js loads its worker, wasm core and language data from jsDelivr
  "https://cdn.jsdelivr.net",
];

const FORM_TARGETS = [
  // EventHubSubpage posts a sign-in form to EventHub in a new tab
  "https://eventhubcc.vit.ac.in",
];

export function buildContentSecurityPolicy(): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", ...SCRIPT_HOSTS],
    "worker-src": ["'self'", "blob:", "https://cdn.jsdelivr.net"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "font-src": ["'self'", "data:"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "media-src": ["'self'", "data:", "blob:", "https:"],
    "connect-src": ["'self'", "https:"],
    "frame-src": ["'self'", "https:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", ...FORM_TARGETS],
  };
  return [
    ...Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`),
    "upgrade-insecure-requests",
  ].join("; ");
}
