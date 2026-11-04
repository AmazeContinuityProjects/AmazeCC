import "fake-indexeddb/auto"; // puts a real (fake) IndexedDB behind the production adapter

import { Blob as NodeBlob } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createScanStore,
  isIndexedDbAvailable,
  memoryScanStore,
  resetScanStoreConnection,
  type ScanStore,
} from "../lib/scanner/store";
import type { ScanMeta, ScanRecord } from "../lib/scanner/types";

/**
 * fake-indexeddb's clone reduces *jsdom's* Blob class to `{}` — it round-trips
 * real Blob implementations only (a limitation of the fake, not of the store;
 * real browsers clone Blobs natively and perfectly). Node's Blob is a full
 * Blob — `text()`, `type`, `slice()` — so the payload contract stays honest
 * against the production adapter.
 */
vi.stubGlobal("Blob", NodeBlob);

let seq = 0;

function makeRecord(overrides: Partial<ScanMeta> = {}): ScanRecord {
  seq += 1;
  const meta: ScanMeta = {
    id: `scan-${seq}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: 1_700_000_000_000 + seq,
    title: `Paper ${seq}`,
    subjectCode: "BCSE204L",
    kind: "exam",
    kindConfidence: 0.9,
    pageCount: 2,
    sizeBytes: 12_345,
    quality: { score: 80, label: "clean" },
    ocr: { engine: "tesseract", confidence: 77, preview: "MAXIMUM MARKS: 50" },
    upload: { status: "local" },
    ...overrides,
  };
  return {
    meta,
    pdf: new Blob([`pdf-bytes-${meta.id}`], { type: "application/pdf" }),
    ocrText: "MAXIMUM MARKS: 50\nSection A",
  };
}

const randomId = () => `gone-${Math.random().toString(36).slice(2, 10)}`;

/**
 * The same contract, proven against both backends. The memory store is not a
 * lesser double: it is what jsdom and private-mode browsers actually run, and
 * the suite exists to keep it behaviourally identical to IndexedDB.
 */
const adapters: Array<[label: string, make: () => Promise<ScanStore>]> = [
  ["indexeddb", createScanStore],
  ["memory", async () => memoryScanStore()],
];

for (const [label, make] of adapters) {
  describe(`scanner store contract (${label})`, () => {
    let store: ScanStore;

    beforeEach(async () => {
      store = await make();
      for (const meta of await store.list()) await store.remove(meta.id); // fresh timeline
    });

    it("stores a record and reads every field back", async () => {
      const record = makeRecord();
      await store.put(record);

      const read = await store.get(record.meta.id);
      expect(read).toBeDefined();
      expect(read?.meta).toEqual(record.meta);
      expect(read?.ocrText).toBe("MAXIMUM MARKS: 50\nSection A");
      expect(await read!.pdf.text()).toBe(`pdf-bytes-${record.meta.id}`);
      expect(read!.pdf.type).toBe("application/pdf");
    });

    it("lists newest first", async () => {
      const older = makeRecord({ createdAt: 1_700_000_000_000 });
      const middle = makeRecord({ createdAt: 1_700_000_100_000 });
      const newest = makeRecord({ createdAt: 1_700_000_200_000 });
      await store.put(older);
      await store.put(newest);
      await store.put(middle);

      const metas = await store.list();
      expect(metas.map((m) => m.id)).toEqual([newest.meta.id, middle.meta.id, older.meta.id]);
      expect(metas.every((m) => !("pdf" in m))).toBe(true); // list() never carries payloads
    });

    it("hands out copies — caller edits cannot reach the stored record", async () => {
      const record = makeRecord();
      await store.put(record);

      const read = await store.get(record.meta.id);
      read!.meta.title = "edited outside the store";
      read!.meta.pageCount = 99;

      const again = await store.get(record.meta.id);
      expect(again?.meta.title).toBe(record.meta.title);
      expect(again?.meta.pageCount).toBe(2);
    });

    it("patches a field without disturbing the rest of the meta", async () => {
      const record = makeRecord();
      await store.put(record);

      const merged = await store.patch(record.meta.id, { title: "Renamed paper" });
      expect(merged.title).toBe("Renamed paper");
      expect(merged.kind).toBe("exam"); // untouched
      expect(merged.subjectCode).toBe("BCSE204L"); // untouched
      expect(merged.id).toBe(record.meta.id); // and never re-keyed

      await store.patch(record.meta.id, { upload: { status: "uploaded", url: "https://x/y.pdf" } });
      const after = await store.get(record.meta.id);
      expect(after?.meta.upload).toEqual({ status: "uploaded", url: "https://x/y.pdf" });
      expect(after?.meta.title).toBe("Renamed paper"); // previous patch survived
    });

    it("rejects a patch when the scan is gone", async () => {
      await expect(store.patch(randomId(), { title: "x" })).rejects.toThrow(/no scan/);
    });

    it("removes a record, and removing twice is fine", async () => {
      const record = makeRecord();
      await store.put(record);

      await store.remove(record.meta.id);
      await store.remove(record.meta.id); // idempotent
      expect(await store.get(record.meta.id)).toBeUndefined();
      expect(await store.list()).toEqual([]);
    });

    it("refuses records without an id", async () => {
      await expect(store.put({ meta: {} as ScanMeta } as ScanRecord)).rejects.toThrow(/meta\.id/);
    });
  });
}

describe("scanner store: fallbacks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetScanStoreConnection();
  });

  it("uses memory when IndexedDB does not exist (jsdom, SSR, locked-down browsers)", async () => {
    vi.stubGlobal("indexedDB", undefined);
    expect(isIndexedDbAvailable()).toBe(false);

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = await createScanStore();
    const record = makeRecord();
    await store.put(record);

    expect((await store.get(record.meta.id))?.meta.title).toBe(record.meta.title);
    expect(warn).not.toHaveBeenCalled(); // no database to fail — this is the normal path
  });

  it("warns and falls back when the database refuses to open", async () => {
    resetScanStoreConnection(); // do not reuse an already-open connection
    vi.stubGlobal("indexedDB", {
      open: () => {
        const request: { onsuccess?: () => void; onerror?: () => void; onupgradeneeded?: () => void; error?: Error } =
          {};
        queueMicrotask(() => request.onerror?.());
        return request;
      },
    } as unknown as IDBFactory);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const store = await createScanStore();
    const record = makeRecord();
    await store.put(record);

    expect(await store.list()).toHaveLength(1); // the session still works
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[1])).toMatch(/scanner database|not available/);
  });
});
