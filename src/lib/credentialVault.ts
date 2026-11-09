/**
 * Credential vault: keeps stored passwords encrypted at rest.
 *
 * WHY
 * The app stores VTOP, Moodle, library and VITOL passwords so it can sign in
 * again without asking. They used to sit in localStorage as plain text, where
 * anything that can read the browser profile (a storage export, a disk image,
 * the profile files on a shared PC, DevTools) sees them.
 *
 * HOW
 * - A random AES-256-GCM key is generated once and kept in IndexedDB as a
 *   *non-extractable* CryptoKey: page script can use it but can never read
 *   its bytes, and it is not in localStorage next to the ciphertext.
 * - The sensitive keys (SENSITIVE_KEYS) live together in one encrypted blob
 *   under VAULT_KEY. At startup the blob is decrypted into memory.
 * - About forty call sites read and write these keys synchronously, many with
 *   `localStorage.getItem("IDs")` directly. Rather than make all of them async,
 *   the vault patches `Storage.prototype` for *the localStorage object and
 *   these keys only*: reads come from memory, writes update memory and
 *   re-encrypt the blob in the background. Every other key is untouched.
 * - Plain-text values found at startup are moved into the vault and deleted.
 *
 * LIMITS (be honest about them)
 * - This does not stop XSS. Script running in the page can call getItem and
 *   get the password, exactly as before. The Content-Security-Policy is the
 *   defence there.
 * - If IndexedDB or WebCrypto is unavailable (very old browsers, some private
 *   modes, insecure origins) the vault stays off and storage behaves as it
 *   always did, so nobody is locked out.
 * - If the IndexedDB key is lost while localStorage survives (site data
 *   partly cleared), the blob cannot be decrypted. It is dropped and the
 *   student signs in again.
 * - Reads before the vault opens see no credentials. It opens from
 *   instrumentation-client.ts before React hydrates and then fires a
 *   `storage` event, which the home entry controller already listens to.
 */

export const VAULT_KEY = "cred_vault_v1";
/** Non-secret flag read by the early session script in app/layout.tsx. */
export const SESSION_MARKER_KEY = "cred_vault_session";
export const VAULT_READY_EVENT = "amazecc:vault-ready";

export const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  "IDs",
  "password",
  "moodle_password",
  "koha_password",
  "vitol_password",
  "eventHubSession",
]);

export interface KeyStore {
  get(): Promise<CryptoKey | null>;
  put(key: CryptoKey): Promise<void>;
}

/** The AES key, stored as a non-extractable CryptoKey in IndexedDB. */
export function indexedDbKeyStore(dbName = "amazecc-vault", store = "keys", id = "cred-v1"): KeyStore {
  const open = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  const run = <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) =>
    open().then(
      (db) =>
        new Promise<T>((resolve, reject) => {
          const tx = db.transaction(store, mode);
          const req = fn(tx.objectStore(store));
          tx.oncomplete = () => {
            db.close();
            resolve(req.result);
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        }),
    );
  return {
    get: () => run<CryptoKey | undefined>("readonly", (s) => s.get(id)).then((k) => k ?? null),
    put: (key) => run("readwrite", (s) => s.put(key, id)).then(() => undefined),
  };
}

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function encryptJson(subtle: SubtleCrypto, key: CryptoKey, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(value));
  const ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv }, key, data));
  return JSON.stringify({ v: 1, iv: toB64(iv), ct: toB64(ct) });
}

export async function decryptJson<T>(subtle: SubtleCrypto, key: CryptoKey, blob: string): Promise<T> {
  const { iv, ct } = JSON.parse(blob) as { iv: string; ct: string };
  const plain = await subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) }, key, fromB64(ct));
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

/** True when the cached credentials are enough to sign in to VTOP. */
function hasVtopSession(cache: Map<string, string>, raw: Pick<Storage, "getItem">): boolean {
  try {
    const ids = JSON.parse(cache.get("IDs") ?? "null");
    if (ids?.VtopUsername && ids?.VtopPassword) return true;
  } catch {
    /* unreadable IDs: fall through */
  }
  return Boolean(raw.getItem("username") && cache.get("password"));
}

export interface VaultOptions {
  storage?: Storage;
  keyStore?: KeyStore;
  subtle?: SubtleCrypto;
}

export interface VaultHandle {
  /** Resolves once pending writes are encrypted and saved (for tests). */
  flush(): Promise<void>;
  /** Remove the Storage.prototype patch (for tests). */
  uninstall(): void;
}

let installed: Promise<VaultHandle | null> | null = null;

/**
 * Open the vault and start serving sensitive keys from it. Resolves to null
 * (and leaves storage untouched) when encryption is not available.
 * Safe to call more than once; later calls return the first result.
 */
