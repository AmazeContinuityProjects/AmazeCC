# Cab Share — Architecture

Local matchmaking: trips stored on-device + server table (Supabase) as shared namespace —
fetch trips in range → match locally by slot/pickup/drop → request → accepted → reveal contact.
`cabShareFallback.ts` — localStorage mirror ensures the "My Trips" screen works offline.
