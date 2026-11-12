import { installLocalStorage } from "./helpers/localStorage";
installLocalStorage();
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  __resetCredentialVaultForTests,
  installCredentialVault,
  SESSION_MARKER_KEY,
  VAULT_KEY,
  type KeyStore,
  type VaultHandle,
} from "../lib/credentialVault";

const subtle = webcrypto.subtle as unknown as SubtleCrypto;

function memoryKeyStore(): KeyStore & { key: CryptoKey | null } {
  const ks = {
    key: null as CryptoKey | null,
    get: async () => ks.key,
    put: async (k: CryptoKey) => {
      ks.key = k;
    },
  };
  return ks;
}

const IDS = JSON.stringify({ VtopUsername: "21BCE0000", VtopPassword: "hunter2-secret" });

/** What is physically in localStorage, bypassing the vault's patch. */
const rawGet = (k: string) => Object.getOwnPropertyDescriptor(localStorage, k)?.value ?? null;
const rawKeys = () => Object.keys(localStorage);

let handle: VaultHandle | null = null;
async function open(keyStore: KeyStore) {
  __resetCredentialVaultForTests();
  handle = await installCredentialVault({ storage: localStorage, keyStore, subtle });
  return handle;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  handle?.uninstall();
  handle = null;
  localStorage.clear();
});

describe("credential vault", () => {
  it("moves plain-text passwords into an encrypted blob", async () => {
    localStorage.setItem("IDs", IDS);
    localStorage.setItem("koha_password", "library-pass");
    localStorage.setItem("theme", "dark");

    const h = await open(memoryKeyStore());
    await h!.flush();

    // The app still reads the same values through localStorage...
    expect(localStorage.getItem("IDs")).toBe(IDS);
    expect(localStorage.getItem("koha_password")).toBe("library-pass");
    // ...but nothing on disk contains them any more.
    expect(rawKeys()).not.toContain("IDs");
    expect(rawKeys()).not.toContain("koha_password");
    const blob = rawGet(VAULT_KEY) as string;
    expect(blob).toBeTruthy();
    expect(blob).not.toContain("hunter2-secret");
    expect(blob).not.toContain("library-pass");
    // Non-sensitive keys are untouched.
    expect(rawGet("theme")).toBe("dark");
    // The early session script's marker is set.
    expect(rawGet(SESSION_MARKER_KEY)).toBe("1");
  });

  it("encrypts new writes and reads them back after a reload", async () => {
    const keys = memoryKeyStore();
    let h = await open(keys);
    localStorage.setItem("moodle_password", "moodle-pass");
    await h!.flush();
    expect(rawGet(VAULT_KEY)).not.toContain("moodle-pass");

    h!.uninstall(); // simulate a reload: same storage, same IndexedDB key
    h = await open(keys);
    expect(localStorage.getItem("moodle_password")).toBe("moodle-pass");
  });

  it("drops the blob when the key is gone instead of failing", async () => {
    let h = await open(memoryKeyStore());
    localStorage.setItem("IDs", IDS);
    await h!.flush();
    h!.uninstall();

    h = await open(memoryKeyStore()); // a fresh key cannot decrypt the old blob
    expect(localStorage.getItem("IDs")).toBeNull();
    expect(rawGet(VAULT_KEY)).toBeNull();
  });

  it("removeItem and clear forget credentials", async () => {
    const h = await open(memoryKeyStore());
    localStorage.setItem("IDs", IDS);
    localStorage.setItem("password", "p");
    localStorage.removeItem("password");
    expect(localStorage.getItem("password")).toBeNull();

    localStorage.clear();
    await h!.flush();
    expect(localStorage.getItem("IDs")).toBeNull();
    expect(rawGet(VAULT_KEY)).toBeNull();
    expect(rawGet(SESSION_MARKER_KEY)).toBeNull();
  });

  it("stays off, leaving storage as it was, when no key store is available", async () => {
    localStorage.setItem("IDs", IDS);
    __resetCredentialVaultForTests();
    const failingStore: KeyStore = {
      get: () => Promise.reject(new Error("IndexedDB blocked")),
      put: () => Promise.reject(new Error("IndexedDB blocked")),
    };
    const warn = console.warn;
    console.warn = () => {};
    handle = await installCredentialVault({ storage: localStorage, keyStore: failingStore, subtle });
    console.warn = warn;
    expect(handle).toBeNull();
    expect(rawGet("IDs")).toBe(IDS);
  });
});
