// Fetch VIT Chennai faculty list + profiles.
//
// Data sources:
//   1. VIT WordPress REST API  -> faculty roster (per school custom post type)
//   2. directorycc.vit.ac.in    -> detailed profile JSON  (/api/faculty/{id}?format=profile)
//
// Usage:
//   node scripts/fetch-vit-faculty.mjs [--list-only] [--out ./data/vit-faculty]
//
// Notes:
//   - The directorycc profile API has been observed returning HTTP 500.
//     The script records that in the output and keeps the roster.
//   - School post types are the custom post types exposed by the WP REST API.

import fs from "node:fs";
import path from "node:path";

// VIT uses a certificate chain that may not be trusted by the local store.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const WP_BASE = "https://chennai.vit.ac.in/wp-json/wp/v2";
const DASH_BASE = "https://directorycc.vit.ac.in";

const SCHOOL_TYPES = [
  "scope",
  "select",
  "sense",
  "mechanical",
  "vfit",
  "vitlaw",
  "sce",
  "sas-che-faculties",
  "sbst",
  "ssl",
  "vitbs",
  "vsmart",
  "physics",
  "mathematics",
  "industrial_design",
  "multimedia",
  "cdmm-centers",
  "cnr-centers",
];

const args = process.argv.slice(2);
const listOnly = args.includes("--list-only");
const outIdx = args.indexOf("--out");
const outDir = outIdx >= 0 ? args[outIdx + 1] : path.join(process.cwd(), "data", "vit-faculty");

fs.mkdirSync(outDir, { recursive: true });

async function wpFetch(url) {
  const res = await fetch(url, { headers: { "User-Agent": "vit-faculty-fetcher/1.0" } });
  if (!res.ok) throw new Error(`WP ${res.status} ${url}`);
  return {
    data: await res.json(),
    total: Number(res.headers.get("x-wp-total") || 0),
    pages: Number(res.headers.get("x-wp-totalpages") || 1),
  };
}

async function fetchRoster() {
  const roster = [];
  for (const type of SCHOOL_TYPES) {
    let page = 1;
    let pages = 1;
    do {
      const url = `${WP_BASE}/${type}?per_page=100&page=${page}&_fields=id,title,slug,link,meta,featured_media`;
      let batch;
      try {
        batch = await wpFetch(url);
      } catch (e) {
        console.error(`  [${type}] page ${page} failed:`, e.message);
        break;
      }
      pages = batch.pages;
      for (const p of batch.data) {
        const linksTo = p?.meta?._links_to || "";
        const m = linksTo.match(/\/faculty\/(\d+)/);
        roster.push({
          school: type,
          wp_id: p.id,
          name: p?.title?.rendered || "",
          slug: p?.slug || "",
          wp_url: p?.link || "",
          employee_id: m ? m[1] : null,
          dashboard_url: linksTo || null,
          featured_media: p?.featured_media || null,
        });
      }
      console.log(`  [${type}] page ${page}/${pages} -> ${batch.data.length}`);
      page++;
      await new Promise((r) => setTimeout(r, 200));
    } while (page <= pages);
  }
  return roster;
}

async function fetchProfile(employeeId) {
  const url = `${DASH_BASE}/api/faculty/${encodeURIComponent(employeeId)}?format=profile`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.message) msg += `: ${j.message}`;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

async function main() {
  console.log("Fetching faculty roster from VIT WordPress REST API...");
  const roster = await fetchRoster();
  fs.writeFileSync(path.join(outDir, "faculty_list.json"), JSON.stringify(roster, null, 2));
  console.log(`Roster: ${roster.length} entries -> ${path.join(outDir, "faculty_list.json")}`);

  if (listOnly) return;

  const profilesDir = path.join(outDir, "profiles");
  fs.mkdirSync(profilesDir, { recursive: true });
  const failures = [];
  let ok = 0;
  for (const f of roster) {
    if (!f.employee_id) {
      failures.push({ ...f, error: "no employee_id" });
      continue;
    }
    const file = path.join(profilesDir, `${f.employee_id}.json`);
    if (fs.existsSync(file)) {
      ok++;
      continue;
    }
    try {
      const profile = await fetchProfile(f.employee_id);
      fs.writeFileSync(file, JSON.stringify(profile, null, 2));
      ok++;
      console.log(`  OK   ${f.employee_id} ${f.name}`);
    } catch (e) {
      failures.push({ employee_id: f.employee_id, name: f.name, school: f.school, error: e.message });
      console.log(`  FAIL ${f.employee_id} ${f.name} -> ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  fs.writeFileSync(path.join(outDir, "failures.json"), JSON.stringify(failures, null, 2));
  console.log(`Profiles fetched: ${ok}/${roster.length}; failures: ${failures.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
