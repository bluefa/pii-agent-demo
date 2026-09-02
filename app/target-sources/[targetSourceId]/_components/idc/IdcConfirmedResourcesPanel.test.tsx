// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
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

/**
 * 수 칸의 두 부재. `—` 는 이번 회차가 이 행을 말하지 않았다는 **정착한 사실**이고,
 * 스켈레톤은 이번 회차의 수를 아직 모른다는 뜻이다. 연결 상태가 대기·진행 중이라 말하는
 * 행이 같은 줄에서 직전 회차의 `8개` 를 이번 회차의 값인 양 내밀던 것이 여기서 고쳐진다.
 */
describe('IdcConfirmedResourcesPanel — 이번 회차의 건수를 모르는 동안', () => {
  const summaries = [
    { resource_id: 'r1', logical_database_count: 8, excluded_logical_database_count: 3 },
  ];
  // `8개` 는 수와 단위가 두 노드라 getByText 로는 잡히지 않는다 — 자리로 집는다.
  // 스텝 6·7 열: 접속 주소 · Port · Database Type · 대상 · 제외 · BDC측 출발지.
  const countCells = () => {
    const row = screen.getByText('10.0.0.1').closest('tr') as HTMLTableRowElement;
    return [row.cells[3], row.cells[4]];
  };
  const skeletons = () =>
    countCells().reduce((n, td) => n + td.querySelectorAll('.animate-pulse').length, 0);

  beforeEach(() => {
    getSummariesMock.mockReset();
    getSummariesMock.mockResolvedValue(summaries);
  });

  it('holds the count cells at a skeleton while the run is in flight', async () => {
    const { rerender } = render(
      <IdcConfirmedResourcesPanel
        targetSourceId={42}
        state={state}
        scope="latest"
        runVersion={7}
        countsPaused={false}
      />,
    );
    await waitFor(() => expect(countCells()[0].textContent).toBe('8개'));

    // 다음 실행이 뜬다 — 이 회차는 아직 아무 수도 보고하지 않았다.
    rerender(
      <IdcConfirmedResourcesPanel
        targetSourceId={42}
        state={state}
        scope="latest"
        runVersion={7}
        countsPaused
      />,
    );

    expect(skeletons()).toBe(2);
    // 직전 회차의 수도, 정착한 부재(—)도 아니다.
    expect(countCells().map((td) => td.textContent)).toEqual(['', '']);
  });

  /**
   * 정착과 새 응답 사이의 틈 — 회차는 넘어갔는데 조회는 아직 떠 있다. 도장이 회차를 함께
   * 물지 않으면 이 구간에서 직전 회차의 수가 그대로 서고, 그게 정착 순간의 깜빡임이다.
   */
  it('does not flash the previous round while the new counts are still in flight', async () => {
    const { rerender } = render(
      <IdcConfirmedResourcesPanel
        targetSourceId={42}
        state={state}
        scope="latest"
        runVersion={7}
        countsPaused={false}
      />,
    );
    await waitFor(() => expect(countCells()[0].textContent).toBe('8개'));

    let answer: (rows: Record<string, unknown>[]) => void = () => {};
    getSummariesMock.mockImplementation(
      () =>
        new Promise<Record<string, unknown>[]>((resolve) => {
          answer = resolve;
        }),
    );
    await act(async () => {
      rerender(
        <IdcConfirmedResourcesPanel
          targetSourceId={42}
          state={state}
          scope="latest"
          runVersion={8}
          countsPaused={false}
        />,
      );
    });

    expect(skeletons()).toBe(2);
    expect(countCells()[0].textContent).not.toBe('8개');

    // 답이 오면 그때 선다 — 스켈레톤은 늦추는 것이지 비우는 것이 아니다.
    await act(async () => {
      answer([{ resource_id: 'r1', logical_database_count: 5, excluded_logical_database_count: 0 }]);
    });
    await waitFor(() => expect(countCells()[0].textContent).toBe('5개'));
    expect(skeletons()).toBe(0);
  });

  /**
   * 조회가 실패해도 이 회차에 대한 답은 나온 것이다 — 실패라는 답. 실패 갈래가 회차 도장을
   * 찍지 않으면 셋째 항이 영영 참이라 그 칸은 스켈레톤에서 나오지 못하고, 화면은 "아직
   * 읽는 중"이라고 끝없이 말한다. 정착한 부재는 `—` 다.
   */
  it('settles the skeleton to — when the read for the new round fails', async () => {
    const { rerender } = render(
      <IdcConfirmedResourcesPanel
        targetSourceId={42}
        state={state}
        scope="latest"
        runVersion={7}
        countsPaused={false}
      />,
    );
    await waitFor(() => expect(countCells()[0].textContent).toBe('8개'));

    getSummariesMock.mockRejectedValue(new Error('503'));
    await act(async () => {
      rerender(
        <IdcConfirmedResourcesPanel
          targetSourceId={42}
          state={state}
          scope="latest"
          runVersion={8}
          countsPaused={false}
        />,
      );
    });

    await waitFor(() => expect(countCells()[0].textContent).toBe('—'));
    expect(skeletons()).toBe(0);
  });

  /**
   * 실행이 이미 도는 채로 열린 화면. 첫 폴링이 회차 8 을 RUNNING 으로 물고 오면 효과는
   * 회차 축(없음 → 8)에서 한 번 깨어나지만 멈춤 게이트에 막혀 도장을 찍지 못한다. 그 실행이
   * **같은 회차 8 로** 정착하면 회차는 더 바뀌지 않는다 — 다시 읽게 만드는 것은 오직 멈춤
   * 플래그가 참에서 거짓으로 넘어가는 것이다. 그게 의존성 배열에서 빠지면 넷째 항이 영영
   * 참이라 두 수 칸은 스켈레톤에서 나오지 못한다. 그래서 회차를 붙박아 둔 채 멈춤만 푼다.
   */
  it('re-reads the counts when the run settles at the version it was already on', async () => {
    const { rerender } = render(
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
    expect(skeletons()).toBe(2);

    // 회차는 그대로 8 — 바뀐 것은 정착했다는 사실뿐이다.
    await act(async () => {
      rerender(
        <IdcConfirmedResourcesPanel
          targetSourceId={42}
          state={state}
          scope="latest"
          runVersion={8}
          countsPaused={false}
        />,
      );
    });

    expect(getSummariesMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(countCells()[0].textContent).toBe('8개'));
    expect(countCells()[1].textContent).toBe('3개');
    expect(skeletons()).toBe(0);
  });

  /**
   * 회차가 사라지는 쪽. 최신 실행이 없어지면(다른 화면에서 초기화되는 등) 회차는 7 에서
   * 없음으로 넘어간다 — 그것도 회차가 바뀐 것이다. 넷째 항을 `runVersion != null` 로
   * 잠가 두면 하필 그 순간 꺼져서, 죽은 7 회차의 수가 `미실행` 이라는 판정 옆에 이번
   * 회차의 값인 양 선다.
   */
  it('does not flash the dead round when the latest run disappears', async () => {
    const { rerender } = render(
      <IdcConfirmedResourcesPanel
        targetSourceId={42}
        state={state}
        scope="latest"
        runVersion={7}
        countsPaused={false}
      />,
    );
    await waitFor(() => expect(countCells()[0].textContent).toBe('8개'));

    getSummariesMock.mockImplementation(() => new Promise<Record<string, unknown>[]>(() => {}));
    await act(async () => {
      rerender(
        <IdcConfirmedResourcesPanel
          targetSourceId={42}
          state={state}
          scope="latest"
          runVersion={null}
          countsPaused={false}
        />,
      );
    });

    expect(skeletons()).toBe(2);
    expect(countCells().map((td) => td.textContent)).toEqual(['', '']);
  });

  /**
   * 스텝 6·7 은 회차 축을 넘기지 않는다. 마운트 경로에서는 네 항이 다 거짓이다 — 회차는
   * 양쪽이 null 로 같고, 도장도 마운트 순간 자기 대상이다 — 그래서 조회가 아직 떠 있는 첫
   * 프레임에도 그 표는 오늘과 같은 픽셀이고, 읽기는 여전히 마운트 한 번이다. 6·7 이 모든
   * 항에서 면제된다는 뜻은 아니다: 대상 도장 항은 그 화면에도 살아 있어서, 대상을 제자리에서
   * 갈아타면 6·7 도 새 조회가 닿을 때까지 스켈레톤이다.
   */
  it('leaves steps 6·7 without a skeleton on the mount path, still one read on mount', async () => {
    let answer: (rows: Record<string, unknown>[]) => void = () => {};
    getSummariesMock.mockImplementation(
      () =>
        new Promise<Record<string, unknown>[]>((resolve) => {
          answer = resolve;
        }),
    );
    render(<IdcConfirmedResourcesPanel targetSourceId={42} state={state} scope="latestSuccess" />);

    // 조회는 아직 떠 있다 — 그래도 스켈레톤이 아니라 정착한 `—` 다.
    expect(skeletons()).toBe(0);
    expect(countCells().map((td) => td.textContent)).toEqual(['—', '—']);

    await act(async () => {
      answer(summaries);
    });
    await waitFor(() => expect(countCells()[0].textContent).toBe('8개'));
    expect(skeletons()).toBe(0);
    expect(getSummariesMock).toHaveBeenCalledTimes(1);
  });
});

/**
 * 대상을 갈아탄 직후. 맵은 도장(`fetched.targetSourceId`)이 어긋나 비지만, `countsLoading`
 * 은 그 도장을 보지 않는다 — 두 대상이 같은 회차 위에 있으면 셋째 항도 거짓이라 화면은
 * 새 대상의 조회가 닿기 전에 이미 `—` 를 단언한다. 그 `—` 는 "이번 회차가 이 행을 말하지
 * 않았다" 가 아니라 "아직 묻지도 않았다" 다.
 */
describe('IdcConfirmedResourcesPanel — 대상을 갈아탄 직후', () => {
  const summaries = [
    { resource_id: 'r1', logical_database_count: 8, excluded_logical_database_count: 3 },
  ];
  const countCells = () => {
    const row = screen.getByText('10.0.0.1').closest('tr') as HTMLTableRowElement;
    return [row.cells[3], row.cells[4]];
  };
  const skeletons = () =>
    countCells().reduce((n, td) => n + td.querySelectorAll('.animate-pulse').length, 0);

  beforeEach(() => {
    getSummariesMock.mockReset();
    getSummariesMock.mockResolvedValue(summaries);
  });

  it('holds the count cells at a skeleton while the new target is still being read', async () => {
    const { rerender } = render(
      <IdcConfirmedResourcesPanel
        targetSourceId={42}
        state={state}
        scope="latest"
        runVersion={3}
        countsPaused={false}
      />,
    );
    await waitFor(() => expect(countCells()[0].textContent).toBe('8개'));

    // 두 대상이 같은 회차 위에 있다 — 목의 모든 대상이 test_connection_version: 3 이다.
    getSummariesMock.mockImplementation(() => new Promise<Record<string, unknown>[]>(() => {}));
    await act(async () => {
      rerender(
        <IdcConfirmedResourcesPanel
          targetSourceId={99}
          state={state}
          scope="latest"
          runVersion={3}
          countsPaused={false}
        />,
      );
    });

    expect(skeletons()).toBe(2);
    expect(countCells().map((td) => td.textContent)).toEqual(['', '']);
  });
});
