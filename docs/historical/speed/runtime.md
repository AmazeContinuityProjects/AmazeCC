# Runtime rendering & React performance

**Severity: HIGH** — affects interactivity, tab switches and typing.

## 1. `cmds` useMemo has no dependency array (definite bug)

`Main.tsx:985`:
```ts
const cmds = useMemo(() => {
  const result: any[] = [];
  ...
});
```
A `useMemo` **without a dependency array recomputes on every single render**. The body builds large
JSX detail components (`attDetail`, `markDetail`, `gradeDetail`) for attendance/marks/grades. Any atom
update in `Main` (and there are ~30 subscribed atoms, see `Main.tsx:58-94`) re-runs this whole
computation. Fix: add the proper dependency array (and memoize the per-course detail builders
separately), or move command building into the `CommandPalette` component which actually needs it.

## 2. `Main` subscribes to ~30 atoms and passes ~50 props to `Dashboard`

`Main.tsx:58-94` subscribes to nearly every application atom. Each `setX(...)` triggers a re-render of
`Main`, which re-renders `Dashboard` and forwards ~50 props. Although `Dashboard` only mounts the
active tab (`activeTab === "..." && <Tab/>`, `Dashboard.tsx:771-1156`), `Main` itself re-renders
frequently. Recommendations:
- Use **atom selectors** (`useAtomValue(atom)`) closer to where each value is consumed instead of
  funneling everything through `Main`/`Dashboard` props.
- Wrap expensive children in `React.memo` and pass primitive props (not new object/array literals).

## 3. Full page reload on theme change

`Main.tsx:51-53`:
```ts
const reloadAfterThemeChange = () => {
  window.setTimeout(() => window.location.reload(), 80);
};
```
Bound to the theme keyboard shortcut (Alt+T) at `Main.tsx:974-978`. A full `location.reload()`
re-downloads/parses the entire app and re-runs the 2.4 s splash. Theme is already applied via CSS
variables (`Main.tsx:111-228`), so the reload is unnecessary — remove it and let the class swap
re-render in place.

## 4. Artificial 2.4 s loading screen

`Main.tsx:375`:
```ts
setTimeout(() => setIsLoading(false), 2400);
```
The app shows a loading spinner for a hard-coded 2.4 seconds on every cold start regardless of how
fast data is ready. Drive `isLoading` off actual readiness (all `storage.*.get()` resolved / hydration
done) instead of a timer.

## 5. Growing `message` string causing re-renders

Throughout `Main.tsx`, `setMessage(prev => prev + "\n" + msg)` appends to an ever-growing string that
is rendered (e.g. in the reload banner / `CommandPalette`). Large strings re-rendered repeatedly add
GC and diff cost. Keep the message as a bounded array (last N lines) rather than one concatenated
string.

## 6. `framer-motion` everywhere

`AnimatePresence` + `motion` are used pervasively (≈30 files). Layout/`spring` animations on long lists
(attendance, marks) can drop frames. Prefer CSS transitions for simple opacity/transform and reserve
`motion` for genuinely animated elements. `reactStrictMode: true` (`next.config.mjs:39`) only
double-invokes effects in **dev**, so it is not a production concern but does make dev feel slower.

## Recommendations (priority order)

1. Add a dependency array to the `cmds` useMemo (`Main.tsx:985`). Quick, high value.
2. Remove `reloadAfterThemeChange` full reload (`Main.tsx:51`).
3. Replace the 2.4 s timer with real readiness gating (`Main.tsx:375`).
4. Introduce atom selectors / `React.memo` to cut re-render fan-out from `Main`→`Dashboard`.
5. Bound the `message` buffer.
