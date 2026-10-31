/**
 * Swappable SnapshotStore interface and implementations.
 * Prompts section 11.3 & Milestone M3 (Feature 13):
 * Business logic, aggregation job, and read handlers must NEVER call KV or R2 directly.
 */

import type { Env } from "../types";

export interface SnapshotStore {
  get(key: string): Promise<{ body: string; etag: string } | null>;
  put(key: string, body: string, etag?: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
}

export class KvSnapshotStore implements SnapshotStore {
  constructor(private kv: KVNamespace) {}

  async get(key: string): Promise<{ body: string; etag: string } | null> {
    const valueWithMeta = await this.kv.getWithMetadata<{ etag: string }>(key);
    if (valueWithMeta.value === null || valueWithMeta.value === undefined) {
      return null;
    }
    const etag = valueWithMeta.metadata?.etag || `"${key}-${valueWithMeta.value.length}"`;
    return {
      body: valueWithMeta.value,
      etag,
    };
  }

  async put(key: string, body: string, etag?: string): Promise<void> {
    const effectiveEtag = etag || `"${key}-${body.length}"`;
    await this.kv.put(key, body, {
      metadata: { etag: effectiveEtag },
    });
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(key);
  }

  async list(prefix = ""): Promise<string[]> {
    const keys: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.kv.list({ prefix, cursor });
      for (const k of page.keys) keys.push(k.name);
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    return keys;
  }
}

export class InMemorySnapshotStore implements SnapshotStore {
  private store = new Map<string, { body: string; etag: string }>();

  async get(key: string): Promise<{ body: string; etag: string } | null> {
    const found = this.store.get(key);
    return found ? { ...found } : null;
  }

  async put(key: string, body: string, etag?: string): Promise<void> {
    const effectiveEtag = etag || `"${key}-${body.length}"`;
    this.store.set(key, { body, etag: effectiveEtag });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(prefix = ""): Promise<string[]> {
    return Array.from(this.store.keys()).filter((k) => k.startsWith(prefix));
  }

  // Helpers for testing
  clear(): void {
    this.store.clear();
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }

  size(): number {
    return this.store.size;
  }
}

export class R2SnapshotStore implements SnapshotStore {
  constructor(private bucket: R2Bucket) {}

  async get(key: string): Promise<{ body: string; etag: string } | null> {
    const object = await this.bucket.get(key);
    if (!object) {
      return null;
    }
    const body = await object.text();
    const etag =
      object.customMetadata?.etag ||
      (object as any).httpEtag ||
      (object.etag ? `"${object.etag}"` : `"${key}-${object.size || body.length}"`);
    return {
      body,
      etag,
    };
  }

  async put(key: string, body: string, etag?: string): Promise<void> {
    const options: R2PutOptions = {
      httpMetadata: {
        contentType: "application/json",
      },
    };
    if (etag) {
      options.customMetadata = { etag };
    }
    await this.bucket.put(key, body, options);
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  async list(prefix = ""): Promise<string[]> {
    const keys: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.bucket.list({ prefix, cursor });
      for (const obj of page.objects) keys.push(obj.key);
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    return keys;
  }
}

export function createSnapshotStore(env: Env): SnapshotStore;
export function createSnapshotStore(
  type?: string,
  kvOrStore?: KVNamespace | SnapshotStore | R2Bucket,
  r2Bucket?: R2Bucket
): SnapshotStore;
export function createSnapshotStore(
  envOrType?: Env | string,
  kvOrStore?: KVNamespace | SnapshotStore | R2Bucket,
  r2Bucket?: R2Bucket
): SnapshotStore {
  // Case 1: Called with Env object: createSnapshotStore(env)
  if (typeof envOrType === "object" && envOrType !== null) {
    const env = envOrType as Env;

    // Direct mock / test store injection check (e.g. worker.test.ts)
    if (
      env.REVIEWS_SNAPSHOTS &&
      (env.REVIEWS_SNAPSHOTS instanceof InMemorySnapshotStore ||
        (typeof (env.REVIEWS_SNAPSHOTS as any).get === "function" &&
          typeof (env.REVIEWS_SNAPSHOTS as any).put === "function" &&
          typeof (env.REVIEWS_SNAPSHOTS as any).getWithMetadata !== "function"))
    ) {
      return env.REVIEWS_SNAPSHOTS as unknown as SnapshotStore;
    }

    const mode = env.SNAPSHOT_STORE?.toLowerCase();

    // Explicit override via SNAPSHOT_STORE variable
    if (mode === "memory") {
      return new InMemorySnapshotStore();
    }
    if (mode === "r2") {
      const r2 = env.AMAZE_REVIEWS_R2 || env.SNAPSHOT_BUCKET || env.REVIEWS_BUCKET;
      if (r2) {
        return new R2SnapshotStore(r2);
      }
      throw new Error(
        "SNAPSHOT_STORE=r2 but no R2 binding provided: bind REVIEWS_BUCKET in wrangler.jsonc"
      );
    }
    if (mode === "kv") {
      const kv = env.AMAZE_REVIEWS_KV || env.REVIEWS_SNAPSHOTS;
      if (kv) {
        if (kv instanceof InMemorySnapshotStore || kv instanceof KvSnapshotStore) {
          return kv;
        }
        return new KvSnapshotStore(kv);
      }
      // Silently using memory would publish snapshots nowhere; fail loudly.
      throw new Error(
        "SNAPSHOT_STORE=kv but no KV binding provided: bind REVIEWS_SNAPSHOTS in wrangler.jsonc"
      );
    }

    // SNAPSHOT_STORE unset. KV is the documented default, so it wins over R2.
    // Resolution hierarchy: KV -> R2 -> InMemory (tests/local only).
    const kv = env.AMAZE_REVIEWS_KV || env.REVIEWS_SNAPSHOTS;
    if (kv) {
      if (kv instanceof InMemorySnapshotStore || kv instanceof KvSnapshotStore) {
        return kv;
      }
      return new KvSnapshotStore(kv);
    }
    const r2 = env.AMAZE_REVIEWS_R2 || env.SNAPSHOT_BUCKET || env.REVIEWS_BUCKET;
    if (r2) {
      return new R2SnapshotStore(r2);
    }
    return new InMemorySnapshotStore();
  }

  // Case 2: Dual/triple-argument legacy invocation: createSnapshotStore(type, kvOrStore, r2Bucket)
  const type = (envOrType || "kv").toLowerCase();
  if (
    kvOrStore instanceof InMemorySnapshotStore ||
    kvOrStore instanceof KvSnapshotStore ||
    kvOrStore instanceof R2SnapshotStore
  ) {
    return kvOrStore;
  }
  if (
    kvOrStore &&
    typeof (kvOrStore as any).get === "function" &&
    typeof (kvOrStore as any).put === "function" &&
    typeof (kvOrStore as any).getWithMetadata !== "function" &&
    typeof (kvOrStore as any).head !== "function"
  ) {
    return kvOrStore as SnapshotStore;
  }
  if (type === "r2") {
    const bucket = r2Bucket || (kvOrStore as R2Bucket);
    if (!bucket) {
      throw new Error(
        "SNAPSHOT_STORE=r2 but no R2 binding provided: bind REVIEWS_BUCKET in wrangler.jsonc"
      );
    }
    return new R2SnapshotStore(bucket);
  }
  if (type === "memory" || !kvOrStore) {
    return new InMemorySnapshotStore();
  }
  return new KvSnapshotStore(kvOrStore as KVNamespace);
}
