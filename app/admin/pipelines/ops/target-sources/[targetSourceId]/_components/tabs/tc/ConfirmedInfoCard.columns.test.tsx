// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ConfirmedIntegrationResourceItem } from '@/app/lib/api';
import type { TcResourceFact } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';
import type { TcResultRow } from '@/app/lib/api/task-queue-tc';
import { IDC_SOURCE_LABEL } from '@/lib/constants/idc';

/**
 * 정체와 속성은 각자 제 열이다 — 그리고 그 열 수는 **행이 채우는 칸 수**와 같아야 한다.
 *
 * 열을 나누면 조용히 깨지는 것은 헤더가 아니라 접힌 리전의 자식 행이다: 그 행은 앞의 몇
 * 칸만 채우고 나머지를 `colSpan` 하나로 덮는데, 그 수를 손으로 적어 두면 열이 늘 때 같이
 * 늘지 않아 표가 한 칸씩 밀린다(값이 남의 열 아래로 들어간다). jsdom 은 레이아웃을 재지
 * 않으므로 픽셀로는 못 잡고, 칸 수를 세는 이 단언만이 잡는다.
 */
vi.mock('@/app/lib/api', () => ({ updateResourceCredential: vi.fn() }));
// 관리 문이 **열린다**는 단언이 모달을 실제로 띄운다 — 그 모달은 뜨자마자 두 목록을 부른다.
// 여기서 재는 것은 문이지 목록이 아니므로, 두 조회는 비어 있는 답으로 잠재운다.
vi.mock('@/app/lib/api/logical-db', () => ({
  getTestedLogicalDatabases: vi.fn(async () => []),
  getExcludedLogicalDatabases: vi.fn(async () => []),
  updateExcludedLogicalDatabases: vi.fn(async () => undefined),
}));

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

/**
 * 온프렘 행 — 값이 실제로 흐르는지 보려면 IDC 필드가 실린 행이 필요하다. 이전에는 IDC
 * 가지에 클라우드 행을 흘려서 **칸 수만** 증명하고 Port·출발지 배선은 한 번도 실행되지
 * 않았다 ([[feedback_pure_test_misses_the_wiring]]).
 */
const idcRows: ConfirmedIntegrationResourceItem[] = [
  {
    resource_id: 'idc-ivt-9a01',
    resource_name: null,
    resource_type: 'IDC',
    database_type: 'mysql',
    port: 3306,
    idc_host_format: 'IP',
    idc_ips: ['10.20.4.11'],
    idc_source_ips: ['10.20.9.11'],
  } as unknown as ConfirmedIntegrationResourceItem,
];

const { ConfirmedInfoCard } = await import(
  '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/ConfirmedInfoCard'
);

