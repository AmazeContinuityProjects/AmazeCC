/**
 * Timetable sharing is full-detail only.
 *
 * The pair sheet used to offer a coarse/full choice, and Pairs exposed a
 * per-grant toggle. Sharing every timetable at full detail is now the product
 * rule, so the choice is gone. Grants minted before that change are still
 * `coarse` on the server, which is why this module exists: it raises them to
 * full once the sharing UI mounts, instead of leaving the user's existing pairs
 * on the old redacted view with no way to fix them.
 *
 * The visibility flag is shared by both sides of a pairing, so an upgrade also
 * lets the peer see course detail. That is intended — a pair should not be
 * half-full and half-coarse.
 */

import { setGrantVisibility, type StoredGrant } from "./client";

/**
 * One upgrade pass at a time. `SocialTab` is mounted by both More and Tools,
 * and both mounts run the effect; without this guard the same grant would be
 * PATCHed twice for no reason.
 */
let inFlight: Promise<StoredGrant[]> | null = null;

/**
 * Raise every coarse grant in `grants` to full.
 *
 * Resolves the grants that were actually upgraded, so the caller can update
 * exactly those rows locally. A failure on one grant is deliberately not fatal:
 * the rest still upgrade, and the failed one is retried the next time the
 * sharing UI mounts.
 */
export function upgradeGrantsToFull(grants: readonly StoredGrant[]): Promise<StoredGrant[]> {
  const coarse = grants.filter((grant) => grant.visibility !== "full");
  if (coarse.length === 0) return Promise.resolve([]);
  if (inFlight) return inFlight;

  const run = (async () => {
    const upgraded: StoredGrant[] = [];
    for (const grant of coarse) {
      try {
        await setGrantVisibility(grant.grantId, "full");
        upgraded.push({ ...grant, visibility: "full" });
      } catch {
        // Leave this grant coarse for now. Reads still work, just redacted.
      }
    }
    return upgraded;
  })();

  const tracked = run.finally(() => {
    inFlight = null;
  });
  inFlight = tracked;
  return tracked;
}
