import { describe, expect, it } from "vitest";
import {
  daysUntil,
  eventDateLabel,
  isFreeEvent,
  isRegistrationPaid,
  parseEventDate,
  summariseEvents,
  type EventLike,
} from "../lib/eventhub";

/**
 * Event Hub metrics.
 *
 * These are the counts the Event Hub hero tiles are made of, and all three
 * inputs are loose: `date` is whatever Event Hub rendered that month, a blank
 * `price` means free, and a payment state arrives as free text. The date maths
 * is the risky part — a "next 7 days" tile that reads UTC midnight as local
 * puts an event on the wrong day, and an unreadable date must blank the tile
 * rather than report a confident zero.
 */

const day = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
};

const NOW = new Date(2026, 6, 10); // 10 Jul 2026, local

describe("parseEventDate", () => {
  it("reads date-only ISO as a local calendar day", () => {
    // Not UTC midnight: `new Date("2026-07-15")` is the 14th anywhere west of
    // Greenwich, which would silently move an event a day early.
    expect(parseEventDate("2026-07-15")).toBe(day("2026-07-15"));
  });

  it("reads day-first dates with a numeric or textual month", () => {
    expect(parseEventDate("15-07-2026")).toBe(day("2026-07-15"));
    expect(parseEventDate("15/07/2026")).toBe(day("2026-07-15"));
    expect(parseEventDate("15-Jul-2026")).toBe(day("2026-07-15"));
    expect(parseEventDate("15-JULY-2026")).toBe(day("2026-07-15"));
  });

  it("accepts a full ISO timestamp", () => {
    const ts = parseEventDate("2026-07-15T18:30:00");
    expect(ts).toBe(day("2026-07-15"));
  });

  it("returns null rather than guessing", () => {
    expect(parseEventDate(undefined)).toBeNull();
    expect(parseEventDate(null)).toBeNull();
    expect(parseEventDate("")).toBeNull();
    expect(parseEventDate("   ")).toBeNull();
    expect(parseEventDate("TBA")).toBeNull();
    expect(parseEventDate("Registrations close soon")).toBeNull();
  });

  it("rejects days that do not exist instead of rolling them forward", () => {
    // `new Date(2026, 1, 31)` is 3 Mar, which would invent a March event.
    expect(parseEventDate("31-02-2026")).toBeNull();
  });
});

describe("eventDateLabel", () => {
  it("formats a readable date", () => {
    expect(eventDateLabel("2026-07-15")).toBe("Wed, Jul 15");
  });

  it("passes an unreadable value through rather than hiding it", () => {
    expect(eventDateLabel("Date TBA")).toBe("Date TBA");
  });

  it("has something to show when there is no date at all", () => {
    expect(eventDateLabel(undefined)).toBe("Date TBA");
  });
});

describe("daysUntil", () => {
  it("counts whole days, including today and tomorrow", () => {
    expect(daysUntil("2026-07-10", NOW)).toBe(0);
    expect(daysUntil("2026-07-11", NOW)).toBe(1);
    expect(daysUntil("2026-07-17", NOW)).toBe(7);
  });

  it("counts backwards for a past date", () => {
    expect(daysUntil("2026-07-08", NOW)).toBe(-2);
  });

  it("is null when the date is unreadable", () => {
    expect(daysUntil("sometime", NOW)).toBeNull();
  });
});

describe("isFreeEvent", () => {
  it("treats a blank price as free, the way the detail page does", () => {
    expect(isFreeEvent({ price: "" })).toBe(true);
    expect(isFreeEvent({ price: undefined })).toBe(true);
    expect(isFreeEvent({})).toBe(true);
  });

  it("reads the word, in any case", () => {
    expect(isFreeEvent({ price: "Free" })).toBe(true);
    expect(isFreeEvent({ price: "FREE ENTRY" })).toBe(true);
    expect(isFreeEvent({ price: "No cost" })).toBe(true);
  });

  it("is not free when a fee is quoted", () => {
    expect(isFreeEvent({ price: "₹150" })).toBe(false);
    expect(isFreeEvent({ price: "Paid" })).toBe(false);
  });
});

describe("isRegistrationPaid", () => {
  it("accepts the statuses the Pay Now button treats as settled", () => {
    expect(isRegistrationPaid({ paymentStatus: "Paid (Online)" })).toBe(true);
    expect(isRegistrationPaid({ paymentStatus: "Free" })).toBe(true);
    // Event Hub uses this alongside "Paid" for gateway completions.
    expect(isRegistrationPaid({ paymentStatus: "Success" })).toBe(true);
  });

  it("is not settled without a status", () => {
    expect(isRegistrationPaid(undefined)).toBe(false);
    expect(isRegistrationPaid({})).toBe(false);
    expect(isRegistrationPaid({ paymentStatus: "  " })).toBe(false);
    expect(isRegistrationPaid({ paymentStatus: "Pending" })).toBe(false);
  });
});

describe("summariseEvents", () => {
  const events: EventLike[] = [
    { eid: "1", title: "Hackathon", type: "Coding Hackathon", date: "2026-07-12", price: "Free" },
    { eid: "2", title: "RoboSoccer", type: "Robotics Workshop", date: "2026-07-22", price: "₹150" },
    { eid: "3", title: "Futsal", type: "Sports", date: "2026-08-30", price: "Free" },
  ];

  it("counts totals, free entries and categories", () => {
    const s = summariseEvents(events, [], NOW);
    expect(s.total).toBe(3);
    expect(s.free).toBe(2);
    expect(s.categories).toBe(3);
  });

  it("counts the seven-day window and names the next event", () => {
    const s = summariseEvents(events, [], NOW);
    // 12 Jul is 2 days out; 22 Jul is outside the week.
    expect(s.thisWeek).toBe(1);
    expect(s.next?.event.eid).toBe("1");
    expect(s.next?.days).toBe(2);
  });

  it("reports a genuine zero when nothing falls in the week", () => {
    const far = summariseEvents([{ eid: "1", date: "2026-12-01" }], [], NOW);
    expect(far.thisWeek).toBe(0);
    expect(far.next?.event.eid).toBe("1");
  });

  it("omits the date-dependent stats when no date is readable", () => {
    // "None of them are scheduled this week" and "we cannot tell when any of
    // them are" are different claims, and only the first one is a zero.
    const undated = summariseEvents([{ eid: "1" }, { eid: "2" }], [], NOW);
    expect(undated.thisWeek).toBeNull();
    expect(undated.next).toBeNull();
    expect(undated.total).toBe(2);
  });

  it("ignores concluded events when looking forward", () => {
    const past = summariseEvents(
      [
        { eid: "1", date: "2026-07-11", isPastEvent: true },
        { eid: "2", date: "2026-08-01" },
      ],
      [],
      NOW
    );
    expect(past.next?.event.eid).toBe("2");
    // The concluded one is still listed, so `total` counts it.
    expect(past.total).toBe(2);
  });

  it("counts registrations whose payment has not settled", () => {
    const registered = [
      { paymentStatus: "Paid (Online)" },
      { paymentStatus: "Pending" },
      { orderId: "ORD-1" },
    ];
    expect(summariseEvents(events, registered, NOW).unpaid).toBe(2);
    expect(summariseEvents(events, [], NOW).unpaid).toBe(0);
  });

  it("survives a missing list", () => {
    const s = summariseEvents(null, undefined, NOW);
    expect(s.total).toBe(0);
    expect(s.categories).toBe(0);
    expect(s.next).toBeNull();
    expect(s.thisWeek).toBeNull();
  });
});
