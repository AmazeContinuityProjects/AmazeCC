import React, { useEffect, useState } from "react";
import { Users, Check, Hash, Award } from "lucide-react";
import { FacultyAvatar, VitfacReviewPill } from "./FacultyReviewSheet";
import { CourseLock, ParsedCourse } from "../types";
import { offeringId, offeringMatches } from "../reports";
import { sameSlotFacultyAlternatives } from "../logic/generate";
import { splitSlots } from "@/lib/slots";
import { ListShell, ListRowText } from "../../../shared/primitives";
import { ENABLE_VITFAC_INTEGRATION, getFacultyReview, loadVitfacCatalog } from "@/lib/vitfacService";

interface Offering {
  faculty: string;
  slot: string;
  venue: string;
  employeeId: string;
  classId: string;
  legacyId: string;
  id: string;
}

interface TargetCourseLockerProps {
  course: { code: string; title: string };
  masterCourses: ParsedCourse[];
  selection: CourseLock;
  onChange: (next: CourseLock) => void;
  /**
   * Where the offering list scrolls.
   *
   * - `"page"` (default): no cap — the list grows with its content and the
   *   surrounding page scrolls it. This is the target course page itself, so
   *   on a phone the faculty list takes the full screen instead of living in
   *   a short inner scroll box.
   * - `"sheet"`: a capped inner scroll area, for the classic-mode mobile
   *   BottomSheet where the panel has to stay on screen and the sheet owns
   *   the list's overflow.
   */
  scrollArea?: "page" | "sheet";
}

/**
 * The theory half of a slot. An embedded course books `A1+TA1`; its theory
 * slot is `A1` and the lab tag rides along. Slot grouping buckets on this, so
 * every embedded variant of a theory slot lands under one header.
 */
const theorySlotOf = (slot: string) => splitSlots(slot)[0] ?? "";

