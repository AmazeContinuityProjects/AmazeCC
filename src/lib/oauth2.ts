/**
 * Amaze ID OIDC client (authorization code + PKCE, RFC 6749 §4.1 + RFC 7636).
 *
 * This is a static SPA (GitHub Pages), so it is a *public* OAuth client:
 * no client secret (anything shipped to the browser is public). Confidentiality
 * comes from PKCE + exact-match redirect URIs. The server side issues short-lived
 * (1h) access tokens; refresh tokens rotate on use and are revoked on sign-out.
 *
 * The ID token is intentionally NOT validated here - user identity comes from
 * the userinfo endpoint (`customUserInfoClaims` puts `role`/`permissions` on it),
 * which is signed to the caller and always fresh.
 *
 * SSO: visiting while signed in at auth.amazecc.com silently completes the
 * authorize step (skip_consent on the client + `prompt=none`), so one Amaze ID
 * session covers every AmazeCC app.
 */
const AUTH_BASE = process.env.NEXT_PUBLIC_AUTH_URL ?? "https://auth.amazecc.com";

export const OIDC = {
  clientId: "amazecc-web",
  redirectUri: () => `${window.location.origin}/auth/callback`,
  scope: "openid profile email",
  authorizeEndpoint: `${AUTH_BASE}/api/auth/oauth2/authorize`,
  tokenEndpoint: `${AUTH_BASE}/api/auth/oauth2/token`,
  userinfoEndpoint: `${AUTH_BASE}/api/auth/oauth2/userinfo`,
  revocationEndpoint: `${AUTH_BASE}/api/auth/oauth2/revoke`,
} as const;

const KEYS = {
  accessToken: "amaze_oidc_access_token",
  refreshToken: "amaze_oidc_refresh_token", // legacy cleanup only - scope no longer includes offline_access
  expiresAt: "amaze_oidc_expires_at",
  idToken: "amaze_oidc_id_token",
  user: "amaze_oidc_user",
  // Set on BOTH sign-out paths - blocks silent re-auth until the user signs in again.
  signedOut: "amaze_oidc_signed_out",
  // One silent auto-attempt per browser tab session - prevents redirect loops
  // when the IdP has no session (prompt=none would bounce back with login_required).
  autoAttempted: "amaze_oidc_auto_attempted",
  // Per-authorization PKCE state (sessionStorage so tabs don't clobber each other).
  verifier: "amaze_oidc_verifier",
  state: "amaze_oidc_state",
} as const;

export interface StoredUser {
  sub: string;
  name: string;
  email: string;
  role: "superadmin" | "admin" | "user";
  permissions: string[];
}

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const b of arr) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomString(byteLength = 48): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomString(48);
  const challenge = base64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return { verifier, challenge };
}

function storeTokens(data: { access_token: string; expires_in?: number; refresh_token?: string; id_token?: string }) {
  localStorage.setItem(KEYS.accessToken, data.access_token);
  // 30s clock-skew buffer so we never race token expiry at the API.
  const expiresAt = Date.now() + Math.max((data.expires_in ?? 3600) - 30, 60) * 1000;
  localStorage.setItem(KEYS.expiresAt, String(expiresAt));
  if (data.refresh_token) localStorage.setItem(KEYS.refreshToken, data.refresh_token);
  if (data.id_token) localStorage.setItem(KEYS.idToken, data.id_token);
}

export function clearOidcStorage() {
  for (const key of [KEYS.accessToken, KEYS.refreshToken, KEYS.expiresAt, KEYS.user, KEYS.idToken]) {
    localStorage.removeItem(key);
  }
  // One-time cleanup of the pre-OIDC storage keys.
  for (const key of ["admin_token", "admin_role", "admin_permissions"]) {
    localStorage.removeItem(key);
  }
}

export function getStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(KEYS.user);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

/** Cached token that is certainly still valid, else null. Never blocks on a refresh. */
export function getAccessTokenSync(): string | null {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return null;
  try {
    const token = localStorage.getItem(KEYS.accessToken);
    const exp = Number(localStorage.getItem(KEYS.expiresAt) ?? 0);
    return token && Date.now() < exp ? token : null;
  } catch {
    return null;
  }
}

async function fetchUserinfo(accessToken: string): Promise<StoredUser | null> {
  const res = await fetch(OIDC.userinfoEndpoint, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as Record<string, unknown>;
  const rawRole = typeof body.role === "string" ? body.role : "user";
  const role: StoredUser["role"] = rawRole === "superadmin" ? "superadmin" : rawRole === "admin" ? "admin" : "user";
  const perms =
    typeof body.permissions === "string"
      ? body.permissions
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean)
      : Array.isArray(body.permissions)
        ? (body.permissions as string[])
        : [];
  const user: StoredUser = {
    sub: String(body.sub ?? ""),
    name: typeof body.name === "string" ? body.name : String(body.email ?? ""),
    email: String(body.email ?? ""),
    role,
    permissions: perms,
  };
  localStorage.setItem(KEYS.user, JSON.stringify(user));
  return user;
}

export interface CallbackResult {
  ok: boolean;
  error?: string;
}