export function installCredentialVault(opts: VaultOptions = {}): Promise<VaultHandle | null> {
  installed ??= openVault(opts).catch((err) => {
    console.warn("[vault] disabled:", err instanceof Error ? err.message : err);
    return null;
  });
  return installed;
}

/** Test hook: forget the memoised install. */
export function __resetCredentialVaultForTests(): void {
  installed = null;
}

async function openVault(opts: VaultOptions): Promise<VaultHandle | null> {
  if (typeof window === "undefined" && !opts.storage) return null;
  const target = opts.storage ?? window.localStorage;
  const subtle = opts.subtle ?? globalThis.crypto?.subtle;
  if (!subtle) throw new Error("WebCrypto unavailable");
  const keyStore = opts.keyStore ?? (typeof indexedDB !== "undefined" ? indexedDbKeyStore() : null);
  if (!keyStore) throw new Error("IndexedDB unavailable");

  const proto = Object.getPrototypeOf(target) as Storage;
  const orig = {
    getItem: proto.getItem,
    setItem: proto.setItem,
    removeItem: proto.removeItem,
    clear: proto.clear,
  };
  const raw = {
    getItem: (k: string) => orig.getItem.call(target, k),
    setItem: (k: string, v: string) => orig.setItem.call(target, k, v),
    removeItem: (k: string) => orig.removeItem.call(target, k),
  };

  let key = await keyStore.get();
  if (!key) {
    key = await subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    await keyStore.put(key);
  }

  const cache = new Map<string, string>();
  const blob = raw.getItem(VAULT_KEY);
  if (blob) {
    try {
      const entries = await decryptJson<Record<string, string>>(subtle, key, blob);
      for (const [k, v] of Object.entries(entries)) if (SENSITIVE_KEYS.has(k)) cache.set(k, v);
    } catch {
      // Wrong or lost key: the ciphertext is useless, so drop it. The student
      // signs in again; nothing else is affected.
      raw.removeItem(VAULT_KEY);
    }
  }

  // ---- From here to the patch install everything is synchronous, so no other
  // ---- code can write a plain-text credential in between.
  let migrated = false;
  for (const k of SENSITIVE_KEYS) {
    const plain = raw.getItem(k);
    if (plain !== null) {
      if (!cache.has(k)) cache.set(k, plain);
      raw.removeItem(k);
      migrated = true;
    }
  }

  let chain: Promise<void> = Promise.resolve();
  const persist = () => {
    const snapshot = Object.fromEntries(cache);
    const marker = hasVtopSession(cache, raw);
    if (marker) raw.setItem(SESSION_MARKER_KEY, "1");
    else raw.removeItem(SESSION_MARKER_KEY);
    chain = chain
      .then(async () => {
        if (cache.size === 0) raw.removeItem(VAULT_KEY);
        else raw.setItem(VAULT_KEY, await encryptJson(subtle, key!, snapshot));
      })
      .catch((err) => console.error("[vault] could not save credentials:", err));
  };

  const isTarget = (s: Storage) => s === target;
  proto.getItem = function (this: Storage, k: string) {
    if (isTarget(this) && SENSITIVE_KEYS.has(k)) return cache.has(k) ? cache.get(k)! : null;
    return orig.getItem.call(this, k);
  };
  proto.setItem = function (this: Storage, k: string, v: string) {
    if (isTarget(this) && SENSITIVE_KEYS.has(k)) {
      cache.set(k, String(v));
      persist();
      return;
    }
    orig.setItem.call(this, k, v);
  };
  proto.removeItem = function (this: Storage, k: string) {
    if (isTarget(this) && SENSITIVE_KEYS.has(k)) {
      if (cache.delete(k)) persist();
      return;
    }
    orig.removeItem.call(this, k);
  };
  proto.clear = function (this: Storage) {
    if (isTarget(this)) cache.clear();
    orig.clear.call(this);
  };

  if (migrated || blob) persist();

  // Another tab re-encrypted the vault: pick up its credentials.
  const onStorage = (e: StorageEvent) => {
    if (e.storageArea !== target || e.key !== VAULT_KEY) return;
    if (!e.newValue) {
      cache.clear();
      return;
    }
    decryptJson<Record<string, string>>(subtle, key!, e.newValue)
      .then((entries) => {
        cache.clear();
        for (const [k, v] of Object.entries(entries)) if (SENSITIVE_KEYS.has(k)) cache.set(k, v);
      })
      .catch(() => {});
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
    // Let anything that read storage before the vault opened read it again.
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event(VAULT_READY_EVENT));
  }

  return {
    flush: () => chain,
    uninstall: () => {
      Object.assign(proto, orig);
      if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
    },
  };
}
