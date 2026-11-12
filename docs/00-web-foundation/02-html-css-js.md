# 02 — HTML, CSS and JavaScript

> **In one line:** the browser renders HTML (structure) styled by CSS (appearance) made
> interactive by JavaScript (behavior); React/Next are JavaScript that generate the first two.
> **Audience:** everyone. **Reading time:** ~10 min.

## HTML — the skeleton

HTML is a tree of tags. Everything you see on a screen is some nested tag with attributes:

```html
<main class="dashboard-shell">
  <nav aria-label="Main navigation">…</nav>
  <section>…</section>
</main>
```

The **accessibility attributes** (`aria-label`, `role="dialog"`) matter here — AmazeCC cares
about screen readers; see `08-pwa-platform/../05-…` and component tests like
`a11yClickable.test.tsx`.

In this repo you will rarely write raw HTML. React's JSX _is_ HTML-with-JS-expressions:

```tsx
<main className="dashboard-shell">
  {" "}
  {/* className, not class */}
  {isLoggedIn ? <Dashboard /> : <GuestHero />}
</main>
```

Note `className` (JSX rule) and `{…}` for JavaScript expressions.

## CSS — the skin

CSS selects elements and sets properties. AmazeCC uses **Tailwind CSS v4**: instead of a
`styles.css` per component, you write utility classes on the element itself:

```tsx
<div className="min-h-screen bg-gray-50 dark:bg-black text-zinc-900">
```

- **Base fonts:** Geist, Geist Mono, DM Sans (`src/app/layout.tsx`).
- **Palette dialect:** zinc scale; light/dark via `class="dark"` on `<html>`.
- `globals.css` defines design tokens and Tailwind import; `uiTokens.ts` in `src/lib/`
  centralizes recurring component styles (tiles, list rows).
- **No CSS modules, no styled-components, no Sass.** If you're reaching for those, stop.

## JavaScript — the muscle

Plain JS moves things, computes things, talks to the network. This repo writes it in
**TypeScript** — JS with a type checker bolted on (see next page) — organized into **modules**
(`import … from "@/lib/..."`; the `@/` alias maps to `src/`).

The browser executes: ES modules, `fetch()`, `localStorage`, the DOM event system, timers,
and the Web APIs we use — Service Workers, IndexedDB, Web Crypto, Clipboard, Share, and Camera
(the paper scanner).

## What the build turns into what

| You write                          | Build (next build) produces   | Browser receives        |
| ---------------------------------- | ----------------------------- | ----------------------- |
| `.tsx` (React + TS)                | minified JS chunks            | one or more `.js` files |
| `.ts` (plain TS)                   | minified JS                   | same                    |
| `globals.css`, Tailwind directives | one CSS file                  | `.css` files            |
| `layout.tsx` metadata              | `<head>` tags baked into HTML | static HTML             |
| `sw.ts` (Serwist)                  | `public/sw.js`                | the service worker file |

## The golden rule

> If it isn't HTML/CSS/JS at the end, it doesn't exist on GitHub Pages.
> Every "server feature" you'll miss (auth routes, API handlers, middleware) is absent by
> design — see [07-static-export](07-static-export.md).

## Quiz

1. What is the difference between `class` and `className`, and who enforces it?
2. Where do AmazeCC's global styles and design tokens live?
3. Why does every interactive element carry an accessibility hint in this codebase?
