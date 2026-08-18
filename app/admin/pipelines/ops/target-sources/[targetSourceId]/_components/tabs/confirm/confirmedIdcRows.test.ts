import { describe, expect, it } from 'vitest';
import { confirmedToIdcRows } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/confirmedIdcRows';
import type { ConfirmedIntegrationResourceInfo } from '@/lib/types';

/**
 * IDC 확정 리소스가 표에 실릴 때 살아남아야 하는 값은 셋이다 — 출발지 IP·Port·NLB 배정.
 * 셋 다 계약(`ResourceConfigDto`)에 있고, 하나라도 떨어뜨리면 표에서 그 열이 빈다.
 */
const row = (
  patch: Partial<ConfirmedIntegrationResourceInfo> = {},
): ConfirmedIntegrationResourceInfo => ({
  resource_id: 'idc-r-1',
  resource_type: 'IDC_DATABASE',
  database_type: 'MySQL',
  database_region: null,
  resource_name: null,
  port: 3306,
  host: '10.20.1.11',
  oracle_service_id: null,
  network_interface_id: null,
  ip_configuration: null,
  credential_id: null,
  ...patch,
});

describe('confirmedToIdcRows', () => {
  it('출발지 IP·Port·NLB 배정을 그대로 나른다', () => {
    const [mapped] = confirmedToIdcRows([
      row({ idc_source_ips: ['10.20.9.1', '10.20.9.2'], nlb_index: 7 }),
    ]);
    expect(mapped.sourceIps).toEqual(['10.20.9.1', '10.20.9.2']);
    expect(mapped.port).toBe(3306);
    expect(mapped.nlbIndex).toBe(7);
  });

  it('접속 주소는 host format 이 고른다 — IP 면 ips, HOST 면 host', () => {
    const [ipRow] = confirmedToIdcRows([
      row({ idc_host_format: 'IP', idc_ips: ['10.20.1.11', '10.20.1.12'] }),
    ]);
    expect(ipRow.connectTargets).toEqual(['10.20.1.11', '10.20.1.12']);
    expect(ipRow.idcKind).toBe('IP');

    const [hostRow] = confirmedToIdcRows([
      row({ idc_host_format: 'HOST', idc_host: 'db.order.internal', idc_ips: ['10.20.1.11'] }),
    ]);
    expect(hostRow.connectTargets).toEqual(['db.order.internal']);
  });

  it('idc_* 가 없는 행은 host 하나로 떨어진다 — 계약상 전부 optional 이다', () => {
    const [mapped] = confirmedToIdcRows([row()]);
    expect(mapped.connectTargets).toEqual(['10.20.1.11']);
    expect(mapped.idcKind).toBeNull();
    expect(mapped.nlbIndex).toBeNull();
  });

  it('확정된 행은 전부 연동 대상이다 — 제외는 확정 이전에 갈린다', () => {
    const [mapped] = confirmedToIdcRows([row()]);
    expect(mapped.selected).toBe(true);
    expect(mapped.exclusionReason).toBeNull();
  });
});
