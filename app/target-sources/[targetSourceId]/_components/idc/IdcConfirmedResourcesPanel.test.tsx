// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IdcResourceView } from '@/app/lib/api/idc';
import type { ResourcesState } from '@/app/hooks/useIdcResources';

const getSummariesMock = vi.fn();
vi.mock('@/app/lib/api', () => ({
  getLatestTestConnectionResultSummaries: (...args: unknown[]) => getSummariesMock(...args),
}));

import { IdcConfirmedResourcesPanel } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcConfirmedResourcesPanel';

const resource: IdcResourceView = {
  resourceId: 'r1',
  persisted: true,
  kind: 'SINGLE',
  hosts: ['10.0.0.1'],
  port: 3306,
  databaseTypeLabel: 'MySQL',
  databaseTypeWire: 'MYSQL',
  sourceIps: ['172.16.0.11'],
  firewallOpen: true,
  connection: 'SUCCESS',
  health: 'HEALTHY',
  done: '연동 완료',
  excluded: false,
  credentialId: 'key-1',
};

const state: ResourcesState = { status: 'ready', resources: [resource] };

const logicalGroupHeader = () =>
  screen.getByText('연동 논리 DB').closest('th') as HTMLTableCellElement;

/**
 * 관리 열의 소유권은 이 패널에 있다. 표(IdcResourceTable)는 `onLogicalOpen` 하나로 열과
 * 그룹 colSpan 을 함께 정하지만, 그 핸들러가 스텝에서 오는지 패널이 지어낸 것인지는 여기서만
 * 갈린다 — 패널이 대체 핸들러를 만들어 주던 동안 6·7단계는 아무것도 쓰지 않는 `관리하기`
 * 문을 그렸다. 그래서 트립와이어가 표가 아니라 패널에 붙는다.
 */
describe('IdcConfirmedResourcesPanel — who gets the 관리 door', () => {
  beforeEach(() => {
    getSummariesMock.mockReset();
    // No summaries → logical-DB cells render "—"; the column shape is what is under test.
    getSummariesMock.mockResolvedValue([]);
  });

  it('gives steps 6·7 no 관리 column and a 2-leaf 연동 논리 DB group', async () => {
    render(<IdcConfirmedResourcesPanel targetSourceId={42} state={state} />);

    await waitFor(() => expect(getSummariesMock).toHaveBeenCalled());
    expect(screen.queryByText('관리하기')).toBeNull();
    expect(screen.queryByRole('columnheader', { name: '관리' })).toBeNull();
    expect(logicalGroupHeader().getAttribute('colspan')).toBe('2');
  });

  it('gives step 5 the 관리 column and a 3-leaf 연동 논리 DB group', async () => {
    render(
      <IdcConfirmedResourcesPanel targetSourceId={42} state={state} onLogicalOpen={() => {}} />,
    );

    await waitFor(() => expect(getSummariesMock).toHaveBeenCalled());
    expect(screen.getByText('관리하기')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: '관리' })).toBeTruthy();
    expect(logicalGroupHeader().getAttribute('colspan')).toBe('3');
  });
});
