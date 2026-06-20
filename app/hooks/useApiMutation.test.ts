// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useApiMutation } from '@/app/hooks/useApiMutation';
import {
  registerGlobalToast,
  unregisterGlobalToast,
  type ToastBus,
} from '@/app/components/ui/toast/toastBus';

/**
 * The shared error-surfacing path. Per ADR-017 §3 a caught error must become a
 * rendered state, a toast, or a re-throw — never a silent catch. Consumers
 * (e.g. IDC Step 1 submit) rely on this default; testing it here covers them all.
 */
describe('useApiMutation', () => {
  let bus: ToastBus;

  beforeEach(() => {
    bus = {
      success: vi.fn(() => 'id'),
      error: vi.fn(() => 'id'),
      info: vi.fn(() => 'id'),
      warning: vi.fn(() => 'id'),
    };
    registerGlobalToast(bus);
  });

  afterEach(() => {
    unregisterGlobalToast(bus);
    vi.restoreAllMocks();
  });

  it('surfaces a failure as a toast and exposes the error (no silent swallow)', async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useApiMutation<void, void>(
        async () => {
          throw new Error('boom');
        },
        { onSuccess, errorMessage: '연동 대상 승인 요청에 실패했어요.' },
      ),
    );

    await act(async () => {
      await result.current.mutate(undefined);
    });

    expect(bus.error).toHaveBeenCalledWith('연동 대상 승인 요청에 실패했어요.');
    expect(result.current.error).toBeInstanceOf(Error);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it('runs onSuccess and shows no toast on success', async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useApiMutation(async (n: number) => n * 2, { onSuccess }),
    );

    let returned: number | undefined;
    await act(async () => {
      returned = await result.current.mutate(21);
    });

    expect(returned).toBe(42);
    expect(onSuccess).toHaveBeenCalledWith(42, 21);
    expect(bus.error).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('routes the error to onError when provided, instead of a toast', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useApiMutation<void, void>(
        async () => {
          throw new Error('nope');
        },
        { onError },
      ),
    );

    await act(async () => {
      await result.current.mutate(undefined);
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(bus.error).not.toHaveBeenCalled();
  });
});
