import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  schedulePublish,
  cancelScheduledPublish,
} from "../lib/social/useSocialData";

/**
 * The debounce replaces the old behaviour where every add/remove/toggle fired a
 * full cloud round trip to flip one boolean (`SocialTab.tsx:190` uploaded the
 * whole friends array). Coalescing is the entire point, so it is asserted here
 * rather than eyeballed.
 */
describe("schedulePublish", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cancelScheduledPublish();
  });

  afterEach(() => {
    cancelScheduledPublish();
    vi.useRealTimers();
  });

  it("does not push immediately", () => {
    const push = vi.fn().mockResolvedValue(undefined);
    schedulePublish(push, 5000);
    expect(push).not.toHaveBeenCalled();
  });

  it("does not push before the delay elapses", () => {
    const push = vi.fn().mockResolvedValue(undefined);
    schedulePublish(push, 5000);
    vi.advanceTimersByTime(4999);
    expect(push).not.toHaveBeenCalled();
  });

  it("pushes once the delay elapses", async () => {
    const push = vi.fn().mockResolvedValue(undefined);
    schedulePublish(push, 5000);
    vi.advanceTimersByTime(5000);
    await vi.runAllTimersAsync();
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("coalesces a burst of mutations into a single push", async () => {
    const push = vi.fn().mockResolvedValue(undefined);
    // Five toggles inside one window, as a user clicking through settings.
    for (let i = 0; i < 5; i++) {
      schedulePublish(push, 5000);
      vi.advanceTimersByTime(200);
    }
    await vi.runAllTimersAsync();
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("restarts the window on each new call", async () => {
    const push = vi.fn().mockResolvedValue(undefined);
    schedulePublish(push, 5000);
    vi.advanceTimersByTime(4000);
    schedulePublish(push, 5000);
    vi.advanceTimersByTime(4000);
    // 8000ms total, but never 5000ms of quiet, so nothing should have fired.
    expect(push).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    await vi.runAllTimersAsync();
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("separates pushes that fall into different windows", async () => {
    const push = vi.fn().mockResolvedValue(undefined);
    schedulePublish(push, 5000);
    vi.advanceTimersByTime(5000);
    await vi.runAllTimersAsync();
    expect(push).toHaveBeenCalledTimes(1);
    schedulePublish(push, 5000);
    vi.advanceTimersByTime(5000);
    await vi.runAllTimersAsync();
    expect(push).toHaveBeenCalledTimes(2);
  });

  it("cancels a pending push, so signing out does not fire one", () => {
    const push = vi.fn().mockResolvedValue(undefined);
    schedulePublish(push, 5000);
    cancelScheduledPublish();
    vi.advanceTimersByTime(10_000);
    expect(push).not.toHaveBeenCalled();
  });

  it("chains behind an in-flight push instead of dropping the change", async () => {
    let releaseFirst: () => void = () => {};
    const first = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const order: string[] = [];
    const slow = vi.fn().mockImplementation(async () => {
      order.push("slow-start");
      await first;
      order.push("slow-end");
    });
    const next = vi.fn().mockImplementation(async () => {
      order.push("next");
    });

    schedulePublish(slow, 0);
    await vi.runAllTimersAsync();
    // A change lands while the first push is still running.
    schedulePublish(next, 0);
    await vi.runAllTimersAsync();
    releaseFirst();
    await vi.runAllTimersAsync();

    // The second push must not be dropped, and must not overlap the first.
    expect(next).toHaveBeenCalledTimes(1);
    expect(order.indexOf("slow-end")).toBeLessThan(order.indexOf("next"));
  });

  it("a rejected push does not wedge the queue", async () => {
    const boom = vi.fn().mockRejectedValue(new Error("offline"));
    const after = vi.fn().mockResolvedValue(undefined);

    schedulePublish(boom, 0);
    await vi.runAllTimersAsync();
    schedulePublish(after, 0);
    await vi.runAllTimersAsync();

    expect(boom).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
  });
});
