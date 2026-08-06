// @vitest-environment jsdom
import { createElement, useEffect } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IdcInstallationView } from '@/app/lib/api/idc';

const handles = new Map<
  number,
  { resolve: (v: IdcInstallationView) => void; reject: (e: unknown) => void }
>();

vi.mock('@/app/lib/api/idc', () => ({
  getIdcInstallationStatus: (id: number) =>
    new Promise<IdcInstallationView>((resolve, reject) => {
      handles.set(id, { resolve, reject });
    }),
}));

import { useIdcInstallationStatus } from '@/app/hooks/useIdcInstallationStatus';

interface Frame {
  id: number;
  hasStatus: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * §DR4 — the effect's reset lands after paint and the IDC steps are not
 * remounted by key, so without a render-phase reset the first COMMITTED frame
 * for a new target carries the previous target's status/error. IdcStep4Installing
 * gates on `status`, so a leaked status is a leaked install table.
 *
 * Frames are recorded per commit rather than read off the hook result: act()
 * flushes the effect before an assertion on the result would run, which hides
 * the very frame under test.
 */
describe('useIdcInstallationStatus target switch', () => {
  afterEach(() => {
    handles.clear();
    vi.clearAllMocks();
  });

  const recordFrames = () => {
    const frames: Frame[] = [];
    const Probe = ({ id }: { id: number }) => {
      const { status, loading, error } = useIdcInstallationStatus(id);
      // No dep array — one call per commit, so discarded render passes are not
      // recorded and every painted frame is.
      useEffect(() => {
        frames.push({ id, hasStatus: status !== null, loading, error });
      });
      return null;
    };
    return { frames, Probe };
  };

  it('never commits the previous target status after a switch', async () => {
    const { frames, Probe } = recordFrames();
    const { rerender } = render(createElement(Probe, { id: 1 }));

    await act(async () => {
      handles.get(1)?.resolve({ resources: [] });
    });

    frames.length = 0;
    await act(async () => {
      rerender(createElement(Probe, { id: 2 }));
    });

    expect(frames.filter((f) => f.id === 2 && f.hasStatus)).toEqual([]);
    expect(frames.filter((f) => f.id === 2 && !f.hasStatus && !f.loading)).toEqual([]);
  });

  it('never commits the previous target error after a switch', async () => {
    const { frames, Probe } = recordFrames();
    const { rerender } = render(createElement(Probe, { id: 1 }));

    await act(async () => {
      handles.get(1)?.reject(new Error('target-1 failed'));
    });

    frames.length = 0;
    await act(async () => {
      rerender(createElement(Probe, { id: 2 }));
    });

    expect(frames.filter((f) => f.id === 2 && f.error !== null)).toEqual([]);
  });
});
