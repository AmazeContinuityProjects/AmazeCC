---
title: "The State Bridge"
description: "the single seam between the engine and jotai/localStorage — every result lands there, nowhere else."
---

# 07 — The State Bridge

> **In one line:** the single seam between the engine and jotai/localStorage — every result
> lands there, nowhere else.
> **Read:** `src/lib/sync-engine/state-bridge.ts`.

```ts
import { getDefaultStore } from "jotai";
export const stateBridge = {
  setAtom: (atom: any, value: any) => {
    try {
      getDefaultStore().set(atom, value);
    } catch {}
  },
  getAtom: (atom: any) => {
    try {
      return getDefaultStore().get(atom);
    } catch {
      return undefined;
    }
  },
};
export { dataAtoms } from "../../store/dataAtoms";
```

## Why a default store

The engine is not React. It needs to write UI state from outside the component tree —
the default store reaches atoms regardless of Provider position (and survives full remounts).

## Failure posture

Every call is `try/catch`-silent — a missing atom must never crash a sync run. Consequences are
log-gaps, not broken screens (which still show stale caches).

## When you add an engine-produced datum

1. Atom in `store/dataAtoms.ts` (or `uiAtoms.ts`)
2. `stateBridge.setAtom` call in the op
3. `storage.ts` persistence (if it should survive refresh)
4. Boot-path seeding in `useAppBootstrap.ts`

## Quiz

1. Why does the engine use the _default_ store rather than a Provider-wrapped one?
2. Which atom family does the engine write, and where does boot re-read it?
