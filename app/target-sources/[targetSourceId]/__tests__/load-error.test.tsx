// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { BffError } from '@/lib/bff/errors';
import { passRoutes } from '@/lib/routes';
import {
  TARGET_SOURCE_LOAD_FALLBACK,
  targetSourceLoadMessage,
} from '@/app/target-sources/[targetSourceId]/load-error';
import { ErrorState } from '@/app/target-sources/[targetSourceId]/_components/common/ErrorState';

const bffError = (status: number) =>
  new BffError(status, 'UPSTREAM', 'Internal upstream detail — never user-facing');

describe('targetSourceLoadMessage', () => {
  it('names the failure the user can act on', () => {
    expect(targetSourceLoadMessage(bffError(404))).toContain('찾을 수 없어요');
    expect(targetSourceLoadMessage(bffError(403))).toContain('권한이 없어요');
    expect(targetSourceLoadMessage(bffError(401))).toContain('권한이 없어요');
  });

  it('falls back for anything it cannot classify', () => {
    expect(targetSourceLoadMessage(bffError(500))).toBe(TARGET_SOURCE_LOAD_FALLBACK);
    expect(targetSourceLoadMessage(bffError(502))).toBe(TARGET_SOURCE_LOAD_FALLBACK);
    expect(targetSourceLoadMessage(new TypeError('fetch failed'))).toBe(
      TARGET_SOURCE_LOAD_FALLBACK,
    );
    expect(targetSourceLoadMessage(undefined)).toBe(TARGET_SOURCE_LOAD_FALLBACK);
  });

  /**
   * ADR-008: the upstream's own wording is diagnostics. If a message ever leaks
   * through, the screen starts speaking whatever the BFF wrote — in whatever
   * language it wrote it.
   */
  it('never returns the upstream message', () => {
    for (const status of [400, 401, 403, 404, 409, 500, 503]) {
      expect(targetSourceLoadMessage(bffError(status))).not.toContain('upstream detail');
    }
  });
});

describe('ErrorState', () => {
  it('shows the message it is given', () => {
    const { getByRole } = render(<ErrorState message="요청하신 연동 대상을 찾을 수 없어요." />);
    expect(getByRole('alert').textContent).toContain('요청하신 연동 대상을 찾을 수 없어요.');
  });

  it('still says something when the message is missing', () => {
    for (const message of [undefined, null, '']) {
      const { getByRole, unmount } = render(<ErrorState message={message} />);
      // Not an empty line under the heading — a caller with nothing to say still
      // leaves the user a sentence.
      expect(getByRole('alert').textContent).toContain('불러오지 못했어요');
      unmount();
    }
  });

  /**
   * The escape hatch is a fixed destination, not history. `router.back()` from a
   * page that failed on first load either leaves the app or returns to the URL
   * that just failed.
   */
  it('leaves to the service list', () => {
    const { getByRole } = render(<ErrorState message="실패" />);
    const link = getByRole('link', { name: 'Service 목록으로 돌아가기' });
    // basePath (/pass) is applied by next/link, so the href here is basePath-relative.
    expect(link.getAttribute('href')).toBe(passRoutes.services);
  });
});
