/**
 * The single primary-action accent for the MAIN FFCS planner.
 *
 * Generate, save and apply confirmations across the classic, modern and run
 * summary surfaces must read as the same action. The guided flow deliberately
 * keeps its own colorful identity, so this utility is not used there.
 *
 * Colour utilities only: callers keep their own size, radius, shadow and
 * weight classes, so unifying the accent does not change the type scale.
 */
export const PLANNER_ACTION_ACCENT = "bg-indigo-600 hover:bg-indigo-700 text-white";
