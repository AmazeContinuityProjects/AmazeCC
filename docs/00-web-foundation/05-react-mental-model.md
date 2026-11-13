---
title: "The React Mental Model"
description: "build UI from functions that turn state into HTML; never mutate the page by hand — describe _what it should look like_ and let React figure out the minimal updates."
---

# 05 — The React Mental Model

> **In one line:** build UI from functions that turn state into HTML; never mutate the page by
> hand — describe _what it should look like_ and let React figure out the minimal updates.
> **Audience:** everyone. **Reading time:** ~12 min.

## Three sentences that carry 80% of React

1. A component is a function that returns JSX (HTML-looking markup).
2. **Props** are the arguments the parent passes in. **State** is data the component owns.
3. When props or state change, React re-runs the component function and updates the DOM
   to match — **you never touch the DOM directly**.

```tsx
function PercentageBadge({ pct }: { pct: number }) {
  // props
  const tone = pct >= 75 ? "emerald" : "red"; // derived value
  return <span className={`badge-${tone}`}>{pct}%</span>;
}
```

## The four hooks in this repo, in order of frequency

| Hook                      | Job                               | AmazeCC example                            |
| ------------------------- | --------------------------------- | ------------------------------------------ |
| `useState`                | own a value across renders        | `const [search, setSearch] = useState("")` |
| `useEffect`               | run a side effect after paint     | sync-on-mount, timers, listeners           |
| `useCallback` / `useMemo` | identity-stable functions / cache | hot children, expensive lists              |
| `useRef`                  | mutable box, no re-render         | DOM handles, latest-value capture          |
| context/jotai             | share state across distant trees  | `using useAtom(isLoggedInAtom)`            |

`useEffect(() => {…}, [])` — "run once on mount". `useEffect(..., [semesterId])` — "run
whenever semesterId changes". Effects are how this app talks to the outside world (fetch,
storage, subscriptions) — gets you the answer for "why did X fire twice?": strict semantics
and dependency bugs.

## Why this app doesn't use `useContext` much

jotai atoms (`@/store`) are the cross-tree state mechanism — no provider ladders, no
painstaking re-render surgery, and the same store is readable outside React via
`getDefaultStore()` (that's how the sync engine publishes atoms).

## Render performance, the short list

- Split screens via `next/dynamic` (see `Main.tsx`) — the initial bundle never contains
  screens you haven't opened.
- `memo()` on heavy leaves (`Dashboard.tsx` export is `memo`) where props are stable.
- Long lists virtualize manually or use sheets; check `TimetableGridShell` for row merging.

## Quiz

1. What is the difference between props and state — give an example from the attendance tab.
2. When must you reach for `useRef` instead of `useState`?
3. Why is `useEffect(…, [])` suspicious by default in this codebase? (Hint: what's the error,
   and when does it double-run?)
