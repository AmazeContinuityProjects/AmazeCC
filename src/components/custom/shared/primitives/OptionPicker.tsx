"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@amazecontinuityprojects/amazeui";

/**
 * The option picker, owned by this repo.
 *
 * This is amazeui's `OptionPicker` re-homed, not redesigned: same props, same trigger,
 * same list, same search. It exists because two defects live in the amazeui internals
 * and that package is a published dependency this repo must never patch:
 *
 * 1. **Stacking.** The popup portal paints at `z-50`. Anything above it — the
 *    `BottomSheet` shell (`z-55`/`z-60`), fullscreen modals, and (until it was
 *    lowered) the mobile bottom nav (`z-55`) — buries the popup *and* its backdrop.
 *    A picker inside a sheet opened underneath its own host: invisible list,
 *    untappable backdrop. This version paints at `z-[70]`: above every sheet, and no
 *    picker currently lives inside anything higher. If one ever lands inside a
 *    `z-100`+ modal, that call site needs a non-overlay control (`SegmentedControl`,
 *    `ChipTabs`), not a bigger number here — see the note on `SelectField`.
 * 2. **Mobile dismiss.** Under 768px amazeui renders a bottom-sheet-style modal whose
 *    dim layer carries no tap handler, so outside-tap never dismisses there — only
 *    Escape and option-select do. Both variants here dismiss on backdrop tap *and*
 *    Escape.
 *
 * Deliberately *not* changed from the original, so the ~25 call sites behave
 * identically: the trigger keeps its hard-coded chrome (callers restyle through the
 * wrapper, see `OPTION_PICKER_TRIGGER`), options stay `<button>`s, the search filter
 * still matches label and value case-insensitively, and `disabled` still only gates
 * the whole field without setting the attribute. Visual classes are untouched too —
 * this migration is about the overlay mechanics, not a retint.
 */

export interface OptionPickerOption {
  value: string;
  label: string;
}

interface OptionPickerProps {
  className?: string;
  value: string;
  onChange: (value: string) => void;
  options: OptionPickerOption[];
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
}

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

/** Overlay chrome shared by both width variants. */
const OVERLAY_Z = "z-[70]";

const OptionPicker = forwardRef<HTMLDivElement, OptionPickerProps>(function OptionPicker(
  {
    className,
    value,
    onChange,
    options,
    placeholder = "Select...",
    searchable = true,
    disabled = false,
  },
  ref
) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const isMobile = useIsMobile();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, height: 320 });
  const [mobilePopupHeight, setMobilePopupHeight] = useState(600);

  const selected = options.find((o) => o.value === value);
  const filtered = query
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          o.value.toLowerCase().includes(query.toLowerCase())
      )
    : options;

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      if (isMobile) {
        setMobilePopupHeight(Math.min(640, window.innerHeight * 0.85));
        return;
      }
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const below = Math.max(80, window.innerHeight - rect.bottom - 12);
      const above = Math.max(80, rect.top - 12);
      const openAbove = below < Math.min(240, options.length * 44) && above > below;
      const height = Math.min(320, openAbove ? above : below);
      setPosition({
        top: openAbove ? rect.top - height - 6 : rect.bottom + 6,
        left: rect.left,
        width: rect.width,
        height,
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
    };
  }, [open, isMobile, options.length]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Escape dismisses on both variants. amazeui only had it on the mobile modal
  // (via `onRequestClose`); the desktop portal had no key handling at all.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open ]);

  const handleSelect = (opt: OptionPickerOption) => {
    onChange(opt.value);
    setOpen(false);
  };

  const listContent = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {searchable && (
        <div className="relative shrink-0 border-b border-border">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            autoFocus
            className="w-full bg-transparent pl-10 pr-10 py-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1 touch-pan-y"
        role="listbox"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {filtered.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground/50">No options found</p>
          </div>
        ) : (
          filtered.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => handleSelect(opt)}
                className={cn(
                  "flex flex-row items-center gap-3 px-4 py-3 transition-colors mx-1 rounded-lg w-[calc(100%-8px)] text-left cursor-pointer",
                  active
                    ? "bg-info/10 text-info font-semibold"
                    : "text-foreground hover:bg-muted/70"
                )}
              >
                <span className={cn("text-sm flex-1", active ? "font-semibold" : "font-medium")}>
                  {opt.label}
                </span>
                {active && <span className="w-2 h-2 rounded-full bg-info shrink-0" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen(true)}
        className={cn(
          "flex flex-row items-center justify-between gap-2 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted/30",
          !selected && "text-muted-foreground/60"
        )}
      >
        <span className="truncate text-sm">{selected ? selected.label : placeholder}</span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-muted-foreground/60 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        !isMobile &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <button
              type="button"
              aria-label="Dismiss options"
              onClick={() => setOpen(false)}
              className={`fixed inset-0 ${OVERLAY_Z} cursor-default bg-transparent border-none p-0`}
            />
            <div
              className={cn(
                `fixed ${OVERLAY_Z} bg-popover border border-border rounded-xl shadow-xl overflow-hidden`,
                "animate-in fade-in slide-in-from-top-2 duration-200",
                "min-w-[240px] min-h-0"
              )}
              style={{
                top: position.top,
                left: position.left,
                width: Math.max(position.width, 240),
                height: position.height,
              }}
            >
              <div className="h-full min-h-0 flex flex-col">{listContent}</div>
            </div>
          </>,
          document.body
        )}

      {open && isMobile && typeof document !== "undefined" &&
        createPortal(
          <div className={`fixed inset-0 ${OVERLAY_Z} flex items-center justify-center p-4`}>
            {/* The dim layer dismisses — amazeui's mobile modal had no tap handler
                here, so outside-tap did nothing on phones. */}
            <button
              type="button"
              aria-label="Dismiss options"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/60 border-none p-0 cursor-default"
            />
            <div
              role="dialog"
              aria-modal="true"
              className="relative w-full max-w-md min-h-0 bg-background rounded-2xl border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
              style={{ height: mobilePopupHeight, maxHeight: "85dvh" }}
            >
              {listContent}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
});

OptionPicker.displayName = "OptionPicker";

export default OptionPicker;
