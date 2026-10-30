/**
 * Swappable SnapshotStore interface.
 * Prompts section 11.3: Business logic, aggregation job, and read handlers
 * must NEVER call KV directly.
 */

export interface SnapshotStore {
  get(key: string): Promise<{ body: string; etag: string } | null>;
  put(key: string, body: string, etag: string): Promise<void>;
}

export class KvSnapshotStore implements SnapshotStore {
  constructor(private kv: KVNamespace) {}

  async get(key: string): Promise<{ body: string; etag: string } | null> {
    const valueWithMeta = await this.kv.getWithMetadata<{ etag: string }>(key);
    if (!valueWithMeta.value) {
      return null;
    }
    const etag = valueWithMeta.metadata?.etag || `"${key}-${valueWithMeta.value.length}"`;
    return {
      body: valueWithMeta.value,
      etag,
    };
  }

  async put(key: string, body: string, etag: string): Promise<void> {
    await this.kv.put(key, body, {
      metadata: { etag },
    });
  }
}

export class InMemorySnapshotStore implements SnapshotStore {
  private store = new Map<string, { body: string; etag: string }>();

  async get(key: string): Promise<{ body: string; etag: string } | null> {
    const found = this.store.get(key);
    return found ? { ...found } : null;
  }

  async put(key: string, body: string, etag: string): Promise<void> {
    this.store.set(key, { body, etag });
  }

  // Helper for testing
  clear(): void {
    this.store.clear();
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }
}

export function createSnapshotStore(
  type: string = "kv",
  kvOrStore?: KVNamespace | SnapshotStore
): SnapshotStore {
  if (kvOrStore instanceof InMemorySnapshotStore || kvOrStore instanceof KvSnapshotStore) {
    return kvOrStore;
  }
  // Check if it's a test mock that is not a KVNamespace (KVNamespace has list and getWithMetadata)
  if (kvOrStore && typeof (kvOrStore as any).get === "function" && typeof (kvOrStore as any).put === "function" && typeof (kvOrStore as any).getWithMetadata !== "function") {
    return kvOrStore as SnapshotStore;
  }
  if (type === "memory" || !kvOrStore) {
    return new InMemorySnapshotStore();
  }
  if (type === "r2") {
    throw new Error("R2 SnapshotStore is reserved for v2 and is not configured in v1.");
  }
  return new KvSnapshotStore(kvOrStore as KVNamespace);
}
