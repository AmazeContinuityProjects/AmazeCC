import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StopsTimeline } from "@/components/custom/dayscholar/routeParts";
import type { BusStop } from "@/types/transport";

describe("StopsTimeline", () => {
  const sampleStops: BusStop[] = [
    { stopOrder: 1, stopName: "Central Station", pickupTime: "07:00 AM" },
    { stopOrder: 2, stopName: "Market Junction", pickupTime: "07:15 AM" },
    { stopOrder: 3, stopName: "City Square", pickupTime: "07:25 AM" },
    { stopOrder: 4, stopName: "Library Corner", pickupTime: "07:35 AM" },
    { stopOrder: 5, stopName: "Sports Complex", pickupTime: "07:45 AM" },
    { stopOrder: 6, stopName: "Tech Park", pickupTime: "07:55 AM" },
    { stopOrder: 7, stopName: "North Gate", pickupTime: "08:05 AM" },
    { stopOrder: 8, stopName: "Campus Terminal", pickupTime: "08:15 AM" },
  ];

  it("renders all stops when no limit is provided", () => {
    render(<StopsTimeline stops={sampleStops} />);

    for (const stop of sampleStops) {
      expect(screen.getByText(stop.stopName)).toBeDefined();
      expect(screen.getByText(stop.pickupTime)).toBeDefined();
    }

    // Ensure no '+N more stops' exists
    expect(screen.queryByText(/more stops/i)).toBeNull();
  });

  it("respects limit when explicitly provided", () => {
    render(<StopsTimeline stops={sampleStops} limit={4} />);

    expect(screen.getByText("Central Station")).toBeDefined();
    expect(screen.getByText("Market Junction")).toBeDefined();
    expect(screen.getByText("City Square")).toBeDefined();
    expect(screen.getByText("Library Corner")).toBeDefined();

    expect(screen.queryByText("Sports Complex")).toBeNull();
    expect(screen.queryByText("Tech Park")).toBeNull();
  });
});
