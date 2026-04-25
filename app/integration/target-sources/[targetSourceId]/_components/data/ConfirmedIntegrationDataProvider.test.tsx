// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  ConfirmedIntegrationDataProvider,
  useConfirmedIntegration,
} from '@/app/integration/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';
import { AppError } from '@/lib/errors';
import type { BffConfirmedIntegration } from '@/lib/types';

vi.mock('@/app/lib/api', () => ({
  getConfirmedIntegration: vi.fn(),
}));

import { getConfirmedIntegration } from '@/app/lib/api';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const fixtureResponse: BffConfirmedIntegration = {
  resource_infos: [
    {
      resource_id: 'res-1',
      resource_type: 'AZURE_VM',
      database_type: null,
      port: null,
      host: null,
      oracle_service_id: null,
      network_interface_id: null,
      ip_configuration_name: null,
      credential_id: null,
    },
    {
      resource_id: 'res-2',
      resource_type: 'AZURE_VM',
      database_type: null,
      port: null,
      host: null,
      oracle_service_id: null,
      network_interface_id: null,
      ip_configuration_name: null,
      credential_id: null,
    },
  ],
};

const Probe = () => {
  const { state, retry } = useConfirmedIntegration();
  return (
    <button data-testid="retry" onClick={retry}>
      {state.status}|{state.status === 'ready' ? state.data.length : ''}|{state.status === 'error' ? state.message : ''}
    </button>
  );
};

const fetchMock = vi.mocked(getConfirmedIntegration);

beforeEach(() => {
  fetchMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('ConfirmedIntegrationDataProvider', () => {
  it('fetches on mount with an abort signal and exposes ready state', async () => {
    const deferred = createDeferred<BffConfirmedIntegration>();
    fetchMock.mockReturnValueOnce(deferred.promise);

    render(
      <ConfirmedIntegrationDataProvider targetSourceId={1003}>
        <Probe />
      </ConfirmedIntegrationDataProvider>,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledId, calledOptions] = fetchMock.mock.calls[0];
    expect(calledId).toBe(1003);
    expect(calledOptions?.signal).toBeInstanceOf(AbortSignal);
    expect(screen.getByTestId('retry').textContent).toBe('loading||');

    await act(async () => {
      deferred.resolve(fixtureResponse);
      await deferred.promise;
    });

    await waitFor(() => {
      expect(screen.getByTestId('retry').textContent).toBe('ready|2|');
    });
  });

  it('aborts the in-flight request on unmount', async () => {
    const deferred = createDeferred<BffConfirmedIntegration>();
    fetchMock.mockReturnValueOnce(deferred.promise);

    const { unmount } = render(
      <ConfirmedIntegrationDataProvider targetSourceId={1003}>
        <Probe />
      </ConfirmedIntegrationDataProvider>,
    );

    const signal = fetchMock.mock.calls[0][1]?.signal;
    expect(signal).toBeInstanceOf(AbortSignal);

    unmount();

    expect(signal?.aborted).toBe(true);

    await act(async () => {
      deferred.resolve(fixtureResponse);
      await deferred.promise;
    });
  });

  it('aborts and refetches when targetSourceId changes', async () => {
    const first = createDeferred<BffConfirmedIntegration>();
    const second = createDeferred<BffConfirmedIntegration>();
    fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { rerender } = render(
      <ConfirmedIntegrationDataProvider targetSourceId={1003}>
        <Probe />
      </ConfirmedIntegrationDataProvider>,
    );

    const firstSignal = fetchMock.mock.calls[0][1]?.signal;

    rerender(
      <ConfirmedIntegrationDataProvider targetSourceId={1004}>
        <Probe />
      </ConfirmedIntegrationDataProvider>,
    );

    expect(firstSignal?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(1004);
    expect(screen.getByTestId('retry').textContent).toBe('loading||');

    await act(async () => {
      second.resolve(fixtureResponse);
      await second.promise;
    });

    await waitFor(() => {
      expect(screen.getByTestId('retry').textContent).toBe('ready|2|');
    });
  });

  it('aborts and refetches when retry() is invoked', async () => {
    const first = createDeferred<BffConfirmedIntegration>();
    const second = createDeferred<BffConfirmedIntegration>();
    fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    render(
      <ConfirmedIntegrationDataProvider targetSourceId={1003}>
        <Probe />
      </ConfirmedIntegrationDataProvider>,
    );

    const firstSignal = fetchMock.mock.calls[0][1]?.signal;

    fireEvent.click(screen.getByTestId('retry'));

    expect(firstSignal?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(1003);

    await act(async () => {
      second.resolve(fixtureResponse);
      await second.promise;
    });

    await waitFor(() => {
      expect(screen.getByTestId('retry').textContent).toBe('ready|2|');
    });
  });

  it('normalizes missing-confirmed-integration error to ready with empty data', async () => {
    const deferred = createDeferred<BffConfirmedIntegration>();
    fetchMock.mockReturnValueOnce(deferred.promise);

    render(
      <ConfirmedIntegrationDataProvider targetSourceId={1003}>
        <Probe />
      </ConfirmedIntegrationDataProvider>,
    );

    await act(async () => {
      deferred.reject(
        new AppError({
          status: 404,
          code: 'CONFIRMED_INTEGRATION_NOT_FOUND',
          message: 'missing',
          retriable: false,
        }),
      );
      await deferred.promise.catch(() => undefined);
    });

    await waitFor(() => {
      expect(screen.getByTestId('retry').textContent).toBe('ready|0|');
    });
  });
});
