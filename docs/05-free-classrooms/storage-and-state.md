# Free Classrooms — Storage & State

No atoms; fetches via `roomAvailability` op on demand.
Caches: `cache_free_classrooms` (TTL ≈ semester lifetime; slot tables don't change per semester).
The client-side tables ship in /data/campus/*.json — no network at all for the math.
