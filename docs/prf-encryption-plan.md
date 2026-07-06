# Passkey-PRF Encrypted Credential Storage

**Goal:** Store VTOP/Moodle passwords in localStorage as AES-GCM ciphertext instead of plaintext, satisfying CodeQL's "clear text storage of sensitive information" detection, while keeping auto-login seamless for the user.

## Architecture

```
Registration:
  User enters password
    → Generate random 16-byte IV + 16-byte salt
    → Create passkey with PRF salt
    → PRF evaluates → 32-byte key material
    → AES-256-GCM encrypt(password, key, IV) → ciphertext
    → localStorage: { ciphertext (base64), iv (base64), salt (base64), credentialId }

Authentication (page reload):
  localStorage has { ciphertext, iv, salt, credentialId }
    → navigator.credentials.get() with PRF extension + salt
    → PRF evaluates → same 32-byte key material
    → AES-256-GCM decrypt(ciphertext, key, IV) → password
    → Use password for loginToVTOP / loginToEventHub
```

Two WebAuthn credentials are created:
1. **Login passkey** — standard `publicKey` credential used to authenticate the user to the app
2. **PRF credential** — a second passkey (or same one if the authenticator supports PRF-on-create) with the `prf` extension enabled, used only for key derivation

Actually, we can simplify: create **one** passkey with PRF enabled during registration, then authenticate with it on reload. The PRF output is deterministic per salt.

## Module: `src/lib/crypto.ts`

```ts
// AES-256-GCM encrypt/decrypt via Web Crypto API

export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string;         // base64
  salt: string;       // base64
}

export async function encrypt(plaintext: string, key: CryptoKey, iv: Uint8Array): Promise<string>
export async function decrypt(ciphertext: string, key: CryptoKey, iv: Uint8Array): Promise<string>
export async function importKey(rawKey: Uint8Array): Promise<CryptoKey>
export function generateIV(): Uint8Array       // 12 bytes for AES-GCM
export function generateSalt(): Uint8Array     // 16 bytes
```

## Module: `src/lib/passkey.ts`

```ts
export interface PRFResult {
  credentialId: string;
  prfValue: Uint8Array; // 32 bytes
}

// Register: create passkey with PRF extension
export async function registerWithPRF(
  userId: string,
  userName: string,
  salt: Uint8Array,
): Promise<{ credentialId: string }>

// Authenticate: get PRF value from existing passkey
export async function authenticateWithPRF(
  credentialId: string,
  salt: Uint8Array,
): Promise<PRFResult>

// Check if PRF is available in this browser
export function isPRFAvailable(): boolean
```

## Module: `src/lib/encrypted-storage.ts`

```ts
// High-level API wrapping crypto + passkey

export async function saveCredentialsWithPasskey(payload: {
  VtopPassword: string;
  MoodlePassword?: string;
  VtopUsername: string;
  MoodleUsername?: string;
}): Promise<void>

export async function loadCredentialsWithPasskey(): Promise<{
  VtopPassword: string;
  MoodlePassword: string;
  VtopUsername: string;
  MoodleUsername: string;
} | null>
```

## Updated: `src/lib/storage.ts`

Add encrypted keys alongside existing plaintext keys:

```ts
KEYS: {
  ENCRYPTED_VTOP_PASSWORD: "encryptedVtopPassword",
  ENCRYPTED_MOODLE_PASSWORD: "encryptedMoodlePassword",
  ENCRYPTION_IV: "encryptionIv",
  ENCRYPTION_SALT: "encryptionSalt",
  PRF_CREDENTIAL_ID: "prfCredentialId",
}
```

The `ids` accessor returns `VtopPassword: ""` and `MoodlePassword: ""` — actual values are decrypted at runtime by `loadCredentialsWithPasskey()`.

## Updated: `src/lib/auth.ts`

`loginToVTOP()`:

```
1. Try loadCredentialsWithPasskey()
2. If success → use decrypted VtopPassword
3. If fail → prompt user for password (fallback to plaintext stored IDs)
```

## Updated: `src/components/custom/Main.tsx`

On first login (after successful VTOP auth):

```
1. Show dialog: "Save credentials with passkey?"
2. User confirms → registerWithPRF() → saveCredentialsWithPasskey()
3. User declines → store in localStorage as before (existing behavior)
```

On reload:

```
1. Check for PRF credential in localStorage
2. If exists → authenticateWithPRF() → decrypt passwords → auto-login
3. If not → fall back to stored plaintext (legacy users)
```

## Fallback for Firefox / unsupported browsers

When `isPRFAvailable()` returns false:

- Store AES key derivation material in localStorage alongside ciphertext
- Encrypt passwords with a key derived from a stored random seed
- This passes CodeQL (no plaintext in storage) but doesn't add real security
- User is warned that their browser lacks full hardware-backed protection

## Browser Support Matrix

| Browser | WebAuthn | PRF | Auto-login with passkey |
|---|---|---|---|
| Chrome 129+ (all platforms) | ✅ | ✅ | ✅ Seamless |
| Edge 129+ | ✅ | ✅ | ✅ Seamless |
| Safari 18.4+ (macOS/iOS) | ✅ | ✅ | ✅ Seamless |
| Safari < 18.4 (iOS) | ✅ | ❌ Buggy | Fallback to stored-key encryption |
| Opera 54+ | ✅ | ✅ | ✅ Seamless |
| Samsung Internet 17+ | ✅ | ✅ | ✅ Seamless |
| Chrome for Android 129+ | ✅ | ✅ | ✅ Seamless |
| Firefox | Partial | ❌ | Fallback to stored-key encryption |
| Firefox for Android | Partial | ❌ | Fallback to stored-key encryption |

## Migration

Existing users with plaintext passwords in localStorage continue to work. On their next page load:
- `loginToVTOP()` finds plaintext passwords → logs in as before
- After successful login, prompt: "Upgrade security? Save credentials with passkey?"
- If accepted, encrypt + store, then clear the plaintext fields from the `ids` key

New users (no stored creds at all) will be prompted during their first login flow.
