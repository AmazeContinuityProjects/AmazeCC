# Social — Architecture

Pairing model: handles (`AMZ-XXXX-XXXX`) identify people; grants hold disclosure level ("busy" or "full"); the server derives shared classes from timetables submitted during pairing.
Client: `useSocialData` (shared instance), `useSocialGroups`, `usePeerTimetables` — cache peer busy-maps locally (invalidate on revoke).
Grid: recompute common-free hours locally — the server never computes availability twice.
