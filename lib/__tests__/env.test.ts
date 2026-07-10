import { afterEach, describe, it, expect, vi } from 'vitest';
import { isMock, assertBuildEnv, assertRuntimeEnv } from '@/lib/env';

describe('env (LIN-60)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('isMock', () => {
    it.each([
      ['true', true],
      ['false', false],
      ['', false],
      ['1', false],
      ['TRUE', false],
    ])('USE_MOCK_DATA=%j ⇒ %s', (value, expected) => {
      vi.stubEnv('USE_MOCK_DATA', value);
      expect(isMock()).toBe(expected);
    });

    it('미설정 ⇒ false (real 기본값)', () => {
      vi.stubEnv('USE_MOCK_DATA', undefined);
      expect(isMock()).toBe(false);
    });
  });

  describe('assertRuntimeEnv', () => {
    it('real 모드 + BFF_API_URL 미설정 ⇒ throw', () => {
      vi.stubEnv('USE_MOCK_DATA', undefined);
      vi.stubEnv('BFF_API_URL', undefined);
      expect(() => assertRuntimeEnv()).toThrow(/BFF_API_URL is required/);
    });

    it('real 모드 + BFF_API_URL 설정 ⇒ 통과', () => {
      vi.stubEnv('USE_MOCK_DATA', undefined);
      vi.stubEnv('BFF_API_URL', 'https://bff.example.com');
      expect(() => assertRuntimeEnv()).not.toThrow();
    });

    it('mock 모드 ⇒ BFF_API_URL 없어도 통과', () => {
      vi.stubEnv('USE_MOCK_DATA', 'true');
      vi.stubEnv('BFF_API_URL', undefined);
      expect(() => assertRuntimeEnv()).not.toThrow();
    });

    it('BFF_API_URL이 URL 형식이 아니면 throw', () => {
      vi.stubEnv('BFF_API_URL', 'not-a-url');
      expect(() => assertRuntimeEnv()).toThrow(/Invalid environment/);
    });
  });

  describe('prod + mock', () => {
    // Build gate warns (does not throw): next build is always NODE_ENV=production
    // and the pre-commit hook builds with the dev's mock .env.local.
    it('assertBuildEnv: NODE_ENV=production + USE_MOCK_DATA=true ⇒ warn, no throw', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('USE_MOCK_DATA', 'true');
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(() => assertBuildEnv()).not.toThrow();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('must never serve'));
      warn.mockRestore();
    });

    // Runtime gate hard-blocks: NODE_ENV=production at runtime = real prod server.
    it('assertRuntimeEnv: NODE_ENV=production + USE_MOCK_DATA=true ⇒ throw', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('USE_MOCK_DATA', 'true');
      expect(() => assertRuntimeEnv()).toThrow(/must never serve seed data/);
    });

    it('assertBuildEnv: BFF_API_URL 미설정이어도 통과 (빌드 시 런타임 env 부재 허용)', () => {
      vi.stubEnv('USE_MOCK_DATA', undefined);
      vi.stubEnv('BFF_API_URL', undefined);
      expect(() => assertBuildEnv()).not.toThrow();
    });
  });
});
