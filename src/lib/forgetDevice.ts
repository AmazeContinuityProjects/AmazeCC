import { KEYS } from "./storage";

/**
 * Fired on `window` after a sign-out that did not come through `Main`'s own
 * logout path, so the home entry controller can return to the landing page.
 */
export const SIGNED_OUT_EVENT = "amazecc:signed-out";

/**
 * Every localStorage key that holds a login, a password or a session token.
 *
 * "Forget my logins" removes exactly these and nothing else, so a student can
 * sign out on a shared or borrowed device without losing what they built
 * locally: tasks, saved FFCS plans, friends, settings and theme. The normal
 * sign-out still clears everything.
 *
 * When a new credential is stored anywhere in the app, add its key here.
 */
export const CREDENTIAL_KEYS: readonly string[] = [
  KEYS.IDS,
  KEYS.USERNAME,
  KEYS.PASSWORD,
  KEYS.MOODLE_USERNAME,
  KEYS.MOODLE_PASSWORD,
  KEYS.KOHA_CARD,
  KEYS.KOHA_PASSWORD,
  KEYS.VITOL_USERNAME,
  KEYS.VITOL_PASSWORD,
  KEYS.EVENT_HUB_SESSION,
  KEYS.CABSHARE_USER,
  KEYS.DEMO_MODE,
];

/**
 * Remove stored logins and session tokens. Returns the keys that were present,
 * so callers (and tests) can see what was actually forgotten.
 */
export function forgetStoredCredentials(store: Pick<Storage, "getItem" | "removeItem"> = localStorage): string[] {
  const removed: string[] = [];
  for (const key of CREDENTIAL_KEYS) {
    try {
      if (store.getItem(key) !== null) {
        store.removeItem(key);
        removed.push(key);
      }
    } catch {
      /* storage blocked: nothing to remove */
    }
  }
  return removed;
}
