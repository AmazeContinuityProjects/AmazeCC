# Hostel — Architecture

Mess + laundry are **read-only static APIs** on the Worker cache (laundry JSON small; mess JSON per canteen/day).
Leave history: VTOP → `/api/hostel`; counselling: GenericApiView pattern (read-only scrape).
Cab share: co-partying finds ride matches locally by time/pickup; store in localStorage (+ backups).
