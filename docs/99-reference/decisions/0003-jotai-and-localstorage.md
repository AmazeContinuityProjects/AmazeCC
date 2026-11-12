# ADR-0003: jotai Atoms + localStorage Cache (not one global store)

**Status:** accepted
**Context:** UI state (tabs/sheets/selection) and durable cache (attendance/marks) have different lifetimes; one store would conflate them.
**Decision:** jotai atoms for session-live state; `storage.ts` (localStorage) for durable caches; boot rehydrates atoms from cache — the two are bridged ONLY by `state-bridge.ts` and `useAppBootstrap`.
**Consequences:** simple mental model; no provider ceremony; SSR-safe by default-store usage outside React; any atom can be written from outside the tree.
**Revisit when:** React primitives evolve that make the split awkward — unlikely within this repo's lifetime.
