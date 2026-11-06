# Edge Infrastructure & CDN Architecture

AmazeCC relies on a dedicated Cloudflare Edge layer composed of two serverless Cloudflare Workers:

1. **`cdn.amazecc.com` (`amazecc-cdn`)**: Unified media and faculty image chokepoint backed by permanent Cloudflare KV storage and global edge caching.
2. **`cache.amazecc.com` (`amazecc-cache`)**: Public campus data and metadata caching layer fronting Supabase reviews, VIT faculty rosters, directory profiles, and unauthenticated third-party APIs.

This edge layer completely decouples the frontend client from brittle upstream university on-premise servers and external quota limits.

---

## 1. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 AmazeCC Client Application                             │
│                  (Web, PWA, Timetable Canvas, Faculty Dossier, Free Classrooms)        │
└───────────────────────────┬─────────────────────────────────────────┬───────────────────┘
                            │                                         │
                            │ 1. Faculty Photos                       │ 2. Public Data,
                            │    GET /faculty/:empId.webp             │    Roster & Metadata
                            ▼                                         ▼
┌──────────────────────────────────────────────────┐  ┌───────────────────────────────────┐
│               cdn.amazecc.com                    │  │          cache.amazecc.com        │
│              (amazecc-cdn Worker)                │  │       (amazecc-cache Worker)      │
├──────────────────────────────────────────────────┤  ├───────────────────────────────────┤
│                                                  │  │                                   │
│  [Tier 1] Edge Cache (caches.default)            │  │  [Tier 1] Edge Cache              │
│           - Match status === 200                 │  │           - Dual-key (Fresh/Stale)│
│           - 1-Year Immutable Header              │  │                                   │
│                                                  │  │  [Tier 2] Cloudflare KV (CACHE)   │
│  [Tier 2] Cloudflare KV (FACULTY_IMAGES)         │  │           - Faculty Roster (~1.1k)│
│           - Key: fac_{empId}                     │  │           - School Directory      │
│           - Decoupled from all origins           │  │           - Public VTOP Bus Data  │
│                                                  │  │           - Mess Menus / Laundry  │
│  [Tier 3] Fallback Cascade (On KV Miss)          │  │                                   │
│           1. Supabase WebP Storage               │  │  [Tier 3] Upstream Proxies        │
│           2. VIT Chennai WP Media (REST)         │  │           1. Supabase REST API    │
│           3. directorycc Base64 Avatar           │  │           2. directorycc API      │
│           4. 15s Negative Cache Guard            │  │           3. GitHub Changelog API │
│                                                  │  │                                   │
└─────────┬───────────────────┬────────────────┬───┘  └───────┬───────────────┬───────────┘
          │                   │                │              │               │
          ▼                   ▼                ▼              ▼               ▼
   ┌─────────────┐     ┌─────────────┐  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
   │  Supabase   │     │ VIT Chennai │  │ directorycc │ │ Unmessify   │ │ GitHub API  │
   │   Storage   │     │  WordPress  │  │   Faculty   │ │  Mess/Slots │ │  Changelog  │
   │  (Public)   │     │ (On-Prem)   │  │   Portal    │ │             │ │           │
   └─────────────┘     └─────────────┘  └─────────────┘ └─────────────┘ └─────────────┘
```

---

## 2. CDN Worker (`cdn.amazecc.com`)

### Purpose

Faculty profile photos and campus assets are used heavily across student timetables, exam room schedules, free classroom lookups, and faculty dossiers. Serving these directly from origin servers produces catastrophic failure during registration rushes.

### The Problem with Direct Origins

1. **Supabase Storage Quotas**: Vitfac's Supabase bucket is bandwidth-capped. When egress exceeds the free tier, Supabase returns `HTTP 402 Payment Required` (`exceed_cached_egress_quota`), breaking every image on the app.
2. **VIT Chennai On-Premise Networking**: `chennai.vit.ac.in` runs on an on-premise server (`122.187.117.186`). It frequently drops connections, times out (HTTP 522), and suffers from an incomplete SSL certificate chain.
3. **CORS Restrictions**: Direct uploads from university domains lack permissive CORS headers, preventing `<canvas>` elements (such as timetable image exports) from rendering due to canvas tainting.

### Resolution & Caching Hierarchy

When a client requests `GET /faculty/:empId.webp` (or `/faculty/:empId`):

1. **Edge Cache Tier (`caches.default`)**:
   - The worker looks up the canonical request key (`/faculty/:empId.webp`).
   - **Crucial Rule**: Only cached responses with `status === 200` are returned as `HIT`. Stale or negative 404 responses are bypassed to avoid masking newly uploaded images.
2. **Persistent KV Tier (`FACULTY_IMAGES`)**:
   - If not in edge RAM/SSD, the worker queries Cloudflare KV under the key `fac_{empId}`.
   - If found, it returns `HTTP 200` with header `X-AmazeCC-CDN: KV-HIT`, content type, and 1-year immutable caching (`max-age=31536000, immutable`).
   - The edge cache is automatically primed via `ctx.waitUntil(cache.put(...))` so subsequent requests hit Tier 1.
3. **Origin Resolution Cascade (Cold Start Only)**:
   - **Step A: Supabase**: Attempts `${SUPABASE_URL}/storage/v1/object/public/images/${empId}.webp` (timeout: 3000ms).
   - **Step B: VIT Chennai WordPress**: Checks `MEDIA_MAP[empId]`. Queries media metadata via `https://chennai.vit.ac.in/wp-json/wp/v2/media/:id`, extracts `source_url`, and downloads the photo (timeout: 6000ms).
   - **Step C: directorycc**: Queries `https://cache.amazecc.com/faculty/profile/:empId` and extracts the base64 avatar.
