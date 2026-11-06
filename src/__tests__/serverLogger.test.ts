import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SeverityNumber } from "@opentelemetry/api-logs";
import { getPostHogServerLogger, logToPostHog } from "@/lib/serverLogger";

describe("serverLogger", () => {
  const originalLogger = (globalThis as unknown as { __posthogLogger?: unknown }).__posthogLogger;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    (globalThis as unknown as { __posthogLogger?: unknown }).__posthogLogger = originalLogger;
  });

  it("retrieves global logger when defined", () => {
    const mockLogger = { emit: vi.fn(), enabled: vi.fn() };
    (globalThis as unknown as { __posthogLogger?: unknown }).__posthogLogger = mockLogger;

    expect(getPostHogServerLogger()).toBe(mockLogger);
  });

  it("returns undefined when logger is not initialized", () => {
    delete (globalThis as unknown as { __posthogLogger?: unknown }).__posthogLogger;
    expect(getPostHogServerLogger()).toBeUndefined();
  });

  it("emits log with defaults when called", () => {
    const emitMock = vi.fn();
    (globalThis as unknown as { __posthogLogger?: unknown }).__posthogLogger = {
      emit: emitMock,
      enabled: vi.fn(),
    };

    logToPostHog({
      body: "Test server log",
      attributes: { route: "/api/test" },
    });

    expect(emitMock).toHaveBeenCalledWith({
      severityNumber: SeverityNumber.INFO,
      severityText: "INFO",
      body: "Test server log",
      attributes: { route: "/api/test" },
    });
  });

  it("handles missing logger gracefully without throwing", () => {
    delete (globalThis as unknown as { __posthogLogger?: unknown }).__posthogLogger;
    expect(() => {
      logToPostHog({ body: "Silently ignored" });
    }).not.toThrow();
  });
});
