// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useApprovalTableState } from '@/app/target-sources/[targetSourceId]/_components/layout/useApprovalTableState';
import type { WaitingApprovalResource } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';

const row = (over: Partial<WaitingApprovalResource> = {}): WaitingApprovalResource => ({
  resourceId: 'r1',
  resourceType: 'RDS',
  region: 'ap-northeast-2',
  resourceName: 'db-01',
  selected: true,
  ...over,
});

describe('useApprovalTableState', () => {
  it('derives Database Type options from the shared label map by default', () => {
    const { result } = renderHook(() => useApprovalTableState([row({ resourceType: 'MSSQL' })]));
    expect(result.current.dbTypeOptions.map((o) => o.value)).toEqual(['SQL Server']);
  });

  // IDC renders 'MSSQL', not 'SQL Server'. Without the accessor the option would name a label the
  // column never shows, and selecting it would filter every row away.
  it('uses the caller label map when one is given, and filters by that same string', () => {
    const rows = [row({ resourceId: 'a', resourceType: 'MSSQL' }), row({ resourceId: 'b', resourceType: 'MySQL' })];
    const { result } = renderHook(() =>
      useApprovalTableState(rows, (resource) => resource.resourceType),
    );
    expect(result.current.dbTypeOptions.map((o) => o.value)).toEqual(['MSSQL', 'MySQL']);

    act(() => result.current.onDbTypeChange('MSSQL'));
    expect(result.current.visibleResources.map((r) => r.resourceId)).toEqual(['a']);
  });
});
