# Network, fonts & images

**Severity: MEDIUM** — render-blocking resources delay first paint; images are unoptimized.

## 1. Render-blocking Google Fonts via `<link>`

`src/app/layout.tsx:53-55`:
```tsx
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:...&family=Geist:...&family=Geist+Mono:...&display=swap" rel="stylesheet" />
```
Three font families (DM Sans, Geist, Geist Mono) are loaded synchronously in `<head>` with a blocking
stylesheet. This delays First Contentful Paint and causes a flash of invisible text (FOIT) until the
CSS + woff2 files arrive. There is `preconnect` but **no `preload`** for the actual font files.

Recommendation: use **`next/font/google`** (e.g. `DM_Sans`, `Geist`, `Geist_Mono`) which self-hosts
the fonts, eliminates the round-trip to `fonts.googleapis.com`, and avoids layout shift. With
`output: 'export'` this still works (fonts are inlined/self-hosted at build).

## 2. Images are unoptimized

`next.config.mjs:56`: `images: { unoptimized: true }`.

Only two components use `next/image` (`exams/MarksDisplay.tsx:6`, `NoContentFound.tsx:1`); everything
else relies on plain `<img>`. With `unoptimized: true`, even those get no resizing/format conversion.
Large remote images (avatar/logo) are served at full size. Because this is a static export there is
no Next image server, but you can still:
- Use `next/image` with a CDN that supports on-the-fly optimization, or
- Pre-compress/resize assets in `public/` and reference sized variants.

## 3. Analytics script

`src/app/layout.tsx:72`: `<GoogleAnalytics gaId="G-HGB7VDJKX0" />` (`@next/third-parties`). This is
generally async and low-impact, but verify it is not render-blocking. It is fine as-is.

## 4. Manifest / PWA assets

`public/manifest.json` and icons are referenced (`layout.tsx:29-46`). Ensure icons are precompressed
and the manifest is served with correct caching. Low concern.

## Recommendations

1. Migrate the three font families to `next/font/google` (highest impact for FCP/TBT).
2. Pre-optimize images in `public/`; keep `unoptimized` only if a CDN optimizer is in front.
3. Add `<link rel="preload">` for the hero font subset if staying on the `<link>` approach short-term.
