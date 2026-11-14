/**
 * DPoP (RFC 9449) for Amaze ID.
 *
 * Generates an ECDSA P-256 key pair stored in IndexedDB;
 * exports it as JWK for thumbprint computation;
 * produces a fresh proof JWT per HTTP request.
 */
const DB_NAME = "amazecc-dpop";
const STORE = "keys";
const KEY_ID = "default";

let cachedKeys: CryptoKeyPair | null = null;

async function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore(STORE, { keyPath: "id" });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function readKeys(): Promise<CryptoKeyPair | null> {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readonly");
    const r = tx.objectStore(STORE).get(KEY_ID);
    r.onsuccess = () => {
      if (r.result) res({ publicKey: r.result.publicKey, privateKey: r.result.privateKey });
      else res(null);
      db.close();
    };
    r.onerror = () => rej(r.error);
  });
}

async function writeKeys(pair: CryptoKeyPair): Promise<void> {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ id: KEY_ID, publicKey: pair.publicKey, privateKey: pair.privateKey });
    tx.oncomplete = () => {
      db.close();
      res();
    };
    tx.onerror = () => rej(tx.error);
  });
}

export async function getDpopKeys(): Promise<CryptoKeyPair> {
  if (cachedKeys) return cachedKeys;
  let pair = await readKeys();
  if (!pair) {
    pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    await writeKeys(pair);
  }
  cachedKeys = pair;
  return pair;
}

/** RFC 7638 thumbprint of the JWK. */
export async function dpopThumbprint(): Promise<string> {
  const pair = await getDpopKeys();
  const pub = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
  // Canonical form: sorted keys, no whitespace
  const canon = JSON.stringify(
    { crv: pub.crv, kty: pub.kty, x: pub.x, y: pub.y },
    Object.keys({ crv: 1, kty: 1, x: 1, y: 1 }).sort(),
  );
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canon));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Produce a DPoP proof for a single request. */
export async function dpopProof(method: string, url: string, accessToken?: string): Promise<string> {
  const pair = await getDpopKeys();
  const pub = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
  const payload: Record<string, string> = {
    jti: b64url(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))),
    htm: method.toUpperCase(),
    htu: url,
    iat: String(Math.floor(Date.now() / 1000)),
  };
  if (accessToken) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(accessToken));
    payload.ath = b64url(String.fromCharCode(...new Uint8Array(digest)));
  }
  const header = b64url(JSON.stringify({ typ: "dpop+jwt", alg: "ES256", jwk: pub }));
  const body = b64url(JSON.stringify(payload));
  const input = `${header}.${body}`;
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    pair.privateKey,
    new TextEncoder().encode(input),
  );
  return `${input}.${b64url(String.fromCharCode(...new Uint8Array(sig)))}`;
}
