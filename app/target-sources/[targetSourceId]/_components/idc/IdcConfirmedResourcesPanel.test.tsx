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
    // Steps 6·7 read the last SUCCESSFUL run — the counts on a settled screen must not
    // follow a later failure. Passed here for the same reason the prop is required:
    // the panel renders on three steps and must never guess which one it is on.
    render(<IdcConfirmedResourcesPanel targetSourceId={42} state={state} scope="latestSuccess" />);

    await waitFor(() => expect(getSummariesMock).toHaveBeenCalled());
    expect(screen.queryByText('관리하기')).toBeNull();
    expect(screen.queryByRole('columnheader', { name: '관리' })).toBeNull();
    expect(logicalGroupHeader().getAttribute('colspan')).toBe('2');
  });

  it('gives step 5 the 관리 column and a 3-leaf 연동 논리 DB group', async () => {
    // Step 5 reads the LATEST run, failure included — that is the run the operator is
    // acting on. `onLogicalOpen` is what raises the 관리 door; the scope is orthogonal.
    render(
      <IdcConfirmedResourcesPanel
        targetSourceId={42}
        state={state}
        scope="latest"
        onLogicalOpen={() => {}}
      />,
    );

    await waitFor(() => expect(getSummariesMock).toHaveBeenCalled());
    expect(screen.getByText('관리하기')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: '관리' })).toBeTruthy();
    expect(logicalGroupHeader().getAttribute('colspan')).toBe('3');
  });
});

/**
 * 건수는 회차에 매인다. Step 5 는 실행이 살아 있는 화면이라 같은 대상·같은 scope 위에서
 * 회차만 바뀐다 — 그때 다시 읽지 않으면 재실행으로 실패 → 성공이 된 행이 화면을 떠났다
 * 돌아올 때까지 `—` 로 남는다. 스텝 6·7 의 회차는 다시 바뀌지 않으므로 그 화면은 마운트
 * 한 번이 정답이고, 여기서 그 모양이 그대로인지도 함께 지킨다.
 */
describe('IdcConfirmedResourcesPanel — when the logical-DB counts are re-read', () => {
  beforeEach(() => {
    getSummariesMock.mockReset();
    getSummariesMock.mockResolvedValue([]);
  });

  it('re-reads the counts when the settled run version changes', async () => {
    const { rerender } = render(
      <IdcConfirmedResourcesPanel
        targetSourceId={42}
        state={state}
        scope="latest"
        runVersion={7}
        countsPaused={false}
      />,
    );
    await waitFor(() => expect(getSummariesMock).toHaveBeenCalledTimes(1));

    rerender(
      <IdcConfirmedResourcesPanel
        targetSourceId={42}
        state={state}
        scope="latest"
        runVersion={8}
        countsPaused={false}
      />,
    );
    await waitFor(() => expect(getSummariesMock).toHaveBeenCalledTimes(2));
  });

  it('does not read the counts while the run is in flight', async () => {
    render(
      <IdcConfirmedResourcesPanel
        targetSourceId={42}
        state={state}
        scope="latest"
        runVersion={8}
        countsPaused
      />,
    );

    await waitFor(() => expect(logicalGroupHeader()).toBeTruthy());
    expect(getSummariesMock).not.toHaveBeenCalled();
  });

  it('leaves the steps 6·7 shape at one read on mount', async () => {
    const { rerender } = render(
      <IdcConfirmedResourcesPanel targetSourceId={42} state={state} scope="latestSuccess" />,
    );
    await waitFor(() => expect(getSummariesMock).toHaveBeenCalledTimes(1));

    // 무관한 리렌더 — 스텝 6·7 은 새 prop 을 넘기지 않으므로 읽기도 늘지 않는다.
    rerender(
      <IdcConfirmedResourcesPanel targetSourceId={42} state={state} scope="latestSuccess" />,
    );
    await waitFor(() => expect(logicalGroupHeader()).toBeTruthy());
    expect(getSummariesMock).toHaveBeenCalledTimes(1);
  });
});
