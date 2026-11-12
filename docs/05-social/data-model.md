# Social — Data Model

`SocialGrant = { handle, pairedAt, theirDisclosure, iDisclosure }`
`PeerSnapshot = { handle, displayName, busyMap: BusyMap, sharedSlots, commonFree }`
Wire types mirror the backend — see `lib/social/types.ts`. Treat as the contract; don't extend unilaterally.
