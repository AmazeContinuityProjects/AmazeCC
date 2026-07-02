export type SettingsVisibilityState = {
  showGpa?: boolean;
  showProfilePhoto?: boolean;
};

export function shouldShowGpa(settings: SettingsVisibilityState | null | undefined): boolean {
  return Boolean(settings?.showGpa);
}

export function shouldShowProfilePhoto(settings: SettingsVisibilityState | null | undefined): boolean {
  return Boolean(settings?.showProfilePhoto);
}
