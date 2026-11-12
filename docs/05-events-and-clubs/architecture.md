# Events & Clubs — Architecture

EventHub (`eventhubcc.vit.ac.in`) is a _public_ site with auth for registration — tokens minted server-side per session.
Client talks only to AmazeCC-API (`/api/events`, `/api/clubs`) — scraping there.
Clubs feed: VIT-mapped scraping + community table (Supabase) — contact via club modals, not DM.
