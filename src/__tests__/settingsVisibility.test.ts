import { describe, expect, it } from 'vitest';
import { shouldShowGpa, shouldShowProfilePhoto } from '../lib/settingsVisibility';

describe('dashboard visibility settings', () => {
  it('defaults to hiding GPA and profile photo', () => {
    expect(shouldShowGpa({})).toBe(false);
    expect(shouldShowProfilePhoto({})).toBe(false);
  });

  it('respects explicitly enabled settings', () => {
    expect(shouldShowGpa({ showGpa: true })).toBe(true);
    expect(shouldShowProfilePhoto({ showProfilePhoto: true })).toBe(true);
  });
});
