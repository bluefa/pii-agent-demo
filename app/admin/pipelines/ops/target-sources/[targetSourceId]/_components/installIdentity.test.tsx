// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfirmedIntegrationResourceInfo } from '@/lib/types';

const getConfirmedIntegration = vi.fn();
vi.mock('@/app/lib/api', () => ({
  getConfirmedIntegration: (...args: unknown[]) => getConfirmedIntegration(...args),
}));

import { useInstallResourceIdentity } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installIdentity';

const row = (id: string, ips: string[]): ConfirmedIntegrationResourceInfo =>
  ({
    resource_id: id,
    resource_type: 'IDC_RESOURCE',
    database_type: 'MYSQL',
    database_region: null,
    resource_name: null,
    port: 3306,
    host: null,
    oracle_service_id: null,
    network_interface_id: null,
    ip_configuration: null,
    idc_host_format: 'IP',
    idc_ips: ips,
    idc_source_ips: ['10.10.0.21'],
  }) as ConfirmedIntegrationResourceInfo;

describe('useInstallResourceIdentity — the confirmed rows behind the open-resource table', () => {
  beforeEach(() => {
    getConfirmedIntegration.mockReset();
  });

  it('keys the confirmed rows by resource id, in the IDC table row shape', async () => {
    getConfirmedIntegration.mockResolvedValue({ resource_infos: [row('idc-res-002', ['10.20.31.10'])] });
    const { result } = renderHook(() => useInstallResourceIdentity(1583, true));
    await waitFor(() => expect(result.current.size).toBe(1));
    expect(result.current.get('idc-res-002')).toMatchObject({
      connectTargets: ['10.20.31.10'],
      port: 3306,
      sourceIps: ['10.10.0.21'],
      databaseType: 'MYSQL',
    });
    expect(getConfirmedIntegration).toHaveBeenCalledTimes(1);
  });

  it('reads nothing when disabled (AWS, GCP never draw the table)', () => {
    const { result } = renderHook(() => useInstallResourceIdentity(1583, false));
    expect(result.current.size).toBe(0);
    expect(getConfirmedIntegration).not.toHaveBeenCalled();
  });

  it('a failed read (404: not confirmed yet) leaves the map empty and throws nothing', async () => {
    getConfirmedIntegration.mockImplementation(() => Promise.reject(new Error('404')));
    const { result } = renderHook(() => useInstallResourceIdentity(1583, true));
    expect(getConfirmedIntegration).toHaveBeenCalledTimes(1);
    await act(async () => {});
    expect(result.current.size).toBe(0);
  });

  it('a read that answers after the target changed never labels the new target', async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    getConfirmedIntegration
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ resource_infos: [] });
    const { result, rerender } = renderHook(({ id }) => useInstallResourceIdentity(id, true), {
      initialProps: { id: 1583 },
    });
    rerender({ id: 1023 });
    await act(async () => {
      resolveFirst({ resource_infos: [row('idc-res-002', ['10.20.31.10'])] });
    });
    // The stale answer is keyed to 1583; the hook is now asked about 1023.
    expect(result.current.size).toBe(0);
  });

  it('aborts the in-flight read on unmount', () => {
    let signal: AbortSignal | undefined;
    getConfirmedIntegration.mockImplementation((_id: number, opts?: { signal?: AbortSignal }) => {
      signal = opts?.signal;
      return new Promise(() => {});
    });
    const { unmount } = renderHook(() => useInstallResourceIdentity(1583, true));
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
