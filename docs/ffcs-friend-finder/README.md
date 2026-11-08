# FFCS friend finder ("Find classmates")

Our version of [ffcs-finder.web.app](https://ffcs-finder.web.app/): see who
picked the same faculty and slot as you. It lives in the planner at
**FFCS → Friends → Find classmates**.

- Status: built, not deployed
- Frontend: `src/lib/ffcsClassmates.ts`, `src/components/custom/exams/FFCS/FFCSClassmatesSection.tsx`
- Backend (amazecc-api): `src/app/api/social/ffcs-match/route.ts`, `src/lib/ffcsMatch.ts`,
  `src/lib/ffcsMatchDb.ts`, `src/lib/ffcsReport.ts`

## What was wrong with the original

ffcs-finder is one HTML page talking straight to Firestore. You type in any
name, protect it with a 4-digit PIN (default `0000`), and pick subjects from
a list an admin types in by hand. So anyone can enter or edit anyone else's
entry, the browser can read every entry, and the course data is only as good
as the admin's typing.

## How ours works

| Concern         | ffcs-finder                                       | Ours                                                                                                                                                              |
| --------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Who you are     | Typed-in name + PIN                               | Your VTOP session. The server reads your name and reg no from VTOP's response (`identifyCaller`), never from the request.                                         |
| What you picked | Faculty/slot chosen from an admin-maintained list | Class ids from one of your planner timetables, checked against the semester's registration report, or your registered timetable read from VTOP (marked verified). |
| Matching        | In the browser, over everyone's data              | On the server. You get back only the people who share your sections.                                                                                              |
| Course data     | Typed in by an admin                              | The same report CSV the planner uses (`amazecc.com/ffcs/*.csv`).                                                                                                  |

**The unit of matching is the class id.** One class id is one section: a
course component taught by one faculty member in one slot. Holding the same
class id means being in the same class. The response lists each of your
sections with who's in it, plus a "most in common" ranking (two or more
shared sections, with identical timetables first).

**One request per action.** `POST /api/social/ffcs-match` takes
`op: get | publish | visibility | leave` and always returns your state plus
your matches, so opening the page is one function invocation and so is
saving.

## Privacy and abuse limits

The finder shows names, so it's built to stop someone reading out whole
section rosters:

- **Opt-in and reciprocal.** You only appear to people who share a section
  with you, and you only see others while you're visible yourself.
- **Minimal output.** Each person comes back as a handle, their VTOP name and
  a planned/registered flag. No reg no, no owner key, no other classes.
- **Plans must be plausible.** Every class must be in the report, with at
  most one section per course component, no slot clashes and at most 20
  classes. You can't submit every section of a course.
- **10 changes a day.** Enforced inside a single upsert, so concurrent
  requests can't exceed it (covered by `ffcsMatchDb.test.ts`). Republishing
  the same classes is free.
- **Pseudonymous storage.** Rows are keyed by `maskUserID(regNo)`, like the
  rest of social. Names come from `social_people` and are refreshed from VTOP
  on every call.

## Semesters

Only the final Winter and Fall 2026-27 lists are supported
(`FFCS_REPORT_FILES` in the API, `classmatesSemester` in the app). The winter
mock list shares the final list's class id prefix, but its ids aren't in the
final report, so the app asks students to switch lists instead of letting the
server reject every class. A new semester needs an entry in both places.

## Deploying

- No new environment variables. The API reads reports from
  `https://amazecc.com/ffcs/`, which can be overridden with
  `FFCS_REPORT_BASE_URL`.
- The table and GIN index (`ffcs_match_entries`) are created on first use,
  following the repo's inline-DDL convention.

## Follow-ups

- Each call makes one VTOP round trip to identify the caller, like the other
  social routes. If VTOP is slow during registration, a short-lived signed
  session token would remove it.
- Rate limiting per IP is in-memory per instance, as elsewhere in the API.
  The daily change cap in Postgres is the limit that actually holds.
- `socialDb.randomHandle` uses `Math.random()`. Handles are public, so this
  isn't a vulnerability, but `crypto.getRandomValues` would be the better
  choice.
- Deprecating friend timetable sharing (task 3 from the 2026-11-07 chat) can
  point people here for discovery and to shape links for viewing a plan.
