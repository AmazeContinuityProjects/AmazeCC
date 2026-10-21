import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { isChunkLoadError, recoverFromChunkLoad } from "../lib/chunkRecovery";

/**
 * The chunk-load recovery, and the loop it exists to break.
 *
 * A `ChunkLoadError` means the rendered document references a chunk that no
 * longer exists — usually a stale service-worker cache serving an old HTML
 * document after a deploy. Reloading alone re-serves that same broken
 * document, so the error boundary fires again and the page reloads every
 * throttle window, wiping out whatever the user was doing. Recovery must drop
 * the stale bundle first, and must never fire offline (where the cached bundle
 * is all there is).
 */

const chunkError = () =>
  Object.assign(new Error("Loading chunk 42 failed."), { name: "ChunkLoadError" });

describe("isChunkLoadError", () => {
  it("recognises webpack/next chunk failures", () => {
    expect(isChunkLoadError(chunkError())).toBe(true);
    expect(isChunkLoadError(new Error("Loading chunk 12 failed."))).toBe(true);
    expect(isChunkLoadError(new Error("Loading CSS chunk 3 failed."))).toBe(true);
    expect(
      isChunkLoadError(new Error("Failed to fetch dynamically imported module: https://cdn.example/y.js"))
    ).toBe(true);
  });

  it("leaves ordinary errors alone", () => {
    expect(isChunkLoadError(new Error("Network request failed"))).toBe(false);
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe("recoverFromChunkLoad", () => {
  let registrations: { unregister: ReturnType<typeof vi.fn> }[];
  let cachesStub: {
    keys: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let reloadSpy: Mock<() => void>;

  beforeEach(() => {
    reloadSpy = vi.fn();
    registrations = [{ unregister: vi.fn().mockResolvedValue(undefined) }];
    cachesStub = {
      keys: vi.fn().mockResolvedValue(["pages", "next-static-js-assets"]),
      delete: vi.fn().mockResolvedValue(true),
    };

    Object.defineProperty(navigator, "serviceWorker", {
      value: { getRegistrations: vi.fn().mockResolvedValue(registrations) },
      configurable: true,
    });
    Object.defineProperty(window, "caches", { value: cachesStub, configurable: true });
  });

  it("drops the stale bundle and reloads when online", async () => {
    await recoverFromChunkLoad(reloadSpy);

    expect(registrations[0].unregister).toHaveBeenCalled();
    expect(cachesStub.delete).toHaveBeenCalledWith("pages");
    expect(cachesStub.delete).toHaveBeenCalledWith("next-static-js-assets");
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("does nothing when offline — the cached bundle is all there is", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });

    await recoverFromChunkLoad(reloadSpy);

    expect(registrations[0].unregister).not.toHaveBeenCalled();
    expect(cachesStub.delete).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});