/** Complete the authorization_code flow. Call from the /auth/callback page. */
export async function handleCallback(): Promise<CallbackResult> {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");
  if (error) {
    return { ok: false, error: params.get("error_description") ?? error };
  }
  const code = params.get("code");
  const state = params.get("state");
  const expectedState = sessionStorage.getItem(KEYS.state);
  if (!code || !state || !expectedState || state !== expectedState) {
    return { ok: false, error: "The sign-in response didn't match this browser. Please try again." };
  }
  const verifier = sessionStorage.getItem(KEYS.verifier);
  if (!verifier) {
    return { ok: false, error: "Missing PKCE verifier - please sign in again." };
  }

  const res = await fetch(OIDC.tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: OIDC.redirectUri(),
      client_id: OIDC.clientId,
      code_verifier: verifier,
    }).toString(),
  });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !body || typeof body.access_token !== "string") {
    const desc = body && typeof body.error_description === "string" ? body.error_description : "Token exchange failed.";
    return { ok: false, error: desc };
  }
  storeTokens(body as { access_token: string; expires_in?: number; refresh_token?: string; id_token?: string });
  await fetchUserinfo(body.access_token as string);
  sessionStorage.removeItem(KEYS.verifier);
  sessionStorage.removeItem(KEYS.state);
  // Fresh sign-in: re-enable silent flows again.
  sessionStorage.removeItem(KEYS.autoAttempted);
  sessionStorage.removeItem(KEYS.signedOut);
  return { ok: true };
}

/**
 * Renewal model: no refresh tokens. Access tokens live 1h; renewal is a
 * silent prompt=none re-authorization against the live IdP session (the
 * mount-time flow and the 401-driven `handleUnauthorized` both use it).
 * When the device-global sign-out kills the session, nothing outlives it.
 */
export async function ensureFreshAccessToken(): Promise<string | null> {
  return getAccessTokenSync();
}

/**
 * Sign the user out of THIS app only. The IdP session survives, so other
 * AmazeCC apps keep working and this app can sign straight back in via SSO.
 * Revocation is verified (the app would otherwise keep working for up to 1h).
 * Returns whether every presented token was revoked at the IdP.
 */
export async function signOutApp(): Promise<{ revoked: boolean }> {
  const access = localStorage.getItem(KEYS.accessToken);
  const refresh = localStorage.getItem(KEYS.refreshToken);
  const results = await Promise.all([
    access ? revoke(access, "access_token") : Promise.resolve(true),
    refresh ? revoke(refresh, "refresh_token") : Promise.resolve(true),
  ]);
  clearOidcStorage();
  // Stop silent re-auth until the user explicitly signs in again.
  sessionStorage.setItem(KEYS.signedOut, "1");
  sessionStorage.setItem(KEYS.autoAttempted, "1");
  return { revoked: results.every(Boolean) };
}

/**
 * Sign the user out of Amaze ID on THIS DEVICE. Revokes this app's tokens,
 * drops local state, then sends the browser through the IdP's
 * RP-Initiated Logout - the device session dies, and with it the
 * session-bound tokens of EVERY app on this device (via the session-delete
 * hook). All apps land back on their sign-in cards.
 */
export function signOutDevice(): void {
  const access = localStorage.getItem(KEYS.accessToken);
  const refresh = localStorage.getItem(KEYS.refreshToken);
  const idToken = localStorage.getItem(KEYS.idToken);
  if (access) void revoke(access, "access_token"); // belt - the session kill hook revokes too
  if (refresh) void revoke(refresh, "refresh_token");
  clearOidcStorage();
  sessionStorage.setItem(KEYS.signedOut, "1");
  sessionStorage.setItem(KEYS.autoAttempted, "1");
  const params = new URLSearchParams({
    client_id: OIDC.clientId,
    post_logout_redirect_uri: `${window.location.origin}/`,
  });
  if (idToken) params.set("id_token_hint", idToken); // skips the confirmation interstitial
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- external IdP navigation, not an internal route
  window.location.assign(
    `${process.env.NEXT_PUBLIC_AUTH_URL ?? "https://auth.amazecc.com"}/api/auth/oauth2/end-session?${params.toString()}`,
  );
}

/**
 * Called on HTTP 401 from the API: silently re-authorizes through the IdP
 * (prompt=none) if the user has not explicitly signed out. The page reloads
 * with fresh tokens; if the IdP session is dead the app lands back on its
 * sign-in card instead.
 */
export function handleUnauthorized(): boolean {
  if (sessionStorage.getItem(KEYS.signedOut) === "1") return false;
  if (sessionStorage.getItem(KEYS.autoAttempted) === "1") return false; // one silent hop per page life
  sessionStorage.setItem(KEYS.autoAttempted, "1");
  void authorize("none");
  return true;
}

/** RFC 7009 revocation - public clients are allowed (200 even for unknown tokens). */
async function revoke(token: string, hint: "refresh_token" | "access_token"): Promise<boolean> {
  try {
    const res = await fetch(OIDC.revocationEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token, client_id: OIDC.clientId, token_type_hint: hint }).toString(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function authorize(prompt: "none" | "login" | null) {
  const { verifier, challenge } = await createPkcePair();
  const state = randomString(24);
  sessionStorage.setItem(KEYS.verifier, verifier);
  sessionStorage.setItem(KEYS.state, state);
  const params = new URLSearchParams({
    client_id: OIDC.clientId,
    redirect_uri: OIDC.redirectUri(),
    response_type: "code",
    scope: OIDC.scope,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });
  if (prompt) params.set("prompt", prompt);
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- external IdP navigation, not an internal route
  window.location.assign(`${OIDC.authorizeEndpoint}?${params.toString()}`);
}

/** Interactive sign-in (explicit click). */
export function signInInteractive() {
  sessionStorage.removeItem(KEYS.autoAttempted);
  void authorize(null);
}

/** Silent SSO attempt - only if the IdP session exists. Returns false when it bailed to the button. */
export function trySilentSignIn(): boolean {
  if (sessionStorage.getItem(KEYS.signedOut) === "1") return false; // explicit sign-out wins over SSO
  if (sessionStorage.getItem(KEYS.autoAttempted) === "1") return false;
  sessionStorage.setItem(KEYS.autoAttempted, "1");
  void authorize("none");
  return true;
}
