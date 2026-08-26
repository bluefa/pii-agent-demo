// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ConfirmedIntegrationResourceItem } from '@/app/lib/api';
import type { TcResourceFact } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';
import type { TcResultRow } from '@/app/lib/api/task-queue-tc';

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

const renderTable = (
  isIdc = false,
  facts: Map<string, TcResourceFact> = new Map(),
  tcResults: TcResultRow[] = [],
) =>
  render(
    <ConfirmedInfoCard
      targetSourceId={1}
      isIdc={isIdc}
      rows={rows}
      secrets={[]}
      tcResults={tcResults}
      facts={facts}
      tcLoading={false}
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
  // 오너가 못 박은 척추 다섯(정체 둘 → 판정 → 규모 → Credential)은 붙어 있어야 하고,
  // 분류 둘이 그 뒤를 잇는다. Pod 로그는 열이 아니다 — 판정 칸으로 접혔다.
  it('열 순서는 정체 → 판정 → 규모 → Credential → 분류다 (오너 2026-08-25)', () => {
    renderTable();
    expect(headerLabels()).toEqual([
      'Resource Name',
      'Resource ID',
      '연결 상태',
      '연동 논리 DB',
      'Credential',
      'Database Type',
      'Region',
    ]);
  });

  it('IDC 는 이름·ID 대신 접속 주소 한 열이고 리전이 없다 — 온프렘에 없는 사실이다', () => {
    renderTable(true);
    expect(headerLabels()).toEqual([
      '접속 주소',
      '연결 상태',
      '연동 논리 DB',
      'Credential',
      'Database Type',
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
 * 판정 칸은 알약 하나로 말하고, 사유는 오른쪽 tip 표시가 hover 로만 든다
 * (오너 2026-08-25: "결국 실패 이슈라는거잖아?"). 사유가 지면에 한 단 더 서면
 * 표를 훑는 눈이 판정 말고 사유를 먼저 읽는다.
 */
describe('확정 정보 표 — 실패 사유', () => {
  const failing = (reason: string): Map<string, TcResourceFact> =>
    new Map([[rows[0].resource_id, { verdict: 'FAIL', podId: null, failReason: reason }]]);

  it('사유는 지면에 서지 않는다 — 라벨도 원문도 hover 안에 있다', () => {
    renderTable(false, failing('POD_CREATION_FAILED'));
    expect(screen.getByText('실패')).toBeTruthy();
    expect(screen.queryByText('POD_CREATION_FAILED')).toBeNull();
    expect(screen.queryByText('테스트 Pod 생성 실패')).toBeNull();
  });

  it('판정 오른쪽에 hover 로만 열리는 표시가 선다', () => {
    renderTable(false, failing('POD_CREATION_FAILED'));
    const marker = screen.getByLabelText('실패 사유 테스트 Pod 생성 실패');
    expect(marker).toBeTruthy();
    // click 으로 고정되지 않는다 — 눌러도 열리지 않아야 한다.
    fireEvent.click(marker);
    expect(screen.queryByText(/pod 자체가 뜨지 못해/)).toBeNull();
    fireEvent.mouseEnter(marker.closest('[class]') ?? marker);
  });

  it('사유가 없는 판정에는 표시도 없다', () => {
    renderTable(false, new Map([[rows[0].resource_id, { verdict: 'SUCCESS', podId: null, failReason: null }]]));
    expect(screen.queryByLabelText(/실패 사유/)).toBeNull();
  });
});

/**
 * 논리 DB 관리 화면으로 가는 문은 언제나 열려 있다 (오너 2026-08-25).
 *
 * 건수는 최신 실행이 성공했을 때만 오는 사실이라, 예전 칸은 실행이 실패했거나 아직 안 돈
 * 리소스에서 `—` 글자 하나로 끝났다 — 제외 정책을 손볼 길이 그 행에는 없었다는 뜻이다.
 * 정책은 실행이 말해 주는 것이 아니라 운영자가 쓰는 것이고, 모달은 자기 엔드포인트에서
 * 목록을 직접 읽어 오므로 판정과 무관하게 열 수 있다.
 *
 * 조용히 깨지는 갈래가 둘이라 둘 다 문다: 무보고(건수 없음)와 **보고된 0**. 0 건인 리소스
 * 야말로 제외 정책을 봐야 하는 리소스인데, 예전에는 "열 것이 없다"며 글자로 남았다.
 */
describe('확정 정보 표 — 논리 DB 관리 문', () => {
  const ldbCells = (container: HTMLElement): (HTMLTableCellElement | undefined)[] =>
    [...container.querySelectorAll('tbody tr')].map((row) => row.querySelectorAll('td')[3]);

  it('판정이 무엇이든 행마다 관리 링크가 하나씩 선다', () => {
    const { container } = renderTable();
    const cells = ldbCells(container);
    expect(cells.length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: '연동 논리 DB 관리' })).toHaveLength(cells.length);
  });

  it('보고된 0개도 문이 있다 — 0건인 리소스야말로 제외 정책을 본다', () => {
    const zero: TcResultRow[] = [
      { resourceId: rows[0].resource_id, includedCount: 0, excludedCount: 3 },
    ];
    const { container } = renderTable(
      false,
      new Map([[rows[0].resource_id, { verdict: 'SUCCESS', podId: null, failReason: null }]]),
      zero,
    );
    // 이름·수·단위가 각자 span 이라(무게가 수에만 붙는다) textContent 에는 공백이 없다.
    const cell = ldbCells(container)[0];
    const flat = (cell?.textContent ?? '').replace(/\s+/g, '');
    expect(flat).toContain('최근조회0개');
    expect(flat).toContain('제외3개');
    expect(cell?.querySelector('button')?.textContent).toContain('관리');
  });

  /**
   * 값과 행위는 갈라져 있다 (오너 2026-08-25). 건수를 다시 트리거로 만들면 칸에 문이 둘이
   * 되고 — "어느 쪽을 눌러야 하나" — `—` 도 다시 링크로 위장하게 된다.
   */
  it('건수는 눌리지 않는다 — 칸의 유일한 버튼은 관리다', () => {
    const counted: TcResultRow[] = [
      { resourceId: rows[0].resource_id, includedCount: 5, excludedCount: 2 },
    ];
    const { container } = renderTable(
      false,
      new Map([[rows[0].resource_id, { verdict: 'SUCCESS', podId: null, failReason: null }]]),
      counted,
    );
    const cell = ldbCells(container)[0];
    const buttons = [...(cell?.querySelectorAll('button') ?? [])];
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toContain('관리');
    // 이름은 이제 행마다 있으므로 전역 조회로는 못 집는다 — 이 칸 안에서 찾는다.
    const label = [...(cell?.querySelectorAll('span') ?? [])].find(
      (el) => el.textContent === '최근 조회',
    );
    expect(label).toBeTruthy();
    expect(label?.closest('button')).toBeNull();
  });

  it('보고가 없으면 건수 자리는 —로 남는다 — 링크로 위장하지 않는다', () => {
    const { container } = renderTable();
    expect(ldbCells(container)[0]?.textContent).toContain('—');
  });

  /**
   * 이름은 판정과 무관하게 늘 선다 (오너 2026-08-26). 실패·대기·진행 중에 칸이 `—` 하나로
   * 오그라들면 이 칸이 무엇을 셀 자리였는지가 사라져, 제외 정책이 아예 없는 것처럼 읽힌다.
   * 정책은 실행이 만드는 것이 아니라 운영자가 쓴 것이라 실행이 실패해도 남아 있고,
   * 그래서 그 자리를 여는 문도 남아 있어야 한다.
   */
  it.each(['FAIL', 'PENDING', 'RUNNING'] as const)(
    '%s 에서도 두 이름과 관리 문이 모두 선다',
    (verdict) => {
      const { container } = renderTable(
        false,
        new Map([[rows[0].resource_id, { verdict, podId: null, failReason: null }]]),
      );
      const cell = ldbCells(container)[0];
      const flat = (cell?.textContent ?? '').replace(/\s+/g, '');
      expect(flat).toContain('최근조회');
      expect(flat).toContain('제외');
      expect(cell?.querySelector('button')?.textContent).toContain('관리');
    },
  );
});

/**
 * 조회 중인 것과 "보고가 없다"는 다른 사실이다. 이 표에서 —는 후자를 뜻하는 글자라
 * (각주가 그렇게 못 박아 두었었다), 아직 물어보는 중에 그것을 그리면 픽셀이 거짓말한다.
 */
describe('확정 정보 표 — 연결 상태 로딩', () => {
  it('조회 중에는 —가 아니라 자리를 잡아 둔다 (오너 2026-08-25)', () => {
    const { container } = render(
      <ConfirmedInfoCard
        targetSourceId={1}
        isIdc={false}
        rows={rows}
        secrets={[]}
        tcResults={[]}
        facts={new Map()}
        tcLoading
        credMissingOnly={false}
        loading={false}
        failed={false}
        onReload={vi.fn()}
      />,
    );
    const connCells = [...container.querySelectorAll('tbody tr')].map(
      (row) => row.querySelectorAll('td')[2],
    );
    expect(connCells.length).toBeGreaterThan(0);
    for (const cell of connCells) {
      expect(cell?.textContent).not.toContain('—');
      expect(cell?.querySelector('.animate-pulse')).toBeTruthy();
    }
    expect(container.querySelector('table')?.getAttribute('aria-busy')).toBe('true');
  });

  /** 논리 DB 칸도 같은 규칙이다 (오너 2026-08-25) — 그리고 문은 이 조회를 안 기다린다. */
  it('논리 DB 칸도 조회 중에는 자리를 잡아 두고, 관리 링크는 그대로 선다', () => {
    const { container } = render(
      <ConfirmedInfoCard
        targetSourceId={1}
        isIdc={false}
        rows={rows}
        secrets={[]}
        tcResults={[]}
        facts={new Map()}
        tcLoading
        credMissingOnly={false}
        loading={false}
        failed={false}
        onReload={vi.fn()}
      />,
    );
    const cells = [...container.querySelectorAll('tbody tr')].map(
      (row) => row.querySelectorAll('td')[3],
    );
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      expect(cell?.querySelector('.animate-pulse')).toBeTruthy();
      expect(cell?.textContent).not.toContain('—');
      expect(cell?.querySelector('button')?.textContent).toContain('관리');
    }
  });
});

/**
 * 표 안의 글자 크기는 14px 하나다 (오너 2026-08-25). 크기가 섞이면 같은 표가 값마다 다른
 * 중요도를 주장하게 되고, 12px 로 흘러내리기는 조용해서 리뷰로는 안 잡힌다.
 *
 * 예외는 `ResourceKindTag`(RDS Cluster · EC2) 하나뿐이다 — 크기가 그 컴포넌트의 설계이고
 * (이름보다 조용해야 하고 이름의 폭을 먹지 않아야 한다), 1·2·3 단계와 같은 컴포넌트라
 * 여기서 키우면 네 화면이 갈라진다. 오너가 그 갈라짐을 원하면 그때 prop 을 연다.
 */
describe('확정 정보 표 — 활자 크기', () => {
  const SIZE = /^text-\[\d+px\]$|^text-(xs|sm|base|lg|xl|2xl)$/;

  it('선언된 크기는 14px 하나 — 공유 종류 태그만 예외다', () => {
    const { container } = renderTable(
      false,
      new Map([[rows[0].resource_id, { verdict: 'FAIL', podId: 'pod-1', failReason: 'SECRET_NOT_FOUND' }]]),
    );
    const table = container.querySelector('table');
    expect(table).toBeTruthy();
    // `<thead>` 자체는 세지 않는다 — 셸이 거기에 12px 를 상속용으로 얹고, 각 `<th>` 가
    // 자기 크기로 덮는다(열마다 headClassName). 재는 것은 실제로 글자를 그리는 칸들이다.
    const painted = [
      ...(table?.querySelectorAll('thead th, thead th *, tbody *') ?? []),
    ];
    const declared = painted.flatMap((el) =>
      [...el.classList].filter((name) => SIZE.test(name)),
    );
    expect([...new Set(declared)].sort()).toEqual(['text-[14px]', 'text-xs']);

    const xs = painted.filter((el) => el.classList.contains('text-xs'));
    expect(xs.length).toBeGreaterThan(0);
    for (const el of xs) expect(['RDS Cluster', 'EC2']).toContain(el.textContent);
  });
});