const renderTable = (
  isIdc = false,
  facts: Map<string, TcResourceFact> = new Map(),
  tcResults: TcResultRow[] = [],
  tableRows: ConfirmedIntegrationResourceItem[] = rows,
) =>
  render(
    <ConfirmedInfoCard
      targetSourceId={1}
      isIdc={isIdc}
      rows={tableRows}
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

/**
 * 열 이름 — **본문 칸이 서는 순서**로.
 *
 * 머리가 두 tier 라 DOM 순서는 열 순서가 아니다: 첫 `<tr>` 이 그룹 밖 열들과 그룹 머리 한
 * 칸을 싣고, 잎 셋은 두 번째 `<tr>` 에 따로 있다. 그대로 이어 붙이면 잎이 표 끝으로 밀려
 * "열 순서" 단언이 본문과 어긋난 것을 재게 된다. 그룹 머리 자리에 그 잎들을 도로 끼워
 * 넣어야 `<td>` 가 실제로 서는 순서가 나온다.
 */
const headerLabels = (): string[] => {
  const tiers = [...document.querySelectorAll('thead tr')];
  const top = [...(tiers[0]?.querySelectorAll('th') ?? [])];
  const leaves = [...(tiers[1]?.querySelectorAll('th') ?? [])];
  let next = 0;
  return top.flatMap((th) => {
    if (th.getAttribute('scope') !== 'colgroup') return [(th.textContent ?? '').trim()];
    const span = (th as HTMLTableCellElement).colSpan;
    const mine = leaves.slice(next, next + span);
    next += span;
    return mine.map((leaf) => (leaf.textContent ?? '').trim());
  });
};

/** 위 tier 의 그룹 머리들 — 라벨과 덮는 열 수. */
const headerGroups = (): { label: string; span: number }[] =>
  [...document.querySelectorAll('thead th[scope="colgroup"]')].map((th) => ({
    label: (th.getAttribute('aria-label') ?? '').trim(),
    span: (th as HTMLTableCellElement).colSpan,
  }));

describe('확정 정보 표 — 열 구성', () => {
  // 오너가 못 박은 척추 다섯(정체 둘 → 판정 → 규모 → Credential)은 붙어 있어야 하고,
  // 분류 둘이 그 뒤를 잇는다. Pod 로그는 열이 아니다 — 판정 칸으로 접혔다.
  it('열 순서는 정체 → 판정 → 규모 → Credential → 분류다 (오너 2026-08-25)', () => {
    renderTable();
    expect(headerLabels()).toEqual([
      'Resource Name',
      'Resource ID',
      '연결 상태',
      '대상',
      '제외',
      '관리',
      'Credential',
      'Database Type',
      'Region',
    ]);
  });

  /**
   * 온프렘은 다른 표다. 없는 것(Resource Name·ID·Region)과 온프렘에만 있는 것(Port·
   * BDC측 출발지)이 둘 다 있고, 분류가 판정 **왼쪽**이다 (오너 2026-08-26) — 클라우드 표의
   * 척추 다섯을 가르지 않으려면 그쪽에서는 같은 이동을 할 수 없다.
   */
  it('IDC 는 접속 주소·Port·분류가 판정 앞에 서고, 끝에 출발지가 붙는다', () => {
    renderTable(true);
    expect(headerLabels()).toEqual([
      '접속 주소',
      'Port',
      'Database Type',
      '연결 상태',
      '대상',
      '제외',
      '관리',
      'Credential',
      IDC_SOURCE_LABEL,
    ]);
  });

  /**
   * 헤더만 세는 단언은 IDC 의 손으로 쓴 `<td>` 들을 못 본다 — 그 칸들은 `columns.map` 이
   * 아니라 `{isIdc && …}` 가지로 흩어져 있어서, 열을 하나 붙이고 칸을 안 붙이면 표가 조용히
   * 한 칸씩 밀린다(값이 남의 열 아래로 간다). jsdom 은 레이아웃을 안 재므로 칸 수만이 잡는다.
   */
  it('IDC 행도 열 수를 정확히 채운다', () => {
    const { container } = renderTable(true);
    const columns = headerLabels().length;
    const bodyRows = [...container.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
    expect(bodyRows.length).toBeGreaterThan(0);
    for (const row of bodyRows) expect(spanOf(row)).toBe(columns);
  });

  /**
   * 칸 수만 세면 **순서가 어긋나는 것**은 못 잡는다 — `<td>` 둘을 맞바꿔도 합은 그대로 7 이고,
   * 값만 남의 머리글 아래로 간다(칸 수 단언의 각주가 막겠다고 말한 바로 그 실패다).
   * 값이 아는 자리에 있는지를 같이 못 박는다. 실제 IDC 필드가 실린 행으로 돌려야
   * Port·출발지 배선이 처음으로 실행된다.
   */
  it('IDC 값은 제 열 아래에 선다 — 순서가 바뀌면 잡는다', () => {
    const { container } = renderTable(true, new Map(), [], idcRows);
    expect(headerLabels()).toEqual([
      '접속 주소',
      'Port',
      'Database Type',
      '연결 상태',
      '대상',
      '제외',
      '관리',
      'Credential',
      IDC_SOURCE_LABEL,
    ]);
    const cells = [...(container.querySelector('tbody tr')?.querySelectorAll('td') ?? [])];
    expect(cells[0].textContent).toContain('10.20.4.11');
    expect(cells[1].textContent?.trim()).toBe('3306');
    expect(cells[2].textContent).toContain('MySQL');
    expect(cells[8].textContent).toContain('10.20.9.11');
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
    // click 으로 고정되지 않는다 — `Tooltip` 은 `openOn: 'click'` 판을 갖고 있으므로
    // 이 단언은 공허하지 않다: 그 판으로 바꾸면 여기서 빨개진다.
    fireEvent.click(marker);
    expect(screen.queryByText(/pod 자체가 뜨지 못해/)).toBeNull();
  });

  /**
   * 사유가 지면에 없다는 단언만으로는 tip 을 통째로 지워도 초록이다 — 숨긴 것과 없앤 것을
   * 가르는 것은 "hover 하면 나온다"는 이 단언뿐이다.
   */
  it('hover 하면 라벨·설명·원문이 모두 나온다 — 숨긴 것이지 없앤 것이 아니다', () => {
    renderTable(false, failing('POD_CREATION_FAILED'));
    const marker = screen.getByLabelText('실패 사유 테스트 Pod 생성 실패');
    // `Tooltip` 은 트리거를 감싼 컨테이너가 onMouseEnter 를 듣는다.
    fireEvent.mouseEnter(marker.parentElement as HTMLElement);
    expect(screen.getByText('테스트 Pod 생성 실패')).toBeTruthy();
    expect(screen.getByText('POD_CREATION_FAILED')).toBeTruthy();
    expect(screen.getByText(/pod 자체가 뜨지 못해/)).toBeTruthy();
  });

  it('사유가 없는 판정에는 표시도 없다', () => {
    renderTable(false, new Map([[rows[0].resource_id, { verdict: 'SUCCESS', podId: null, failReason: null }]]));
    expect(screen.queryByLabelText(/실패 사유/)).toBeNull();
  });
});

/**
 * 연동 논리 DB 는 그룹 머리 하나 아래 잎 셋이다 (오너 2026-08-28, 안 A).
 *
 * IDC 5단계가 쓰는 그 문법 그대로다 — 카테고리 이름은 위 tier 가 한 번 말하고, 잎은
 * `대상`·`제외`·`관리` 한 마디씩 든다. 그룹이 풀리면(콜스팬을 잃거나 잎이 카테고리 이름을
 * 되풀이하면) 잎 이름 셋만으로는 무엇을 센 수인지 표가 말하지 못한다.
 */
describe('확정 정보 표 — 연동 논리 DB 그룹', () => {
  it.each([false, true])('그룹 머리가 잎 셋을 덮는다 (isIdc=%s)', (isIdc) => {
    renderTable(isIdc);
    expect(headerGroups()).toEqual([{ label: '연동 논리 DB', span: 3 }]);
    // 잎 셋은 그 그룹 바로 아래에, 이 순서로 붙어 선다.
    const leaves = headerLabels();
    const at = leaves.indexOf('대상');
    expect(at).toBeGreaterThan(-1);
    expect(leaves.slice(at, at + 3)).toEqual(['대상', '제외', '관리']);
  });

  /** 두 수의 관계는 그룹 머리의 툴팁이 든다 — 손으로 베낀 두 번째 툴팁이 아니라
   *  `LogicalDbGroupHeader` 공용 컴포넌트다(IDC·클라우드 표와 같은 문구). */
  it('그룹 머리가 두 수의 관계를 설명한다', () => {
    renderTable();
    const marker = screen.getByLabelText('연동 논리 DB 설명');
    fireEvent.mouseEnter(marker.parentElement as HTMLElement);
    expect(screen.getByText(/두 수를 더해도 전체가 되지 않아요/)).toBeTruthy();
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
 * 문이 **자기 잎**을 갖는 것이 오너가 안 A 를 고른 이유다 — 건수가 곧 문이던 안 B 는
 * 건수가 `—` 인 행에서 문을 통째로 지운다. 조용히 깨지는 갈래가 셋이라 셋 다 문다:
 * 무보고(건수 없음) · **보고된 0** · 조회 중.
 */
describe('확정 정보 표 — 논리 DB 관리 문', () => {
  /** 한 행의 연동 논리 DB 세 칸 — 대상·제외·관리. */
  const ldbCells = (
    container: HTMLElement,
  ): { inc?: HTMLTableCellElement; exc?: HTMLTableCellElement; manage?: HTMLTableCellElement }[] =>
    [...container.querySelectorAll('tbody tr')].map((row) => {
      const tds = row.querySelectorAll('td');
      return { inc: tds[3], exc: tds[4], manage: tds[5] };
    });

  it('판정이 무엇이든 행마다 관리 링크가 하나씩 서고, 이름표가 서로 다르다', () => {
    const { container } = renderTable();
    const cells = ldbCells(container);
    expect(cells.length).toBeGreaterThan(0);
    const doors = screen.getAllByRole('button', { name: /연동 논리 DB 관리하기$/ });
    expect(doors).toHaveLength(cells.length);
    // 같은 이름의 버튼 여럿은 스크린리더에서 구별되지 않는다 — 행 정체가 이름표에 있어야
    // 한다. 이름표를 고정 문자열로 되돌리면 이 집합이 1 로 줄어 빨개진다.
    const names = new Set(doors.map((el) => el.getAttribute('aria-label')));
    expect(names.size).toBe(cells.length);
    // 문은 자기 잎에 산다 — 건수 칸이 아니라 관리 칸이다.
    for (const cell of cells) expect(cell.manage?.querySelector('button')).toBeTruthy();
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
    const cell = ldbCells(container)[0];
    expect(cell.inc?.textContent?.trim()).toBe('0개');
    expect(cell.exc?.textContent?.trim()).toBe('3개');
    expect(cell.manage?.querySelector('button')?.textContent).toContain('관리하기');
  });

  /**
   * 값과 행위는 갈라져 있다 (오너 2026-08-25). 건수를 다시 트리거로 만들면 방 하나에 문이
   * 둘이 되고 — "어느 쪽을 눌러야 하나" — `—` 도 다시 링크로 위장하게 된다.
   */
  it('건수는 눌리지 않는다 — 이 그룹의 유일한 버튼은 관리 잎에 있다', () => {
    const counted: TcResultRow[] = [
      { resourceId: rows[0].resource_id, includedCount: 5, excludedCount: 2 },
    ];
    const { container } = renderTable(
      false,
      new Map([[rows[0].resource_id, { verdict: 'SUCCESS', podId: null, failReason: null }]]),
      counted,
    );
    const cell = ldbCells(container)[0];
    expect(cell.inc?.querySelectorAll('button')).toHaveLength(0);
    expect(cell.exc?.querySelectorAll('button')).toHaveLength(0);
    expect(cell.manage?.querySelectorAll('button')).toHaveLength(1);
  });

  /**
   * ⛔ 이 라운드의 핵심 불변식 (오너 2026-08-25 "문은 언제나 열려 있다"): 건수가 `—` 인
   * 행에도 문이 서고, 눌린다. 안 B(건수가 곧 문)가 기각된 이유가 정확히 이것이다.
   */
  it.each(['FAIL', 'PENDING', 'RUNNING'] as const)(
    '%s — 건수가 —인 행에도 관리 문이 서고 눌린다',
    async (verdict) => {
      const { container } = renderTable(
        false,
        new Map([[rows[0].resource_id, { verdict, podId: null, failReason: null }]]),
      );
      const cell = ldbCells(container)[0];
      expect(cell.inc?.textContent).toContain('—');
      expect(cell.exc?.textContent).toContain('—');
      const door = cell.manage?.querySelector('button');
      expect(door).toBeTruthy();
      expect(door?.textContent).toContain('관리하기');
      expect(door?.hasAttribute('disabled')).toBe(false);
      // 열린다는 것은 모달이 실제로 뜬다는 뜻이다 — 렌더된 문만으로는 죽은 문과 구별되지 않는다.
      fireEvent.click(door as HTMLElement);
      expect(await screen.findByRole('dialog')).toBeTruthy();
    },
  );

  it('보고가 없으면 건수 자리는 —로 남는다 — 링크로 위장하지 않는다', () => {
    const { container } = renderTable();
    expect(ldbCells(container)[0].inc?.textContent).toContain('—');
  });
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

  /** 논리 DB 잎도 같은 규칙이다 (오너 2026-08-25) — 그리고 문은 이 조회를 안 기다린다. */
  it('논리 DB 건수 잎도 조회 중에는 자리를 잡아 두고, 관리 잎은 그대로 선다', () => {
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
    const bodyRows = [...container.querySelectorAll('tbody tr')];
    expect(bodyRows.length).toBeGreaterThan(0);
    for (const row of bodyRows) {
      const tds = row.querySelectorAll('td');
      for (const count of [tds[3], tds[4]]) {
        expect(count?.querySelector('.animate-pulse')).toBeTruthy();
        expect(count?.textContent).not.toContain('—');
      }
      expect(tds[5]?.querySelector('button')?.textContent).toContain('관리하기');
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
const SIZE = /^text-\[\d+px\]$|^text-(xs|sm|base|lg|xl|2xl)$/;

/**
 * 예외 둘째 — 그룹 머리 칸(`consoleGroupHeaderCell`)의 12px.
 *
 * 14px 규칙이 소유하는 것은 **표의 글자**다. 그룹 머리는 값도 열 이름도 아니라 열 여럿을
 * 덮는 한 단 위의 크롬이고, 그 12px 는 잎보다 한 단 위라는 계급을 크기로 말하려고 오너가
 * 2026-08-27 에 못 박은 값이다(무게 하나로는 얇다). IDC·클라우드 표가 이미 같은 짝
 * (14px 잎 아래 12px 그룹 머리)을 싣는다 — 여기서만 14 로 올리면 세 표가 갈라진다.
 *
 * 예외는 **그 칸에서만** 산다: 다른 곳으로 새는 12px 는 아래 단언이 그대로 잡는다.
 */
const GROUP_HEAD_SELECTOR = 'thead th[scope="colgroup"]';

describe('확정 정보 표 — 활자 크기', () => {

  /** 온프렘 가지도 같은 규칙이다 — `SourceIpHeader`·`HostCell` 은 남이 소유한 공유
   *  컴포넌트라, 저쪽이 크기를 선언하면 이 표의 규칙이 조용히 깨진다. */
  it('IDC 가지도 14px 하나다', () => {
    const { container } = renderTable(true, new Map(), [], idcRows);
    const table = container.querySelector('table');
    const painted = [...(table?.querySelectorAll('thead th, thead th *, tbody *') ?? [])].filter(
      (el) => !el.closest(GROUP_HEAD_SELECTOR),
    );
    const declared = painted.flatMap((el) =>
      [...el.classList].filter((name) => SIZE.test(name)),
    );
    expect([...new Set(declared)]).toEqual(['text-[14px]']);
    // 예외가 예외인 채로 남는지 — 그룹 머리는 12px 하나다.
    expect(table?.querySelector(GROUP_HEAD_SELECTOR)?.classList.contains('text-[12px]')).toBe(true);
  });

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
    ].filter((el) => !el.closest(GROUP_HEAD_SELECTOR));
    const declared = painted.flatMap((el) =>
      [...el.classList].filter((name) => SIZE.test(name)),
    );
    expect([...new Set(declared)].sort()).toEqual(['text-[14px]', 'text-xs']);

    const xs = painted.filter((el) => el.classList.contains('text-xs'));
    expect(xs.length).toBeGreaterThan(0);
    for (const el of xs) expect(['RDS Cluster', 'EC2']).toContain(el.textContent);
  });
});
