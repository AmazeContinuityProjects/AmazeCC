/**
 * Handle parsing and validation.
 *
 * A handle is `AMZ-XXXX-XXXX` over a Crockford-style alphabet with no `I`, `L`,
 * `O` or `U`, so it survives being read aloud or typed from a screenshot. It is
 * minted by the server on the first successful derivation and is the only thing
 * two students exchange.
 *
 * The normaliser exists because people paste handles in whatever shape they have
 * to hand — `AMZ-7K2P-9RTW`, `AMZ 7K2P 9RTW`, or just `7K2P9RTW`. It has one
 * overriding rule: **never mangle something already valid.** A previous version
 * stripped the separators and only re-inserted them below a length threshold, so
 * a complete pasted handle came back as `AMZAZ1VCDJG` and was then rejected as
 * malformed — the user was told their own correct handle was the wrong shape.
 */

export const HANDLE_RE = /^AMZ-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

/** Letters excluded from the alphabet, for an error message if one is needed. */
export const HANDLE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function isValidHandle(value: string | null | undefined): boolean {
  return HANDLE_RE.test(String(value ?? "").toUpperCase());
}

/**
 * Tidy user input into a handle, or return it untouched if it cannot be.
 *
 * Deliberately never invents characters: if the result would not be valid, the
 * original is handed back so the validation message describes what the user
 * actually typed rather than what we made of it.
 */
export function normaliseHandle(raw: string | null | undefined): string {
  const upper = String(raw ?? "").toUpperCase();
  if (HANDLE_RE.test(upper)) return upper;

  // Drop an optional AMZ prefix and every separator, then re-lay the body out as
  // the two four-character groups.
  const body = upper.replace(/^AMZ/, "").replace(/[^A-Z0-9]/g, "");
  if (body.length === 8) {
    const candidate = `AMZ-${body.slice(0, 4)}-${body.slice(4)}`;
    if (HANDLE_RE.test(candidate)) return candidate;
  }
  return upper;
}

/** True when `candidate` is the viewer's own handle. */
export function isSelfHandle(candidate: string | null | undefined, myHandle: string | null | undefined): boolean {
  if (!myHandle) return false;
  return normaliseHandle(candidate) === myHandle;
}
