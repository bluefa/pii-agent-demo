// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useIdcApprovalTable } from '@/app/target-sources/[targetSourceId]/_components/idc/approval-table';
import type { IdcResourceView } from '@/app/lib/api/idc';

const view = (over: Partial<IdcResourceView> = {}): IdcResourceView => ({
  resourceId: 'r1',
  persisted: true,
  kind: 'SINGLE',
  hosts: ['10.0.0.1'],
  port: 3306,
  databaseTypeLabel: 'MySQL',
  databaseTypeWire: undefined,
  oracleSid: undefined,
  credentialId: undefined,
  sourceIps: [],
  firewallOpen: false,
  connection: 'PENDING',
  health: null,
  done: null,
  excluded: false,
  exclusionReason: undefined,
  ...over,
});

describe('useIdcApprovalTable', () => {
  it('offers the IDC display labels as the Database Type options', () => {
    const rows = [view({ databaseTypeLabel: 'MSSQL' }), view({ resourceId: 'r2' })];
    const { result } = renderHook(() => useIdcApprovalTable(rows));
    // MSSQL, not the cloud map's 'SQL Server' — the option has to read as the column does.
    expect(result.current.table.dbTypeOptions.map((o) => o.value)).toEqual(['MSSQL', 'MySQL']);
  });

  // IDC rows carry no region, so the group would otherwise open onto a lone 전체.
  it('produces no Region options', () => {
    const { result } = renderHook(() => useIdcApprovalTable([view()]));
    expect(result.current.table.regionOptions).toEqual([]);
  });

  it('searches by host and returns the original rows, not the projection', () => {
    const rows = [
      view({ resourceId: 'a', hosts: ['db-alpha.internal'] }),
      view({ resourceId: 'b', hosts: ['db-beta.internal'] }),
    ];
    const { result } = renderHook(() => useIdcApprovalTable(rows));

    act(() => result.current.table.onSearchChange('alpha'));
    expect(result.current.visibleResources).toEqual([rows[0]]);
  });

  it('counts excluded rows as the 제외 filter bucket', () => {
    const rows = [view({ resourceId: 'a' }), view({ resourceId: 'b', excluded: true })];
    const { result } = renderHook(() => useIdcApprovalTable(rows));
    expect(result.current.table.countsByFilter).toEqual({ all: 2, target: 1, excluded: 1 });

    act(() => result.current.table.onFilterChange('excluded'));
    expect(result.current.visibleResources.map((r) => r.resourceId)).toEqual(['b']);
  });
});
