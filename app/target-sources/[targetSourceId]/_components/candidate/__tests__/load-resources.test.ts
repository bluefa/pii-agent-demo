// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { AppError } from '@/lib/errors';
import {
  fetchResourcesWithRetry,
  isTransientError,
} from '@/app/target-sources/[targetSourceId]/_components/candidate/load-resources';

const appError = (code: ConstructorParameters<typeof AppError>[0]['code'], retriable: boolean) =>
  new AppError({ status: 0, code, message: code, retriable });

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

  it('rethrows immediately when shouldRetryError classifies the error as non-retriable', async () => {
    const err = new Error('forbidden');
    const fetchOnce = vi.fn().mockRejectedValue(err);
    await expect(
      fetchResourcesWithRetry(fetchOnce, 4, noDelay, () => false),
    ).rejects.toBe(err);
    expect(fetchOnce).toHaveBeenCalledTimes(1); // no retry burned on a hard failure
  });

  it('keeps retrying only errors the predicate accepts', async () => {
    const transient = new Error('transient');
    const hard = new Error('hard');
    const fetchOnce = vi
      .fn()
      .mockRejectedValueOnce(transient)
      .mockRejectedValueOnce(hard);
    await expect(
      fetchResourcesWithRetry(fetchOnce, 4, noDelay, (e) => e === transient),
    ).rejects.toBe(hard);
    expect(fetchOnce).toHaveBeenCalledTimes(2);
  });
});

// The production classifier used by useCandidateResources (AP-T1: cover atypical
// rejection values, not just Error instances).
describe('isTransientError', () => {
  it('never retries an abort, even when flagged retriable', () => {
    expect(isTransientError(appError('ABORTED', true))).toBe(false);
  });

  it('never retries a non-retriable AppError (e.g. FORBIDDEN)', () => {
    expect(isTransientError(appError('FORBIDDEN', false))).toBe(false);
  });

  it('retries a retriable AppError (e.g. NETWORK)', () => {
    expect(isTransientError(appError('NETWORK', true))).toBe(true);
  });

  it('treats non-AppError rejections as transient (Error, string, object, undefined)', () => {
    expect(isTransientError(new Error('boom'))).toBe(true);
    expect(isTransientError('boom')).toBe(true);
    expect(isTransientError({ code: 'FORBIDDEN' })).toBe(true);
    expect(isTransientError(undefined)).toBe(true);
  });
});
