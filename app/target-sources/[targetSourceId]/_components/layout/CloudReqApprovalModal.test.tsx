// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConfirmedResource } from '@/lib/types/resources';
import type { TestConnectionLatestResultSummary } from '@/app/lib/api';

const getSummariesMock = vi.fn();
vi.mock('@/app/lib/api', () => ({
  getLatestTestConnectionResultSummaries: (...args: unknown[]) => getSummariesMock(...args),
}));

import { CloudReqApprovalModal } from '@/app/target-sources/[targetSourceId]/_components/layout/CloudReqApprovalModal';

const base: ConfirmedResource = {
  resourceId: 'res-1',
  type: 'RDS',
  databaseType: 'mysql',
  region: 'ap-northeast-2',
  resourceName: 'space-prod',
  host: 'localhost',
  port: 3306,
  oracleServiceId: null,
  networkInterfaceId: null,
  ipConfigurationName: null,
  credentialId: 'Key1',
  connectionStatus: 'CONNECTED',
};

/** One Athena database row — three of these share a region, and so share one verdict. */
const athena = (id: string, region: string): ConfirmedResource => ({
  ...base,
  resourceId: `athena:1/${region}/${id}`,
  type: 'ATHENA',
  databaseType: 'athena',
  region,
  resourceName: id,
  athenaRegionResourceId: `athena:1:${region}/AwsDataCatalog`,
});

const summary = (
  resource_id: string,
  logical: number,
  excluded: number,
): TestConnectionLatestResultSummary =>
  ({
    resource_id,
    logical_database_count: logical,
    excluded_logical_database_count: excluded,
  }) as TestConnectionLatestResultSummary;

const renderModal = (props: Partial<React.ComponentProps<typeof CloudReqApprovalModal>> = {}) =>
  render(
    <CloudReqApprovalModal
      isOpen
      onClose={() => {}}
      resources={[base]}
      targetSourceId={42}
      phase="form"
      pending={false}
      onSubmit={() => {}}
      onRetry={() => {}}
      {...props}
    />,
  );

const rowCount = () => document.querySelectorAll('tbody tr').length;

/**
 * 한 통계 타일이 통째로 말하는 문장 — 라벨 + 값 + 단위.
 *
 * 값만 조회하면 표에 있는 같은 수와 구별되지 않고(둘 다 참이라 둘 다 맞는다), 단위가
 * 붙었는지도 못 본다. 단위의 유무가 이 화면에서 판정의 일부다: 못 읽은 수에는 단위가
 * 붙지 않는다.
 *
 * 라벨로도 좁히지 못한다 — 타일 라벨과 표의 머리글은 **같은 말이어야 한다**(타일이 그
 * 열의 합이므로). 그래서 타일 묶음 안에서만 찾는다.
 */
const tile = (label: string) => {
  const grid = document.querySelector('.grid.grid-cols-3');
  const el = [...(grid?.children ?? [])].find((c) => c.textContent?.startsWith(label));
  return el?.textContent;
};

