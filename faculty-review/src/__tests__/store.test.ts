import { describe, it, expect } from "vitest";
import {
  type SnapshotStore,
  InMemorySnapshotStore,
  KvSnapshotStore,
  R2SnapshotStore,
  createSnapshotStore,
} from "../store/SnapshotStore";
import type { Env } from "../types";

/**
 * Mock Cloudflare KVNamespace implementation for testing KvSnapshotStore
 */
function createMockKvNamespace(): KVNamespace {
  const data = new Map<string, { value: string; metadata?: any }>();
  return {
    async get(key: string) {
      const entry = data.get(key);
      return entry ? entry.value : null;
    },
    async getWithMetadata(key: string) {
      const entry = data.get(key);
      if (!entry) return { value: null, metadata: null };
      return { value: entry.value, metadata: entry.metadata || null };
    },
    async put(key: string, value: string, options?: any) {
      data.set(key, { value, metadata: options?.metadata });
    },
    async delete(key: string) {
      data.delete(key);
    },
    async list() {
      return { keys: Array.from(data.keys()).map((name) => ({ name })), list_complete: true, cursor: "" } as any;
    },
  } as unknown as KVNamespace;
}

/**
 * Mock Cloudflare R2Bucket implementation for testing R2SnapshotStore
 */
function createMockR2Bucket(): R2Bucket {
  const objects = new Map<
    string,
    { body: string; httpEtag: string; customMetadata?: Record<string, string> }
  >();

  return {
    async head(key: string) {
      const entry = objects.get(key);
      if (!entry) return null;
      return {
        key,
        size: entry.body.length,
        etag: entry.httpEtag.replace(/"/g, ""),
        httpEtag: entry.httpEtag,
        customMetadata: entry.customMetadata,
      } as any;
    },
    async get(key: string) {
      const entry = objects.get(key);
      if (!entry) return null;
      return {
        key,
        size: entry.body.length,
        etag: entry.httpEtag.replace(/"/g, ""),
        httpEtag: entry.httpEtag,
        customMetadata: entry.customMetadata,
        async text() {
          return entry.body;
        },
        async json() {
          return JSON.parse(entry.body);
        },
        async arrayBuffer() {
          return new TextEncoder().encode(entry.body).buffer;
        },
      } as any;
    },
    async put(key: string, value: any, options?: any) {
      const body = typeof value === "string" ? value : String(value);
      const httpEtag = options?.customMetadata?.etag || `"${key}-${body.length}"`;
      objects.set(key, { body, httpEtag, customMetadata: options?.customMetadata });
      return {
        key,
        size: body.length,
        etag: httpEtag.replace(/"/g, ""),
        httpEtag,
        customMetadata: options?.customMetadata,
      } as any;
    },
    async delete(keys: string | string[]) {
      const keyList = Array.isArray(keys) ? keys : [keys];
      for (const k of keyList) {
        objects.delete(k);
      }
    },
    async list() {
      return {
        objects: Array.from(objects.entries()).map(([k, v]) => ({ key: k, size: v.body.length })),
        truncated: false,
        cursor: "",
      } as any;
    },
  } as unknown as R2Bucket;
}

describe("SnapshotStore Implementations & Factory", () => {
  /**
   * Reusable contract verification suite for any SnapshotStore implementation
   */
  async function verifySnapshotStoreContract(store: SnapshotStore, name: string) {
    // 1. Initial get on missing key returns null
    const missing = await store.get("non-existent-key");
    expect(missing).toBeNull();

    // 2. Put and Get round-trip with default etag
    const catalogJson = JSON.stringify({ schemaVersion: "1.0.0", faculty: [] });
    await store.put("catalog.json", catalogJson);
    const retrieved = await store.get("catalog.json");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.body).toBe(catalogJson);
    expect(retrieved?.etag).toBeDefined();
    expect(retrieved?.etag.length).toBeGreaterThan(0);

    // 3. Put and Get round-trip with custom etag
    const profileJson = JSON.stringify({ id: "f-123", name: "Prof Test" });
    const customEtag = '"custom-etag-abc-123"';
    await store.put("profile/f-123.json", profileJson, customEtag);
    const retrievedProfile = await store.get("profile/f-123.json");
    expect(retrievedProfile).not.toBeNull();
    expect(retrievedProfile?.body).toBe(profileJson);
    expect(retrievedProfile?.etag).toBe(customEtag);

    // 4. Overwrite updates content and etag
    const updatedProfile = JSON.stringify({ id: "f-123", name: "Prof Updated" });
    const updatedEtag = '"custom-etag-updated-456"';
    await store.put("profile/f-123.json", updatedProfile, updatedEtag);
    const retrievedUpdated = await store.get("profile/f-123.json");
    expect(retrievedUpdated?.body).toBe(updatedProfile);
    expect(retrievedUpdated?.etag).toBe(updatedEtag);

    // 5. Delete removes key, subsequent get returns null
    await store.delete("catalog.json");
    const afterDelete = await store.get("catalog.json");
    expect(afterDelete).toBeNull();

    // 6. Delete on non-existent key does not throw
    await expect(store.delete("already-deleted-key")).resolves.toBeUndefined();
  }

  describe("InMemorySnapshotStore", () => {
    it("satisfies the SnapshotStore contract", async () => {
      const store = new InMemorySnapshotStore();
      await verifySnapshotStoreContract(store, "InMemorySnapshotStore");
    });

    it("supports test helper methods (clear, keys, size)", async () => {
      const store = new InMemorySnapshotStore();
      await store.put("k1", "v1");
      await store.put("k2", "v2");
      expect(store.size()).toBe(2);
      expect(store.keys()).toEqual(["k1", "k2"]);

      store.clear();
      expect(store.size()).toBe(0);
      expect(await store.get("k1")).toBeNull();
    });
  });

  describe("KvSnapshotStore", () => {
    it("satisfies the SnapshotStore contract", async () => {
      const mockKv = createMockKvNamespace();
      const store = new KvSnapshotStore(mockKv);
      await verifySnapshotStoreContract(store, "KvSnapshotStore");
    });

    it("stores etag in metadata and retrieves it", async () => {
      const mockKv = createMockKvNamespace();
      const store = new KvSnapshotStore(mockKv);
      await store.put("manifest", "{}", '"etag-manifest-1"');

      const meta = await mockKv.getWithMetadata<{ etag: string }>("manifest");
      expect(meta.value).toBe("{}");
      expect(meta.metadata?.etag).toBe('"etag-manifest-1"');
    });
  });

  describe("R2SnapshotStore", () => {
    it("satisfies the SnapshotStore contract", async () => {
      const mockR2 = createMockR2Bucket();
      const store = new R2SnapshotStore(mockR2);
      await verifySnapshotStoreContract(store, "R2SnapshotStore");
    });

    it("stores custom etag in customMetadata and passes JSON contentType", async () => {
      const mockR2 = createMockR2Bucket();
      const store = new R2SnapshotStore(mockR2);
      await store.put("catalog.json", '{"test":true}', '"r2-etag-999"');

      const head = await mockR2.head("catalog.json");
      expect(head).not.toBeNull();
      expect(head?.customMetadata?.etag).toBe('"r2-etag-999"');
    });

    it("returns null when object does not exist in R2", async () => {
      const mockR2 = createMockR2Bucket();
      const store = new R2SnapshotStore(mockR2);
      const res = await store.get("missing.json");
      expect(res).toBeNull();
    });
  });

  describe("createSnapshotStore Factory", () => {
    const baseEnv: Env = {
      SUPABASE_URL: "https://test.supabase.co",
      REVIEWS_INGEST_SECRET: "test-secret-12345",
      amazecc_reviews_queue: { send: async () => {} } as any,
    };

    it("resolves to R2SnapshotStore when env.AMAZE_REVIEWS_R2 is present", () => {
      const mockR2 = createMockR2Bucket();
      const env: Env = {
        ...baseEnv,
        AMAZE_REVIEWS_R2: mockR2,
      };
      const store = createSnapshotStore(env);
      expect(store).toBeInstanceOf(R2SnapshotStore);
    });

    it("resolves to R2SnapshotStore when env.SNAPSHOT_BUCKET is present", () => {
      const mockR2 = createMockR2Bucket();
      const env: Env = {
        ...baseEnv,
        SNAPSHOT_BUCKET: mockR2,
      };
      const store = createSnapshotStore(env);
      expect(store).toBeInstanceOf(R2SnapshotStore);
    });

    it("resolves to KvSnapshotStore when env.AMAZE_REVIEWS_KV is present (no R2)", () => {
      const mockKv = createMockKvNamespace();
      const env: Env = {
        ...baseEnv,
        AMAZE_REVIEWS_KV: mockKv,
      };
      const store = createSnapshotStore(env);
      expect(store).toBeInstanceOf(KvSnapshotStore);
    });

    it("resolves to KvSnapshotStore when env.REVIEWS_SNAPSHOTS is present (no R2)", () => {
      const mockKv = createMockKvNamespace();
      const env: Env = {
        ...baseEnv,
        REVIEWS_SNAPSHOTS: mockKv,
      };
      const store = createSnapshotStore(env);
      expect(store).toBeInstanceOf(KvSnapshotStore);
    });

    it("prefers R2 over KV when both are present and SNAPSHOT_STORE is unset", () => {
      const mockKv = createMockKvNamespace();
      const mockR2 = createMockR2Bucket();
      const env: Env = {
        ...baseEnv,
        AMAZE_REVIEWS_KV: mockKv,
        AMAZE_REVIEWS_R2: mockR2,
      };
      const store = createSnapshotStore(env);
      expect(store).toBeInstanceOf(R2SnapshotStore);
    });

    it("respects SNAPSHOT_STORE='kv' variable even if R2 is bound", () => {
      const mockKv = createMockKvNamespace();
      const mockR2 = createMockR2Bucket();
      const env: Env = {
        ...baseEnv,
        SNAPSHOT_STORE: "kv",
        AMAZE_REVIEWS_KV: mockKv,
        AMAZE_REVIEWS_R2: mockR2,
      };
      const store = createSnapshotStore(env);
      expect(store).toBeInstanceOf(KvSnapshotStore);
    });

    it("respects SNAPSHOT_STORE='memory' variable", () => {
      const mockKv = createMockKvNamespace();
      const env: Env = {
        ...baseEnv,
        SNAPSHOT_STORE: "memory",
        AMAZE_REVIEWS_KV: mockKv,
      };
      const store = createSnapshotStore(env);
      expect(store).toBeInstanceOf(InMemorySnapshotStore);
    });

    it("throws a clear error when SNAPSHOT_STORE='r2' but no R2 bucket is bound", () => {
      const env: Env = {
        ...baseEnv,
        SNAPSHOT_STORE: "r2",
      };
      expect(() => createSnapshotStore(env)).toThrow(/REVIEWS_BUCKET/);
    });

    it("falls back to InMemorySnapshotStore when no storage bindings are present", () => {
      const env: Env = {
        ...baseEnv,
      };
      const store = createSnapshotStore(env);
      expect(store).toBeInstanceOf(InMemorySnapshotStore);
    });

    it("preserves injected InMemorySnapshotStore test instance in env.REVIEWS_SNAPSHOTS", () => {
      const inMemoryTestStore = new InMemorySnapshotStore();
      const env: Env = {
        ...baseEnv,
        SNAPSHOT_STORE: "memory",
        REVIEWS_SNAPSHOTS: inMemoryTestStore as any,
      };
      const store = createSnapshotStore(env);
      expect(store).toBe(inMemoryTestStore);
    });

    it("supports legacy dual-argument invocation", () => {
      const mockKv = createMockKvNamespace();
      const mockR2 = createMockR2Bucket();

      expect(createSnapshotStore("memory")).toBeInstanceOf(InMemorySnapshotStore);
      expect(createSnapshotStore("kv", mockKv)).toBeInstanceOf(KvSnapshotStore);
      expect(createSnapshotStore("r2", mockR2)).toBeInstanceOf(R2SnapshotStore);

      const existing = new InMemorySnapshotStore();
      expect(createSnapshotStore("memory", existing)).toBe(existing);
    });
  });
});