4. **Auto-Persist**:
   - Once resolved from any origin, the image is permanently written to Cloudflare KV. Origin servers are **never contacted again** for that faculty member.
5. **Negative Cache Guard**:
   - If the faculty member is missing across all origins, the worker caches a 404 for **15 seconds** (`MISS-404`) to prevent origin request storms without causing long-lived negative caching.

### Endpoints

| Route                                 | Method        | Description                                                                     |
| ------------------------------------- | ------------- | ------------------------------------------------------------------------------- |
| `/faculty/:empId.webp`                | `GET`, `HEAD` | **Canonical Unified Chokepoint**. Resolves any faculty photo with 1-year cache. |
| `/faculty/:empId`                     | `GET`, `HEAD` | Alias without extension (serves WebP / JPEG automatically).                     |
| `/images/:empId.webp`                 | `GET`         | Passthrough to Supabase storage.                                                |
| `/storage/v1/object/public/:bucket/*` | `GET`         | Passthrough to Supabase public storage bucket.                                  |
| `/chennai/wp-content/uploads/*`       | `GET`         | Passthrough proxy to VIT Chennai uploaded media.                                |
| `/wp-media/:id`                       | `GET`         | WordPress media metadata lookup.                                                |
| `/health` or `/`                      | `GET`         | Service status, origin configuration, and roster mapping stats.                 |

---

## 3. Cache Worker (`cache.amazecc.com`)

### Purpose

The cache worker fronts public, unauthenticated data that the client application previously fetched directly from third-party origins in the browser. It unifies faculty review aggregates with campus directory data and shields rate-limited external APIs.

### Caching Model: Dual-Key (Fresh + Stale Grace)

For public data proxies, the worker stores two KV keys in namespace `CACHE`:

1. `data_key`: Holds the full JSON payload under a long TTL (e.g. 30 days).
2. `data_key:fresh`: Acts as a freshness marker under a short TTL (e.g. 5 minutes to 1 day).

- **Cache Hit**: If `:fresh` exists, the payload is served directly from KV (`X-AmazeCC-Source: kv-cache`).
- **Cache Miss**: If `:fresh` expired, the worker fetches upstream. If upstream succeeds, it updates both keys (`upstream-fresh`).
- **Resilient Fallback**: If the upstream origin is down or timing out, the worker falls back to the stale payload in `data_key` (`kv-stale`), ensuring zero user-facing downtime during campus outages.

### Endpoints

| Route                        | Fresh TTL | Stale Grace | Description                                                                        |
| ---------------------------- | --------- | ----------- | ---------------------------------------------------------------------------------- |
| `/faculty/roster`            | 7 days    | 30 days     | Complete faculty roster (~1,150 entries with school, empId, profile URL).          |
| `/faculty/schools`           | 7 days    | 30 days     | Distinct school list derived dynamically from the roster.                          |
| `/faculty/search?q=&school=` | 7 days    | 30 days     | Search and filter faculty across schools.                                          |
| `/faculty/profile/:id`       | 7 days    | 30 days     | Combined profile: Vitfac review metrics + directorycc bio, research, publications. |
| `/transport/buses`           | 6 hours   | 30 days     | Campus bus routes (proxied from VTOP public API).                                  |
| `/fresher/resources`         | 1 day     | 30 days     | Essential fresher links and guides.                                                |
| `/unmessify/:file.json`      | 6 hours   | 30 days     | Hostel mess menus and laundry time slots (fixed allowlist of 13 files).            |
| `/github/commits`            | 5 mins    | 30 days     | Changelog commits. Shields GitHub API 60 req/hr rate limit per IP.                 |
| `/wp-media/:id`              | 7 days    | 30 days     | Cached VIT Chennai WordPress media lookup.                                         |

---

## 4. Origin Failure Diagnostics & SSL Deep Dive