describe('CloudReqApprovalModal', () => {
  beforeEach(() => {
    getSummariesMock.mockReset();
    getSummariesMock.mockResolvedValue([]);
  });

  // 카드와 같은 행 집합을 그린다. 각자 접었을 때 실제로 한 화면에서 카드가 6건,
  // 모달이 8건이라고 말했다 — Athena 를 카드는 리전 단위로, 모달은 DB 단위로 셌다.
  it('folds an Athena region into one row, as the step-5 card does', async () => {
    renderModal({
      resources: [
        base,
        athena('sampledb', 'ap-northeast-1'),
        athena('integration', 'ap-northeast-1'),
        athena('6lb_fulldump', 'ap-northeast-1'),
      ],
    });
    await waitFor(() => expect(getSummariesMock).toHaveBeenCalled());

    expect(rowCount()).toBe(2);
    // 접힌 행이 몇 개를 덮는지 말해 준다 — 카드와 달리 여기서는 펼쳐 볼 수 없으므로,
    // 말하지 않으면 데이터베이스 세 개가 조용히 사라진다.
    expect(screen.getByText('데이터베이스 3개')).toBeTruthy();
    // 타일도 접힌 수를 센다 — 표는 2줄인데 타일이 4건이라고 하면 같은 모달이 두 말을 한다.
    expect(tile('연동 대상')).toBe('연동 대상2건');
  });

  // 응답을 기다리는 동안 합계 타일이 "0개"라고 단정하던 자리. 못 읽은 값은 0 이 아니다.
  it('shows — for the logical-DB totals until the summaries land, never 0', async () => {
    let resolve: (value: TestConnectionLatestResultSummary[]) => void = () => {};
    getSummariesMock.mockReturnValue(
      new Promise<TestConnectionLatestResultSummary[]>((r) => {
        resolve = r;
      }),
    );
    renderModal();

    // 단위도 붙지 않는다 — "— 개" 는 세지 않은 것의 단위를 주장한다.
    expect(tile('연동 논리 DB')).toBe('연동 논리 DB—');
    expect(tile('제외한 논리 DB')).toBe('제외한 논리 DB—');
    // 리소스 수는 지금 손에 있다 — 이것까지 감추면 모르는 것과 아는 것이 같아 보인다.
    expect(tile('연동 대상')).toBe('연동 대상1건');

    resolve([summary('res-1', 15, 3)]);
    await waitFor(() => expect(tile('연동 논리 DB')).toBe('연동 논리 DB15개'));
    expect(tile('제외한 논리 DB')).toBe('제외한 논리 DB3개');
  });

  // 보고되지 않은 행은 0 이 아니라 —. 응답은 왔지만 이 행을 언급하지 않은 경우다.
  it('renders — for a row the run did not report on', async () => {
    getSummariesMock.mockResolvedValue([summary('other', 9, 1)]);
    renderModal();
    await waitFor(() => expect(getSummariesMock).toHaveBeenCalled());

    const cells = [...document.querySelectorAll('tbody td')].map((c) => c.textContent);
    expect(cells.at(-1)).toBe('—');
    expect(cells.at(-2)).toBe('—');
  });

  // 페이지 바가 스스로를 반박하던 자리 — 표는 5줄인데 "표시 10 건씩" 이라고 말했다.
  // 실제 페이지 크기가 옵션에 없으면 select 는 그 값을 고를 수 없어 값이 비어 버린다.
  it('lists the page size it is actually paging by', async () => {
    renderModal();
    await waitFor(() => expect(getSummariesMock).toHaveBeenCalled());

    const select = screen.getByLabelText('페이지당 표시 건수') as HTMLSelectElement;
    expect(select.value).toBe('5');
  });

  // 요청이 끝나면 확인 프레임이 같은 상자를 차지한다 — 1단계 승인 요청과 같은 전환.
  it('replaces the body with the result frame once the request settles', async () => {
    renderModal({ phase: 'success' });

    expect(screen.getByText('승인 요청을 보냈어요')).toBeTruthy();
    expect(screen.getByText('잠시 후 관리자 승인 대기 단계로 이동해요.')).toBeTruthy();
    // 확인 프레임에는 빠져나갈 길이 없다 — 전환은 이미 커밋됐다.
    expect(screen.queryByRole('button', { name: '요청하기' })).toBeNull();
    expect(rowCount()).toBe(0);
  });

  it('offers 다시 요청하기 on a retriable failure, and its reason line', () => {
    renderModal({ phase: 'error', errorCode: 'CONFLICT' });

    expect(screen.getByText('승인 요청을 보내지 못했어요')).toBeTruthy();
    expect(screen.getByText('이미 진행 중인 승인 요청이 있어요.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /다시 요청하기/ })).toBeTruthy();
  });

  // 같은 손으로 다시 눌러도 같은 실패인 것에는 버튼을 주지 않는다.
  it('withholds 다시 요청하기 on a failure retrying cannot fix', () => {
    renderModal({ phase: 'error', errorCode: 'FORBIDDEN' });

    expect(screen.getByText('이 연동 대상에 승인을 요청할 권한이 없어요.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /다시 요청하기/ })).toBeNull();
  });
});
