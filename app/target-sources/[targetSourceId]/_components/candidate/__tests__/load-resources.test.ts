// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { fetchResourcesWithRetry } from '@/app/target-sources/[targetSourceId]/_components/candidate/load-resources';

const noDelay = () => Promise.resolve();

describe('fetchResourcesWithRetry', () => {
  it('returns immediately on a non-empty first result', async () => {
    const fetchOnce = vi.fn().mockResolvedValue([1]);
    expect(await fetchResourcesWithRetry(fetchOnce, 4, noDelay)).toEqual([1]);
    expect(fetchOnce).toHaveBeenCalledTimes(1);
  });

  it('retries an empty result up to maxAttempts, then returns empty', async () => {
    const fetchOnce = vi.fn().mockResolvedValue([]);
    expect(await fetchResourcesWithRetry(fetchOnce, 4, noDelay)).toEqual([]);
    expect(fetchOnce).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
  });

  it('stops retrying as soon as a non-empty result arrives', async () => {
    const fetchOnce = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValue([42]);
    expect(await fetchResourcesWithRetry(fetchOnce, 4, noDelay)).toEqual([42]);
    expect(fetchOnce).toHaveBeenCalledTimes(3);
  });

  it('retries on error, then rethrows the last error after maxAttempts', async () => {
    const err = new Error('boom');
    const fetchOnce = vi.fn().mockRejectedValue(err);
    await expect(fetchResourcesWithRetry(fetchOnce, 4, noDelay)).rejects.toBe(err);
    expect(fetchOnce).toHaveBeenCalledTimes(4);
  });

  it('recovers from a transient error', async () => {
    const fetchOnce = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue([7]);
    expect(await fetchResourcesWithRetry(fetchOnce, 4, noDelay)).toEqual([7]);
    expect(fetchOnce).toHaveBeenCalledTimes(2);
  });

  it('does not retry when maxAttempts is 1 (plain load: empty is a valid result)', async () => {
    const fetchOnce = vi.fn().mockResolvedValue([]);
    expect(await fetchResourcesWithRetry(fetchOnce, 1, noDelay)).toEqual([]);
    expect(fetchOnce).toHaveBeenCalledTimes(1);
  });
});
