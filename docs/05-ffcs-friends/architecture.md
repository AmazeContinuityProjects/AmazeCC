# FFCS Friends — Architecture (deep)

> **In one line:** VTOP knows who picked which sections; AmazeCC only tells your phone the people you explicitly asked about — nothing else.

## 1. The query contract

```
client: collectedFinishedSections() → [classId, …]
        POST /api/social/ffcs-match { handle, classIds }
        (auth: vtop)
server: returns { matches: [{ handle, names?, shared: count }] }
```

classId = (course, section, semester) — opaque to us; course is the only identifiable piece.

## 2. What the server learns

Your own class enrollment list. It cannot infer "my friend is X" from your list; it can only answer
the "who's in my sections" question posed about your own list.

## 3. The Friends UI (inside the planner)

- Add by handle (QR scan or paste)
- Group management — groups share a busy map (common free grid inside groups)
- Friend timetable viewer — migration partner for lab-slot splitting
- revoke pair → instant purge client-side
