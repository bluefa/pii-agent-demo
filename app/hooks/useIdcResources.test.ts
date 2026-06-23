// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';
import { useIdcResources } from '@/app/hooks/useIdcResources';
import { getIdcPreviousRequest, type IdcResourceView } from '@/app/lib/api/idc';

vi.mock('@/app/lib/api/idc', () => ({ getIdcPreviousRequest: vi.fn() }));

const mockGet = vi.mocked(getIdcPreviousRequest);

/**
 * The shared IDC read. The abort/error discriminator gates all four read-only
 * steps (2/3/6/7), so it is tested with both an `AppError(ABORTED)` (swallowed)
 * and an unrelated rejection (surfaced as `error`).
 */
describe('useIdcResources', () => {
  afterEach(() => vi.clearAllMocks());

  it('resolves to ready with the fetched resources', async () => {
    const resources = [{ resourceId: 'r1' }] as unknown as IdcResourceView[];
    mockGet.mockResolvedValue(resources);

    const { result } = renderHook(() => useIdcResources(1));
    expect(result.current.state.status).toBe('loading');

    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(result.current.state).toEqual({ status: 'ready', resources });
  });

  it('resolves to error on a non-abort failure', async () => {
    mockGet.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useIdcResources(1));
    await waitFor(() => expect(result.current.state.status).toBe('error'));
  });

  it('swallows an AppError(ABORTED) and stays loading', async () => {
    mockGet.mockRejectedValue(
      new AppError({ status: 0, code: 'ABORTED', message: 'aborted', retriable: false }),
    );

    const { result } = renderHook(() => useIdcResources(1));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.state.status).toBe('loading');
  });
});
