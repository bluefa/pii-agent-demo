import { afterEach, describe, expect, it, vi } from 'vitest';
import { redirectToSsoLogin, ssoLoginPath } from '@/lib/sso-login';

/**
 * `window` is stubbed whole rather than run under jsdom: jsdom's `location` is
 * unforgeable and refuses a real navigation, and the only thing worth pinning here
 * is the URL the module builds.
 */
const stubWindow = (pathname: string, search: string) => {
  const assign = vi.fn();
  vi.stubGlobal('window', { location: { pathname, search, assign } });
  return assign;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ssoLoginPath', () => {
  /**
   * `returnTo` is echoed back by the BFF as the post-login `Location`, so it rides
   * as one opaque query value. Unencoded, its own `?tab=` would read as a second
   * parameter of the login URL and the reader would return to a stripped page.
   */
  it('encodes returnTo so its query survives the trip', () => {
    expect(ssoLoginPath('/pass/target-sources/1?tab=scan&x=a b')).toBe(
      '/sso/login?returnTo=%2Fpass%2Ftarget-sources%2F1%3Ftab%3Dscan%26x%3Da%20b',
    );
  });

  // basePath-relative: `redirect()` and `next/link` add `/pass` themselves.
  it('is basePath-relative', () => {
    expect(ssoLoginPath('/pass/admin').startsWith('/sso/login?')).toBe(true);
  });
});

describe('redirectToSsoLogin', () => {
  /**
   * `location.assign` is not basePath-aware, so this destination carries `/pass`
   * literally — and `location.pathname` is the raw URL, so returnTo already has it.
   * Dropping either prefix sends the reader to a 404 instead of to ADFS.
   */
  it('leaves for SSO carrying the page it was on', () => {
    const assign = stubWindow('/pass/target-sources/1', '?tab=scan');

    redirectToSsoLogin();

    expect(assign).toHaveBeenCalledWith(
      '/pass/sso/login?returnTo=%2Fpass%2Ftarget-sources%2F1%3Ftab%3Dscan',
    );
  });

  it('keeps a bare path bare', () => {
    const assign = stubWindow('/pass/admin', '');

    redirectToSsoLogin();

    expect(assign).toHaveBeenCalledWith('/pass/sso/login?returnTo=%2Fpass%2Fadmin');
  });
});
