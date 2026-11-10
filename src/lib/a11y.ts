import type { KeyboardEvent, SyntheticEvent } from "react";

/**
 * Props that make a non-button element (a card, a row, a calendar cell)
 * behave like a button for keyboard and screen-reader users: focusable,
 * announced as a button, and activated by Enter or Space.
 *
 *   <div {...clickable(() => open(course))} className="...">
 *
 * Prefer a real <button> for new code. This exists for clickable layout
 * containers that hold their own buttons or block content, where swapping the
 * element would change layout or nest interactive elements.
 *
 * Keys pressed on a focused child (an inner button, an input) are ignored, so
 * Enter on an inner "Delete" button does not also open the card.
 */
export function clickable<E extends Element = HTMLElement>(
  onActivate: ((e: SyntheticEvent<E>) => void) | undefined | null,
) {
  if (!onActivate) return {};
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (e: KeyboardEvent<E>) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate(e);
      }
    },
  };
}
