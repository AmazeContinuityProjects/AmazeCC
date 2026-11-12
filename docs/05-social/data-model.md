# Social — Data Model (precise)

```ts
// wire shapes mirror the backend (AmazeCC-API/src/lib/socialTypes.ts)
SocialGrant = { theirHandle: string, theirDisclosure: "coarse"|"full", iDisclosure: "coarse"|"full", pairedAt: number, classIds: string[] }
PeerIndexEntry = { handle: string, displayName: string, grants: SocialGrant[], lastSync: number }
BusyMap = { mon?: string[], tue?: string[], … }   // slot tokens
OwnBusyMap = BusyMap & { slotOrder: string[] }    // O(n) render
```

Atoms: `socialOwnBusyMapAtom`, `socialOwnCoursesAtom`, `socialPeersAtom`, `socialGrantsAtom`, `socialIdentityAtom`, `socialSyncStateAtom`, `activeRegNumberAtom`, `pendingInviteHandleAtom`.

Cache families: `social_peers`, `social_grants` — never raw unbounded; revoke prunes both.

Handles validate against Crockford Base32: `/^AMZ-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/i` — same regex client and server.