export const TargetCourseLocker: React.FC<TargetCourseLockerProps> = ({
  course,
  masterCourses,
  selection,
  onChange,
  scrollArea = "page",
}) => {
  const courseOpts = masterCourses.filter((mc) => mc.CODE === course.code);
  const uniqueOfferings = Array.from(
    new Map(
      courseOpts.map((opt) => {
        const legacyId = `${opt.FACULTY}|${opt.SLOT}|${opt.ROOM}`;
        const id = offeringId(opt);
        return [
          id,
          {
            faculty: opt.FACULTY,
            slot: opt.SLOT,
            venue: opt.ROOM,
            employeeId: opt.ERP_ID || "",
            classId: opt.CLASS_ID || "",
            legacyId,
            id,
          },
        ];
      }),
    ).values(),
  ).sort(
    (a, b) =>
      a.faculty.localeCompare(b.faculty) || a.slot.localeCompare(b.slot) || a.employeeId.localeCompare(b.employeeId),
  );

  const offeringsByFac = uniqueOfferings.reduce(
    (acc, curr) => {
      if (!acc[curr.faculty]) acc[curr.faculty] = [];
      acc[curr.faculty].push(curr);
      return acc;
    },
    {} as Record<string, Offering[]>,
  );

  // The vitfac catalog loads async; flip a bit when it lands so the faculty
  // order re-ranks from alphabetical to review-ranked on the same mount.
  const [catalogReady, setCatalogReady] = useState(false);
  useEffect(() => {
    if (!ENABLE_VITFAC_INTEGRATION) return;
    let active = true;
    loadVitfacCatalog()
      .then(() => {
        if (active) setCatalogReady(true);
      })
      .catch(() => {
        /* offline: stay alphabetical */
      });
    return () => {
      active = false;
    };
  }, []);

  /**
   * Faculty rank from vitfac reviews: overall W% first, more reviews wins a
   * tie. Unrated faculty sort after every rated one (rank 0), alphabetically —
   * an absence of reviews is not a bad review.
   */
  const rankOf = (fac: string, sample: Offering | undefined): { wPct: number; reviews: number } => {
    if (!ENABLE_VITFAC_INTEGRATION || !sample) return { wPct: -1, reviews: 0 };
    const review = getFacultyReview({ employeeId: sample.employeeId, name: fac });
    if (!review || review.reviews <= 0) return { wPct: -1, reviews: 0 };
    return { wPct: review.wPct ?? -1, reviews: review.reviews };
  };

  const rankedFacs = Object.keys(offeringsByFac)
    .map((fac) => ({ fac, rank: rankOf(fac, offeringsByFac[fac][0]) }))
    .sort((a, b) => {
      // catalogReady is read (not just a dep) so alphabetical-before-load is
      // the intentional pre-ranking order.
      if (!catalogReady) return a.fac.localeCompare(b.fac);
      return b.rank.wPct - a.rank.wPct || b.rank.reviews - a.rank.reviews || a.fac.localeCompare(b.fac);
    });

  // 1-based rank among rated faculty, shown as the entry's badge.
  const rankNumber = new Map<string, number>();
  let ratedSeen = 0;
  for (const { fac, rank } of rankedFacs) {
    if (rank.wPct >= 0) {
      ratedSeen += 1;
      rankNumber.set(fac, ratedSeen);
    }
  }

  const sortedFacs = rankedFacs.map((r) => r.fac);

  // The same vitfac ranking drives the faculty grouping order AND the order of
  // rows inside each slot bucket, so "who teaches A1, best first" holds in
  // both groupings.
  const rankByFaculty = new Map(rankedFacs.map((r) => [r.fac, r.rank]));
  const compareFacsByRank = (a: string, b: string): number => {
    if (!catalogReady) return a.localeCompare(b);
    const ra = rankByFaculty.get(a) ?? { wPct: -1, reviews: 0 };
    const rb = rankByFaculty.get(b) ?? { wPct: -1, reviews: 0 };
    return rb.wPct - ra.wPct || rb.reviews - ra.reviews || a.localeCompare(b);
  };

  // Grouped by the THEORY slot: `A1+TA1` and `A1+TB1` both bucket under `A1`.
  const offeringsByTheorySlot = uniqueOfferings.reduce(
    (acc, curr) => {
      const theory = theorySlotOf(curr.slot);
      if (!acc[theory]) acc[theory] = [];
      acc[theory].push(curr);
      return acc;
    },
    {} as Record<string, Offering[]>,
  );
  for (const bucket of Object.values(offeringsByTheorySlot)) {
    bucket.sort(
      (a, b) =>
        compareFacsByRank(a.faculty, b.faculty) ||
        a.slot.localeCompare(b.slot) ||
        a.employeeId.localeCompare(b.employeeId),
    );
  }
  const sortedTheorySlots = Object.keys(offeringsByTheorySlot).sort();

  const availableSeries = Array.from(
    new Set(
      uniqueOfferings
        .map((o) => {
          const match = theorySlotOf(o.slot).match(/^[T]?([A-G])/);
          return match ? match[1] : null;
        })
        .filter(Boolean) as string[],
    ),
  ).sort();

  const updateOfferings = (next: string[]) => {
    onChange({ ...selection, offerings: next });
  };

  // How the offering list buckets its rows: under each faculty (default) or
  // under each theory slot, so a student can scan "who teaches A1?" at a glance.
  const [offeringGroupBy, setOfferingGroupBy] = useState<"faculty" | "slot">("faculty");

  const groupToggle = (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-bold text-text-heading/70 uppercase">Group by</span>
      {(
        [
          { id: "faculty", label: "Faculty" },
          { id: "slot", label: "Slot" },
        ] as const
      ).map((opt) => (
        <button
          key={opt.id}
          type="button"
          aria-pressed={offeringGroupBy === opt.id}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOfferingGroupBy(opt.id);
          }}
          className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
            offeringGroupBy === opt.id
              ? "bg-amber-500 text-white shadow-sm"
              : "bg-surface-secondary hover:bg-surface-secondary/80 text-text-heading/70"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {availableSeries.length > 0 && (
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-text-heading/70 mb-1.5 uppercase">Quick Select Series</div>
            <div className="flex flex-wrap gap-1.5">
              {availableSeries.map((series) => {
                const seriesOfferings = uniqueOfferings.filter((o) => {
                  const match = theorySlotOf(o.slot).match(/^[T]?([A-G])/);
                  return match && match[1] === series;
                });
                const allSelected = seriesOfferings.every((o) =>
                  offeringMatches(
                    { FACULTY: o.faculty, SLOT: o.slot, ROOM: o.venue, ERP_ID: o.employeeId },
                    selection.offerings || [],
                  ),
                );
                return (
                  <button
                    key={series}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      let newOfferings = [...(selection.offerings || [])];
                      if (allSelected) {
                        const removing = new Set(seriesOfferings.flatMap((o) => [o.id, o.legacyId]));
                        newOfferings = newOfferings.filter((id) => !removing.has(id));
                      } else {
                        seriesOfferings.forEach((o) => {
                          if (!newOfferings.includes(o.id)) newOfferings.push(o.id);
                        });
                      }
                      updateOfferings(newOfferings);
                    }}
                    className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                      allSelected
                        ? "bg-amber-500 text-white shadow-sm"
                        : "bg-surface-secondary hover:bg-surface-secondary/80 text-text-heading/70"
                    }`}
                  >
                    {series} Series
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {groupToggle}
      </div>

      {/* On the target course page the list grows with its content and the page
          scrolls it — a capped inner scroll box would squeeze the faculty list
          into a fraction of a phone screen. Inside the classic-mode mobile
          BottomSheet (`scrollArea="sheet"`) there is no page to scroll, so
          that usage keeps its own capped scroll area instead. */}
      <div
        className={`flex flex-col gap-3 bg-surface/50 border border-border-strong/50 rounded-lg p-3 ${
          scrollArea === "sheet"
            ? "overflow-y-auto max-h-60 lg:max-h-none lg:overflow-visible custom-scrollbar pr-1"
            : ""
        }`}
      >
        {offeringGroupBy === "faculty" && (
          <>
            {catalogReady && rankedFacs.some((r) => r.rank.wPct >= 0) && (
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                <Award className="w-3 h-3 shrink-0" />
                Ranked by vitfac reviews
              </div>
            )}
            {sortedFacs.map((fac) => (
              <section key={fac} aria-label={`Offerings by ${fac}`} className="space-y-1.5">
                <div className="text-xs font-semibold text-text-heading/90 pb-1 border-b border-border-strong/50 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {rankNumber.has(fac) && (
                      <span
                        className={`shrink-0 min-w-5 h-5 px-1 rounded-full text-[10px] font-black flex items-center justify-center ${
                          rankNumber.get(fac) === 1
                            ? "bg-amber-500 text-white"
                            : "bg-surface-secondary text-muted-foreground border border-border-strong"
                        }`}
                        title={`Rank #${rankNumber.get(fac)} by overall W%`}
                      >
                        #{rankNumber.get(fac)}
                      </span>
                    )}
                    <FacultyAvatar employeeId={offeringsByFac[fac][0]?.employeeId} name={fac} size="xs" tone="amber" />
                    <span className="truncate">{fac}</span>
                  </div>
                  <VitfacReviewPill
                    employeeId={offeringsByFac[fac][0]?.employeeId}
                    name={fac}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  />
                </div>
                <ListShell>
                  {offeringsByFac[fac].map((offering) => (
                    <OfferingRow
                      key={offering.id}
                      offering={offering}
                      course={course}
                      masterCourses={masterCourses}
                      selection={selection}
                      onChange={onChange}
                      leading="slot"
                    />
                  ))}
                </ListShell>
              </section>
            ))}
          </>
        )}

        {offeringGroupBy === "slot" && (
          <>
            {catalogReady && rankedFacs.some((r) => r.rank.wPct >= 0) && (
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                <Award className="w-3 h-3 shrink-0" />
                Faculties ranked by vitfac reviews within each slot
              </div>
            )}
            {sortedTheorySlots.map((theory) => (
              <section key={theory} aria-label={`Faculty teaching ${theory}`} className="space-y-1.5">
                <div className="text-xs font-semibold text-text-heading/90 pb-1 border-b border-border-strong/50 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                      <Hash className="w-3 h-3" />
                    </span>
                    <span className="truncate">{theory}</span>
                    <span className="text-[10px] font-medium text-muted-foreground">theory</span>
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground shrink-0">
                    {new Set(offeringsByTheorySlot[theory].map((o) => o.faculty)).size} fac
                  </span>
                </div>
                <ListShell>
                  {offeringsByTheorySlot[theory].map((offering) => (
                    <OfferingRow
                      key={offering.id}
                      offering={offering}
                      course={course}
                      masterCourses={masterCourses}
                      selection={selection}
                      onChange={onChange}
                      leading="faculty"
                      showFullSlot={theorySlotOf(offering.slot) !== offering.slot.trim().toUpperCase()}
                      rank={rankNumber.get(offering.faculty)}
                    />
                  ))}
                </ListShell>
              </section>
            ))}
          </>
        )}
      </div>
      {selection.offerings && selection.offerings.length > 0 && (
        <div className="text-xs text-amber-500 mt-2 font-medium">
          Filtering by {selection.offerings.length} selected offering{selection.offerings.length === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
};

/**
 * One selectable offering, styled like the planner home's widget menu entry:
 * a ListShell row with a leading tile, title + subtitle, and a tick on the
 * right when selected. The native checkbox stays `sr-only` behind the tile so
 * keyboard users and tests still reach it.
 *
 * `leading="slot"` puts the slot badge in the tile (faculty grouping, where
 * the faculty name is already the header); `leading="faculty"` puts the
 * faculty avatar there (slot grouping, where the slot is the header).
 */
const OfferingRow: React.FC<{
  offering: Offering;
  course: { code: string };
  masterCourses: ParsedCourse[];
  selection: CourseLock;
  onChange: (next: CourseLock) => void;
  leading: "slot" | "faculty";
  showFullSlot?: boolean;
  /** VITFAC rank of this faculty among the course's rated faculty, if any. */
  rank?: number;
}> = ({ offering, course, masterCourses, selection, onChange, leading, showFullSlot, rank }) => {
  const isOffChecked = offeringMatches(
    { FACULTY: offering.faculty, SLOT: offering.slot, ROOM: offering.venue, ERP_ID: offering.employeeId },
    selection.offerings || [],
  );
  const altCount =
    1 +
    sameSlotFacultyAlternatives(
      course.code,
      splitSlots(offering.slot),
      { faculty: offering.faculty, employeeId: offering.employeeId },
      masterCourses,
    ).length;
  const venue = offering.venue || (offering.employeeId ? `ERP ${offering.employeeId}` : "TBA");

  const tile =
    leading === "slot" ? (
      <span className="w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[11px] font-bold">
        {theorySlotOf(offering.slot)}
      </span>
    ) : (
      <span className="w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 bg-surface-secondary/70 dark:bg-surface-secondary/40 border-border-strong overflow-hidden">
        <FacultyAvatar employeeId={offering.employeeId} name={offering.faculty} size="sm" tone="amber" />
      </span>
    );

  return (
    <label
      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-inset focus-within:ring-amber-500/40 ${
        isOffChecked ? "bg-amber-500/10" : "hover:bg-surface-secondary/60"
      }`}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={isOffChecked}
        onChange={(e) => {
          if (e.target.checked) {
            const next = (selection.offerings || []).filter((id) => id !== offering.id);
            onChange({ ...selection, offerings: [...next, offering.id] });
          } else {
            onChange({
              ...selection,
              offerings: (selection.offerings || []).filter((id) => id !== offering.id && id !== offering.legacyId),
            });
          }
        }}
      />
      {tile}
      <ListRowText
        title={leading === "slot" ? offering.slot : offering.faculty}
        titleTag="span"
        titleTooltip={leading === "slot" ? offering.slot : offering.faculty}
        subtitle={
          leading === "slot"
            ? `${venue} · ${altCount} fac this slot`
            : `${showFullSlot ? offering.slot : theorySlotOf(offering.slot)} · ${venue} · ${altCount} fac`
        }
        wrapSubtitle
      />
      {leading === "faculty" && (
        <VitfacReviewPill
          employeeId={offering.employeeId}
          name={offering.faculty}
          onClick={(e) => {
            // The row is a <label>; a click on the pill must not toggle it.
            e.preventDefault();
            e.stopPropagation();
          }}
        />
      )}
      {isOffChecked ? (
        <span className="w-5 h-5 rounded bg-amber-500 text-white flex items-center justify-center shrink-0">
          <Check className="w-3.5 h-3.5" strokeWidth={3} />
        </span>
      ) : typeof rank === "number" ? (
        <span
          className={`inline-flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.5 rounded shrink-0 ${
            rank === 1
              ? "bg-amber-500 text-white"
              : "bg-surface-secondary/70 border border-border-strong/70 text-muted-foreground"
          }`}
          title={`Rank #${rank} of rated faculty by overall W%`}
        >
          <Users className="w-2.5 h-2.5 shrink-0" />
          <span>{rank}</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface-secondary/70 border border-border-strong/70 text-muted-foreground shrink-0">
          <Users className="w-2.5 h-2.5 text-muted-foreground/60 shrink-0" />
          <span>{altCount}</span>
        </span>
      )}
    </label>
  );
};

export default TargetCourseLocker;
