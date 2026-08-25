// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ConfirmedIntegrationResourceItem } from '@/app/lib/api';
import type { TcResourceFact } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

/**
 * 정체와 속성은 각자 제 열이다 — 그리고 그 열 수는 **행이 채우는 칸 수**와 같아야 한다.
 *
 * 열을 나누면 조용히 깨지는 것은 헤더가 아니라 접힌 리전의 자식 행이다: 그 행은 앞의 몇
 * 칸만 채우고 나머지를 `colSpan` 하나로 덮는데, 그 수를 손으로 적어 두면 열이 늘 때 같이
 * 늘지 않아 표가 한 칸씩 밀린다(값이 남의 열 아래로 들어간다). jsdom 은 레이아웃을 재지
 * 않으므로 픽셀로는 못 잡고, 칸 수를 세는 이 단언만이 잡는다.
 */
vi.mock('@/app/lib/api', () => ({ updateResourceCredential: vi.fn() }));

const ATHENA_REGION = 'athena:1:ap-northeast-1/AwsDataCatalog';

const athenaDb = (db: string): ConfirmedIntegrationResourceItem =>
  ({
    resource_id: `athena:1:ap-northeast-1:AwsDataCatalog/${db}`,
    resource_name: db,
    resource_type: 'ATHENA',
    database_type: 'athena',
    database_region: 'ap-northeast-1',
    athena_region_resource_id: ATHENA_REGION,
  }) as ConfirmedIntegrationResourceItem;

const rows: ConfirmedIntegrationResourceItem[] = [
  {
    resource_id: 'arn:aws:rds:ap-northeast-2:1:cluster:db-1',
    resource_name: 'db-1',
    resource_type: 'RDS_CLUSTER',
    database_type: 'mysql',
    database_region: 'ap-northeast-2',
  } as ConfirmedIntegrationResourceItem,
  athenaDb('sampledb'),
  athenaDb('integration'),
];

const { ConfirmedInfoCard } = await import(
  '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/ConfirmedInfoCard'
);

const renderTable = (isIdc = false, facts: Map<string, TcResourceFact> = new Map()) =>
  render(
    <ConfirmedInfoCard
      targetSourceId={1}
      isIdc={isIdc}
      rows={rows}
      secrets={[]}
      tcResults={[]}
      facts={facts}
      credMissingOnly={false}
      loading={false}
      failed={false}
      onReload={vi.fn()}
    />,
  );

/** A row's rendered width in columns — a `colSpan` cell counts for what it spans. */
const spanOf = (row: HTMLTableRowElement): number =>
  [...row.querySelectorAll('td')].reduce((sum, cell) => sum + (cell.colSpan || 1), 0);

const headerLabels = (): string[] =>
  [...document.querySelectorAll('thead th')].map((th) => (th.textContent ?? '').trim());

describe('확정 정보 표 — 열 구성', () => {
  it('정체와 속성이 각자 제 열이다 (오너 2026-08-25)', () => {
    renderTable();
    expect(headerLabels()).toEqual([
      'Resource Name',
      'Resource ID',
      'Database Type',
      'Region',
      '연결 상태',
      'Pod 로그',
      '연동 논리 DB',
      'Credential',
    ]);
  });

  it('IDC 는 이름·ID 대신 접속 주소 한 열이고 리전이 없다 — 온프렘에 없는 사실이다', () => {
    renderTable(true);
    expect(headerLabels()).toEqual([
      '접속 주소',
      'Database Type',
      '연결 상태',
      'Pod 로그',
      '연동 논리 DB',
      'Credential',
    ]);
  });

  it('펼친 리전의 자식 행도 열 수를 정확히 채운다 — 한 칸 밀리면 값이 남의 열로 간다', () => {
    renderTable();
    const columns = headerLabels().length;
    fireEvent.click(screen.getByRole('button', { name: /데이터베이스 목록 펼치기/ }));
    const bodyRows = [...document.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
    // 확정 3행 = 단위 2개(RDS + 접힌 리전) + 펼친 데이터베이스 2행.
    expect(bodyRows).toHaveLength(4);
    for (const row of bodyRows) expect(spanOf(row)).toBe(columns);
  });

  it('검색·필터 툴바는 없다 — 남은 거르기는 밴드의 경고 줄이 건다', () => {
    renderTable();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByLabelText('Database Type 필터')).toBeNull();
  });
});

/**
 * 사유 칸은 원문 enum 만 지면에 세우고 한국어는 hover 로 미룬다 (오너 2026-08-25).
 * 라벨을 다시 한 단 얹으면 실패한 행마다 3단이 되어 판정보다 사유가 커 보인다.
 */
describe('확정 정보 표 — 실패 사유', () => {
  const failing = (reason: string): Map<string, TcResourceFact> =>
    new Map([[rows[0].resource_id, { verdict: 'FAIL', podId: null, failReason: reason }]]);

  it('지면에는 원문만 — 한국어 설명은 hover 가 든다', () => {
    renderTable(false, failing('POD_CREATION_FAILED'));
    expect(screen.getByText('POD_CREATION_FAILED')).toBeTruthy();
    // 라벨은 tip 안에만 있다. 셀이 다시 들면 여기서 두 번 잡힌다.
    expect(screen.queryByText('테스트 Pod 생성 실패')).toBeNull();
  });

  it('허용목록 밖의 사유는 설명이 없으므로 tip 트리거도 아니다', () => {
    renderTable(false, failing('SOMETHING_ELSE'));
    const raw = screen.getByText('SOMETHING_ELSE');
    expect(raw.className).not.toContain('decoration-dotted');
  });
});
