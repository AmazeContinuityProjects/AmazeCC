import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useNowMinute } from "@/lib/useNow";

describe("useNowMinute", () => {
  afterEach(() => vi.useRealTimers());

  it("updates at minute boundaries and refreshes after all subscribers unmount", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 8, 10, 0));

    const first = renderHook(() => useNowMinute());
    const initialMinute = first.result.current;
    expect(initialMinute).toBe(Math.floor(Date.now() / 60_000));

    act(() => vi.advanceTimersByTime(30_000));
    expect(first.result.current).toBe(initialMinute);

    act(() => vi.advanceTimersByTime(30_000));
    expect(first.result.current).toBe(initialMinute + 1);

    first.unmount();
    act(() => vi.advanceTimersByTime(60_000));

    const second = renderHook(() => useNowMinute());
    expect(second.result.current).toBe(Math.floor(Date.now() / 60_000));
    second.unmount();
  });
});
