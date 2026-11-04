/**
 * Local-first persistence for scans: IndexedDB, with an in-memory fallback.
 *
 * Local-first means the student's PDFs live on *this device* and upload only
 * later (see `upload.ts`), so this store is the source of truth, not a cache:
 *
 *   • `createScanStore()` returns an IndexedDB-backed store whenever the
 *     browser allows one, and an in-memory store otherwise — jsdom (tests),
 *     SSR, private-mode profiles that refuse to open a database. The session
 *     still works in that case; the console says so once, loudly.
 *   • Storage quota failures are *not* swallowed: the underlying
 *     `QuotaExceededError` propagates with its name intact, because "storage
 *     is full" is a decision the UI has to make, not this layer.
 *
 * Semantics the rest of the feature relies on:
 *
 *   • `list()` is newest-first, always — the library screen is a timeline.
 *   • Records are copied in and out. `ScanMeta` is JSON-safe, so a round-trip
 *     clone is exact; PDFs and thumbnails are immutable Blobs, so sharing
 *     their references is both safe and free. Editing a returned meta can
 *     never mutate what is stored.
 *   • `patch()` is a shallow merge inside one read-write transaction — a
 *     title rename must not be able to clobber an upload status written
 *     concurrently by the sync layer.
 */

import type { ScanMeta, ScanRecord } from "./types";

const DB_NAME = "amazecc-paper-scanner";
const DB_VERSION = 1;
const STORE = "scans";

/** What every backend implements — the contract the pipeline codes against. */
export interface ScanStore {
  /** All metas, newest first. Never carries PDFs — `list()` must stay cheap. */
  list(): Promise<ScanMeta[]>;
  /** The full record, or `undefined` when it is gone. */
  get(id: string): Promise<ScanRecord | undefined>;
  /** Insert or replace by `meta.id`. Rejects records without an id. */
  put(record: ScanRecord): Promise<void>;
  /** Shallow-merge into the stored meta; rejects when the scan no longer exists. */
  patch(id: string, patch: Partial<Omit<ScanMeta, "id">>): Promise<ScanMeta>;
  /** Delete (idempotent — removing a missing scan is not an error). */
  remove(id: string): Promise<void>;
}

/** Newest first, with an id tie-break so ordering is fully deterministic. */
const byNewestFirst = (a: ScanMeta, b: ScanMeta): number =>
  b.createdAt - a.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Exact copy for handing meta out; `ScanMeta` is JSON-safe by construction. */
const cloneMeta = (meta: ScanMeta): ScanMeta => JSON.parse(JSON.stringify(meta)) as ScanMeta;

function assertScanRecord(record: ScanRecord): void {
  if (!record || typeof record.meta?.id !== "string" || record.meta.id.length === 0) {
    throw new Error("scan record needs a non-empty meta.id");
  }
}

/* ------------------------------------------------------------ memory */

/**
 * In-memory backend — the fallback for jsdom/SSR/private mode, and what the
 * tests exercise the contract against. Same copy-in/copy-out semantics as
 * IndexedDB so a test proves something about production behaviour.
 */
export function memoryScanStore(): ScanStore {
  const rows = new Map<string, ScanRecord>();
  return {
    async list() {
      return [...rows.values()]
        .map((record) => record.meta)
        .sort(byNewestFirst)
        .map(cloneMeta);
    },
    async get(id) {
      const record = rows.get(id);
      return record ? { ...record, meta: cloneMeta(record.meta) } : undefined;
    },
    async put(record) {
      assertScanRecord(record);
      rows.set(record.meta.id, { ...record, meta: cloneMeta(record.meta) });
    },
    async patch(id, patch) {
      const record = rows.get(id);
      if (!record) throw new Error(`patch: no scan ${id}`);
      const merged: ScanMeta = { ...record.meta, ...patch, id };
      rows.set(id, { ...record, meta: cloneMeta(merged) });
      return cloneMeta(merged);
    },
    async remove(id) {
      rows.delete(id);
    },
  };
}

/* --------------------------------------------------------- IndexedDB */

function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("scanner transaction aborted"));
  });
}

let dbPromise: Promise<IDBDatabase> | undefined;

/**
 * The one open connection, memoised.
 *
 * A failed open is evicted so the *next* attempt retries — private mode that
 * unlocked later (or a transient failure) must not poison the session. The
 * connection also closes itself on `versionchange` so another tab's upgrade
 * is never blocked forever.
 */
function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  const opened = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "meta.id" });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = undefined;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error("could not open the scanner database"));
    request.onblocked = () => reject(new Error("scanner database upgrade blocked by another tab"));
  });
  dbPromise = opened.catch((err: unknown) => {
    dbPromise = undefined;
    throw err;
  });
  return dbPromise;
}

function idbScanStore(): ScanStore {
  return {
    async list() {
      const db = await openDb();
      const records = (await requestAsPromise(
        db.transaction(STORE, "readonly").objectStore(STORE).getAll(),
      )) as ScanRecord[];
      return records
        .map((record) => record.meta)
        .sort(byNewestFirst)
        .map(cloneMeta);
    },
    async get(id) {
      const db = await openDb();
      const record = (await requestAsPromise(db.transaction(STORE, "readonly").objectStore(STORE).get(id))) as
        ScanRecord | undefined;
      return record ? { ...record, meta: cloneMeta(record.meta) } : undefined;
    },
    async put(record) {
      assertScanRecord(record);
      const db = await openDb();
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record); // IndexedDB structured-clones it here
      await transactionDone(tx);
    },
    async patch(id, patch) {
      const db = await openDb();
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const existing = (await requestAsPromise(store.get(id))) as ScanRecord | undefined;
      if (!existing) throw new Error(`patch: no scan ${id}`);
      const merged: ScanMeta = { ...existing.meta, ...patch, id };
      store.put({ ...existing, meta: merged });
      await transactionDone(tx);
      return cloneMeta(merged);
    },
    async remove(id) {
      const db = await openDb();
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      await transactionDone(tx);
    },
  };
}

/* ------------------------------------------------------------- factory */

export function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false; // some profiles throw on mere access
  }
}

/**
 * The app's store: IndexedDB when the browser allows it, memory otherwise.
 *
 * The fallback is deliberate, not a compromise — a scanner that refuses to
 * save because a browser feature is missing would be worse than one that
 * keeps the session's work in RAM and says so.
 */
export async function createScanStore(): Promise<ScanStore> {
  if (!isIndexedDbAvailable()) return memoryScanStore();
  try {
    await openDb();
    return idbScanStore();
  } catch (err) {
    console.warn("paper scanner: IndexedDB unavailable, keeping scans in memory for this session", err);
    return memoryScanStore();
  }
}

/** Test seam: forget the memoised connection so failure paths can be exercised. */
export function resetScanStoreConnection(): void {
  dbPromise = undefined;
}
