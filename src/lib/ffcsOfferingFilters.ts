import { getTimetableSchema } from "@/lib/campusSchema";
import { MORNING_BEFORE_MIN, periodsForSlot, splitSlots, type SlotPeriod } from "@/lib/slots";

/**
 * The timetable tab's offering filters: expand a slot string into its period
 * spans and decide whether an offering matches a morning/evening session
 * filter or one specific slot token. Pure slot math over `@/lib/slots`,
 * extracted verbatim from FFCSTimetableTab, its only importer.
 */

const getPeriodsForSlotOuter = (slotName: string) => periodsForSlot(getTimetableSchema(), slotName);

const getPeriodsForSlotsOuter = (slotStr: string): SlotPeriod[] => {
  return splitSlots(slotStr)
    .filter((s) => s !== "NIL")
    .flatMap(getPeriodsForSlotOuter);
};

export function matchesOfferingTimeFilter(slotStr: string, filter: string): boolean {
  if (filter === "all") return true;
  const slots = splitSlots(slotStr).filter((slot) => slot !== "NIL");
  const theorySlots = slots.filter((slot) => !slot.startsWith("L"));
  const labSlots = slots.filter((slot) => slot.startsWith("L"));
  const sessionSlots = theorySlots.length > 0 ? theorySlots : labSlots;
  const allIn = (items: string[], morning: boolean) =>
    items.length > 0 &&
    items.every((slot) => {
      const periods = getPeriodsForSlotsOuter(slot);
      return (
        periods.length > 0 &&
        periods.every((period) =>
          morning ? period.startMin < MORNING_BEFORE_MIN : period.startMin >= MORNING_BEFORE_MIN,
        )
      );
    });

  switch (filter) {
    // Session filters describe the theory session for combined offerings;
    // labs are filtered independently in the slot search sheet.
    case "morning_session":
    case "morning":
    case "morning_theory":
      return allIn(filter === "morning_session" ? sessionSlots : theorySlots, true);
    case "evening_session":
    case "evening":
    case "evening_theory":
      return allIn(filter === "evening_session" ? sessionSlots : theorySlots, false);
    case "morning_lab":
      return allIn(labSlots, true);
    case "evening_lab":
      return allIn(labSlots, false);
    default:
      return true;
  }
}

export function matchesSlotTokenFilter(slotStr: string, selectedToken: string, lab: boolean): boolean {
  if (!selectedToken) return true;
  return splitSlots(slotStr).some((slot) => slot === selectedToken && slot.startsWith("L") === lab);
}
