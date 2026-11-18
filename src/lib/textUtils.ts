/**
 * Canonical Text & Name Utilities.
 *
 * Single source of truth for:
 * - Extracting user and faculty initials
 * - Formatting names cleanly
 */

export interface InitialsOptions {
  maxChars?: number;
  fallback?: string;
  stripTitles?: boolean;
}

/**
 * Derives a clean uppercase initials string from any user or faculty name.
 * Handles "Dr.", "Prof.", "Mr.", "Mrs.", multiple middle names, and empty inputs.
 */
export function getInitials(name: string | null | undefined, options: InitialsOptions = {}): string {
  const { maxChars = 2, fallback = "?", stripTitles = true } = options;

  if (!name || typeof name !== "string") return fallback;

  let clean = name.trim();
  if (!clean) return fallback;

  if (stripTitles) {
    clean = clean.replace(/^(dr|prof|mr|mrs|ms)\.?\s+/i, "");
  }

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;

  if (parts.length === 1) {
    return parts[0].slice(0, maxChars).toUpperCase();
  }

  // Take first character of first name + first character of last name
  const first = parts[0][0];
  const last = parts[parts.length - 1][0];

  return `${first}${last}`.slice(0, maxChars).toUpperCase();
}
