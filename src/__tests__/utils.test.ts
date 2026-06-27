import { describe, it, expect, vi } from 'vitest';
import { getAssetPath } from '../lib/utils';

describe('getAssetPath', () => {
    it('should prepend NEXT_PUBLIC_BASE_PATH when available', () => {
        vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/test-base');
        expect(getAssetPath('/images/logo.png')).toBe('/test-base/images/logo.png');
    });

    it('should not prepend anything if NEXT_PUBLIC_BASE_PATH is empty', () => {
        vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '');
        expect(getAssetPath('/images/logo.png')).toBe('/images/logo.png');
    });

    it('should ensure there are no double slashes', () => {
        vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/test-base/');
        expect(getAssetPath('/images/logo.png')).toBe('/test-base/images/logo.png');
    });
});
