import { storage } from "@/lib/storage";

type StoredCredentials = { VtopUsername?: string; VtopPassword?: string } | null;

export function hasStoredVtopCredentials(
  ids: StoredCredentials,
  legacyUsername: string | null,
  legacyPassword: string | null,
): boolean {
  return Boolean(
    (ids?.VtopUsername && ids?.VtopPassword) ||
    (legacyUsername && legacyPassword)
  );
}

/** Read only the small browser keys needed to choose guest or app entry. */
export function hasStoredAppSession(): boolean {
  const ids = storage.ids.get();
  const legacyUsername = storage.username.get();
  const legacyPassword = storage.password.get();

  return storage.demoMode.get() || hasStoredVtopCredentials(ids, legacyUsername, legacyPassword);
}