During the implementation of the edge infrastructure, two critical upstream bugs were diagnosed and solved:

### 1. Supabase Bandwidth Quota Exhaustion

- **Symptom**: `https://blfxhlmpvdhcpdwgrffr.supabase.co/storage/v1/object/public/images/:empId.webp` returned `HTTP 402 Payment Required`.
- **Root Cause**: `exceed_cached_egress_quota`. Vitfac's free Supabase project exceeded its monthly egress bandwidth allocation.
- **Solution**: The worker decouples storage by saving all resolved images to Cloudflare KV (`0aa06f0f911a43ed944fb958d0f803e0`), making future image requests 100% independent of Supabase.

### 2. VIT Chennai Broken SSL Certificate Chain (Error 21)

- **Symptom**: Cloudflare Workers attempting to fetch `https://chennai.vit.ac.in/...` threw connection errors or returned `HTTP 502: upstream returned 522`.
- **Diagnostic Inspection**:
  ```bash
  openssl s_client -connect chennai.vit.ac.in:443 -servername chennai.vit.ac.in </dev/null
  ```
  Resulted in:
  ```text
  depth=0 CN=*.vit.ac.in
  verify error:num=20:unable to get local issuer certificate
  verify error:num=21:unable to verify the first certificate
  ```
- **Why Web Browsers Worked**:
  Desktop and mobile browsers (Chrome, Safari) support **AIA (Authority Information Access) Chasing**. The leaf certificate includes:
  `CA Issuers - URI: http://crt.sectigo.com/SectigoPublicServerAuthenticationCADVR36.crt`
  When a browser sees the missing intermediate CA, it fetches the certificate from Sectigo in the background or resolves it from the OS root store.
- **Why Workers & Backend Runtimes Failed**:
  Strict TLS clients (Cloudflare Workers, Node.js, Python, OpenSSL) enforce standard TLS handshakes where the server **must** provide the intermediate certificate in the handshake. Because VIT Chennai only sends the leaf cert, strict clients abort the connection.
- **Permanent Solution**:
  We built a dedicated sync script that executes in an environment supporting intermediate CA validation or custom TLS handling (`scripts/sync_faculty_photos.py`). All 1,083 faculty photos were downloaded and seeded directly into Cloudflare KV. The worker now serves 100% of faculty requests from KV without ever contacting `chennai.vit.ac.in`.

---

## 5. Maintenance & Tooling

### Cloudflare KV Bulk Sync Script

Located at [`amazecc-cdn/scripts/sync_faculty_photos.py`](file:///home/sugeethjsa/GitHub/amazecc-cdn/scripts/sync_faculty_photos.py).

#### Features:

1. **Delta Sync**: Queries existing keys from Cloudflare KV using `wrangler kv key list` and filters out already-cached photos.
2. **Concurrent Fetching**: Uses `httpx.AsyncClient` with an asynchronous semaphore (12 concurrent streams) to fetch media metadata and image buffers in seconds.
3. **Bulk Ingestion**: Uses `wrangler kv:bulk put` with `base64: true` to upload batches of 80 images per transaction to Cloudflare KV.
4. **Dynamic Configuration**: Automatically extracts the KV namespace ID from local `wrangler.toml` or environment variable `KV_NAMESPACE_ID`.

#### Running the Sync:

```bash
cd /path/to/amazecc-cdn
python3 scripts/sync_faculty_photos.py
```

---

## 6. Security & Repository Hygiene

Both edge worker repositories (`amazecc-cdn` and `amazecc-cache`) are public open-source repositories on GitHub under `AmazeContinuityProjects`.

To maintain strict security and credential hygiene:

1. **`wrangler.toml.example` Pattern**:
   - `wrangler.toml` is ignored via `.gitignore` and never committed to source control.
   - Public contributors use `wrangler.toml.example`, which contains sanitized placeholders:
     - `id = "<YOUR_FACULTY_IMAGES_KV_NAMESPACE_ID>"`
     - `id = "<YOUR_CACHE_KV_NAMESPACE_ID>"`
   - Local working copies on developer machines contain the active namespace IDs for direct deployment.
2. **Encrypted Cloudflare Secrets**:
   - `SUPABASE_ANON_KEY` is stored as an encrypted Cloudflare Worker secret (`type: secret_text`), uploaded via:
     ```bash
     wrangler secret put SUPABASE_ANON_KEY
     ```
   - It is never committed in plain text inside `wrangler.toml` or source files.
3. **Local Dev Secrets (`.dev.vars`)**:
   - Local development variables are stored in `.dev.vars` (ignored by Git).
   - `.dev.vars.example` is committed with documentation for developers.
4. **Clean Commit History**:
   - The initial Git commits on `main` were authored cleanly with zero historic commits containing Cloudflare Account IDs or credentials.
