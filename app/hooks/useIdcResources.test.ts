// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';
import { useIdcResources, type IdcResourceSource } from '@/app/hooks/useIdcResources';
import type { IdcResourceView } from '@/app/lib/api/idc';

/**
 * The shared IDC read. The read source is injected per step (Step 2 approval,
 * Step 3 approved, Step 6/7 confirmed), so the hook is tested with a stub source.
 * The abort/error discriminator gates all four read-only steps, so it is tested
 * with both an `AppError(ABORTED)` (swallowed) and an unrelated rejection
 * (surfaced as `error`).
 */
describe('useIdcResources', () => {
  afterEach(() => vi.clearAllMocks());

  it('resolves to ready with the fetched resources', async () => {
    const resources = [{ resourceId: 'r1' }] as unknown as IdcResourceView[];
    const source: IdcResourceSource = vi.fn().mockResolvedValue(resources);

    const { result } = renderHook(() => useIdcResources(1, source));
    expect(result.current.state.status).toBe('loading');

    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(result.current.state).toEqual({ status: 'ready', resources });
  });

  it('resolves to error on a non-abort failure', async () => {
    const source: IdcResourceSource = vi.fn().mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useIdcResources(1, source));
    await waitFor(() => expect(result.current.state.status).toBe('error'));
  });

  it('swallows an AppError(ABORTED) and stays loading', async () => {
    const source: IdcResourceSource = vi.fn().mockRejectedValue(
      new AppError({ status: 0, code: 'ABORTED', message: 'aborted', retriable: false }),
    );

    const { result } = renderHook(() => useIdcResources(1, source));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.state.status).toBe('loading');
  });
});
