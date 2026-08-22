// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  WaitingApprovalTable,
  type WaitingApprovalResource,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import { rdsInstanceBandLabel } from '@/app/target-sources/[targetSourceId]/_components/shared/RdsInstancePanel';
import { useColumnResize } from '@/app/components/ui/useColumnResize';
import { required } from '@/lib/test-dom';
import { textColors, verdictRail } from '@/lib/theme';

const fixture: WaitingApprovalResource[] = [
  {
    resourceId: 'mysql-prod-01',
    resourceType: 'MySQL',
    region: 'ap-northeast-1',
    resourceName: 'sea-live-space-prod',
    selected: true,
  },
  {
    resourceId: 'mysql-stg-02',
    resourceType: 'MySQL',
    region: 'ap-northeast-1',
    resourceName: 'sea-live-space-stg',
    selected: true,
  },
  {
    resourceId: 'pg-analytics-03',
    resourceType: 'PostgreSQL',
    region: 'ap-northeast-1',
    resourceName: 'sea-live-space-prd',
    selected: false,
  },
];

describe('WaitingApprovalTable', () => {
  it('renders the 6 column headers in order', () => {
    render(<WaitingApprovalTable resources={fixture} />);
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toEqual([
      'Resource Name',
      'Resource ID',
      'Database Type',
      'Region',
      '요청 대상 여부',
      '제외 사유',
    ]);
  });

  // 확정 정보 워크벤치가 쓰는 variant. 판정 열 쌍은 행에 대한 질문인데 그 화면은 행마다
  // 관리하는 값이 없다 — 열이 남아 있으면 그 화면이 답할 수 없는 것을 묻게 된다.
  it('plain variant drops the trailing pair, keeping identity and attributes', () => {
    render(<WaitingApprovalTable resources={fixture} variant="plain" />);
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toEqual(['Resource Name', 'Resource ID', 'Database Type', 'Region']);
    // Every body row has to match the header count, or the columns shear.
    for (const row of screen.getAllByRole('row').slice(1)) {
      expect(within(row).getAllByRole('cell')).toHaveLength(4);
    }
    expect(screen.queryByText('대상')).toBeNull();
    expect(screen.queryByText('연동 논리 DB')).toBeNull();
  });

  it('maps selected boolean to 대상/제외', () => {
    render(<WaitingApprovalTable resources={fixture} />);
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('대상')).toBeTruthy();
    expect(within(rows[1]).getByText('대상')).toBeTruthy();
    expect(within(rows[2]).getByText('제외')).toBeTruthy();
  });

  it('leaves 제외 사유 blank when the row has no exclusion reason', () => {
    render(<WaitingApprovalTable resources={fixture} />);
    const rows = screen.getAllByRole('row').slice(1);
    // row[2] is the excluded fixture row with no exclusionReason → empty cell, no '—'.
    expect(within(rows[2]).queryAllByText('—')).toHaveLength(0);
  });

  it('shows empty state when no resources', () => {
    render(<WaitingApprovalTable resources={[]} />);
    expect(screen.getByText('표시할 리소스가 없습니다.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('renders mono-font for ID/Region/Resource Name cells', () => {
    render(<WaitingApprovalTable resources={fixture} />);
    const rows = screen.getAllByRole('row').slice(1);
    const cells = within(rows[0]).getAllByRole('cell');
    // Column order: Name(0) · ID(1) · DB Type(2) · Region(3).
    // Resource ID mono lives inside the ellipsis ResourceIdCell span; Name/Region cells carry it.
    expect(cells[0].className).toContain('font-mono');
    expect(within(cells[1]).getByText('mysql-prod-01').className).toContain('font-mono');
    expect(cells[3].className).toContain('font-mono');
  });

  it('marks an excluded row with the left rail and leaves its text at full contrast', () => {
    render(<WaitingApprovalTable resources={fixture} />);
    const rows = screen.getAllByRole('row').slice(1);
    const selectedCells = within(rows[0]).getAllByRole('cell');
    const excludedCells = within(rows[2]).getAllByRole('cell');
    // 표시는 첫 셀의 레일이 혼자 한다 — 대상 행은 색이 없다.
    expect(selectedCells[0].className).not.toContain(verdictRail.excluded);
    expect(excludedCells[0].className).toContain(verdictRail.excluded);
    // 제외 행이라고 글자를 흐리게 하지 않는다: 승인 화면에서 가장 읽어야 하는 행이다.
    expect(excludedCells[0].className).not.toContain(textColors.tertiary);
    expect(excludedCells[2].className).not.toContain(textColors.tertiary);
    expect(excludedCells[3].className).not.toContain(textColors.tertiary);
  });

  it('mounts a single hover-revealed CopyButton on the Resource ID cell only (v15)', () => {
    const resources: WaitingApprovalResource[] = [
      {
        resourceId: 'res-1',
        resourceType: 'PostgreSQL',
        region: 'us-east-1',
        resourceName: 'orders-db',
        selected: true,
      },
    ];
    render(<WaitingApprovalTable resources={resources} />);
    const buttons = screen.getAllByRole('button', { name: /복사$/ });
    expect(buttons).toHaveLength(1);
    const copy = screen.getByRole('button', { name: 'Resource ID 복사' });
    expect(copy.className).toContain('opacity-0');
    expect(copy.className).toContain('group-hover/resid:opacity-100');
  });

  // LIN-85 — Athena rows regroup under one parent row per region.
  describe('Athena grouping', () => {
    const athena = (
      id: string,
      region: string,
      selected: boolean,
      counts?: [number, number],
    ): WaitingApprovalResource => ({
      resourceId: id,
      // The spelling the captured BFF response actually uses.
      resourceType: 'AWS_ATHENA_DATABASE',
      region,
      resourceName: id,
      selected,
      ...(counts ? { logicalDbCount: counts[0], excludedLogicalDbCount: counts[1] } : {}),
    });

    /** The aggregate rides the identity cell, beside the region it counts within. */
    const aggregateOf = (region: string) => {
      const toggle = screen.getByRole('button', { name: new RegExp(`Athena ${region} 그룹`) });
      const row = required(toggle.closest('tr'), 'the group row holding the toggle');
      return within(row).getAllByRole('cell')[0].textContent;
    };

    it('renders one parent row per region with the target/excluded aggregate', () => {
      render(
        <WaitingApprovalTable
          resources={[
            athena('db_a', 'ap-northeast-1', true),
            athena('db_b', 'ap-northeast-1', false),
            athena('db_c', 'us-east-1', true),
          ]}
        />,
      );

      const toggles = screen.getAllByRole('button', { name: /그룹 (펼치기|접기)$/ });
      expect(toggles).toHaveLength(2);
      expect(toggles[0].getAttribute('aria-expanded')).toBe('true');
      // The counts are split across spans (the numbers sit a size up), so `getByText` — which
      // matches an element's OWN text nodes — cannot see the phrase. Read the cell instead.
      expect(aggregateOf('ap-northeast-1')).toContain('데이터베이스 · 대상 1 · 제외 1');
      expect(aggregateOf('us-east-1')).toContain('데이터베이스 · 대상 1 · 제외 0');
    });

    // The parent's type and region live in its identity cell, not in the two columns keyed on
    // them — filling those printed each of them twice on the one row that has them. The children
    // still say Database in the type column, so reading down the tree gives Athena → Database and
    // a child name like `db_a` is identified rather than left as a bare string. The child's id is
    // dropped: it is the parent's path plus that name — but the region is NOT, because a column
    // is read down and a blank there says "no region" (owner, 2026-08-12).
    it('keeps the parent type and region in its identity cell, Database + region on each child', () => {
      render(
        <WaitingApprovalTable
          resources={[athena('db_a', 'ap-northeast-1', true), athena('db_b', 'ap-northeast-1', false)]}
        />,
      );

      const rows = screen.getAllByRole('row');
      // Column order: Name(0) · ID(1) · DB Type(2) · Region(3) · 요청 대상 여부(4) · 제외 사유(5).
      // The parent is one spanning cell now — it had a value for none of the columns once its
      // identity carried the type, the region and the counts.
      const parent = within(rows[1]).getAllByRole('cell');
      expect(parent).toHaveLength(1);
      expect(parent[0].getAttribute('colspan')).toBe('6');
      expect(parent[0].textContent).toContain('Athena');
      expect(parent[0].textContent).toContain('ap-northeast-1');

      for (const row of rows.slice(2)) {
        const cells = within(row).getAllByRole('cell');
        expect(cells[1].textContent).toBe('');
        expect(cells[2].textContent).toBe('Database');
        expect(cells[3].textContent).toBe('ap-northeast-1');
      }
    });

    it('keeps ungrouped rows out of any group', () => {
      render(<WaitingApprovalTable resources={[...fixture, athena('db_a', 'ap-northeast-1', true)]} />);
      expect(screen.getAllByRole('button', { name: /그룹 (펼치기|접기)$/ })).toHaveLength(1);
      expect(screen.getByText('sea-live-space-prod')).toBeTruthy();
    });

    // 5개 호출자 중 4개는 `onLogicalDbOpen` 을 주지 않는다(admin ops 확정 표, 설치 상태 상세,
    // 반영중 카드, 승인 대기 카드). 화살표 함수는 언제나 truthy 라, 핸들러 없이도 수가 버튼으로
    // 그려져 그 네 화면에서는 눌러도 아무 일이 없었다 — `LogicalDbCountCell` 이 "아무 일도 안
    // 하는 컨트롤 대신 평문" 이라고 못 박아 둔 바로 그 상태다.
    it('renders the counts as text where no drill-in handler was given', () => {
      render(<WaitingApprovalTable variant="confirmed" resources={[athena('db_a', 'ap-northeast-1', true, [8, 2])]} />);

      expect(screen.queryByRole('button', { name: /연동 논리 DB 목록 보기/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /연동 제외 대상 보기/ })).toBeNull();
      const cells = within(screen.getAllByRole('row')[1]).getAllByRole('cell');
      expect(cells.slice(-2).map((td) => td.textContent)).toEqual(['8개', '2개']);
    });

    // Steps 6·7 never build a TREE. The spec makes the region the resource from step 4 on, so
    // those steps FOLD instead — one row per region, its databases behind a disclosure — and the
    // caller builds that fold off `athena_region_resource_id`, passing `foldedMembers` (below).
    // Rows that arrive without it stay exactly as they came.
    it('does not group in the confirmed variant', () => {
      render(
        <WaitingApprovalTable
          variant="confirmed"
          // 이 variant 의 실제 호출자(ConfirmedIntegrationTable)가 주는 핸들러다. 안 주면 수는
          // 평문으로 그려져 아래 버튼 조회가 못 찾는다 — 그게 이 셀의 계약이다.
          onLogicalDbOpen={() => {}}
          resources={[
            athena('db_a', 'ap-northeast-1', true, [8, 2]),
            athena('db_b', 'ap-northeast-1', true, [12, 1]),
          ]}
        />,
      );

      expect(screen.queryAllByRole('button', { name: /그룹 (펼치기|접기)$/ })).toHaveLength(0);
      // Header + the two resource rows, with no parent row inserted between them.
      expect(screen.getAllByRole('row')).toHaveLength(3);
      // Each row keeps its own count cell; nothing is rolled up into an aggregate.
      expect(screen.getByRole('button', { name: 'db_a 연동 논리 DB 목록 보기' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'db_b 연동 논리 DB 목록 보기' })).toBeTruthy();
      expect(screen.queryByText(/대상 ·/)).toBeNull();
    });

    // — is where a value we do not have goes. Athena·DynamoDB have no logical-DB management at
    // all, so a dash there reads as missing data and sends the user looking for it.
    it('answers 설정 불필요, not —, where logical DBs do not exist', () => {
      render(
        <WaitingApprovalTable
          variant="confirmed"
          resources={[
            { ...athena('db_a', 'ap-northeast-1', true), displayDbType: 'athena' },
            {
              resourceId: 'rds-1',
              resourceType: 'AWS_DB_INSTANCE',
              displayDbType: 'mysql',
              region: 'ap-northeast-1',
              resourceName: 'rds-1',
              selected: true,
              // Counts not loaded yet — this one genuinely IS unknown, so it keeps the dash.
              logicalDbCount: null,
              excludedLogicalDbCount: null,
            },
          ]}
        />,
      );

      const rows = screen.getAllByRole('row');
      expect(within(rows[1]).getAllByRole('cell').slice(4).map((td) => td.textContent)).toEqual([
        '설정 불필요',
        '설정 불필요',
      ]);
      expect(within(rows[2]).getAllByRole('cell').slice(4).map((td) => td.textContent)).toEqual([
        '—',
        '—',
      ]);
    });

    // The verdict reads `database_type` and nothing else. `AWS_ATHENA_DATABASE` is a resource
    // type — it is not the database type `athena` and must not answer for it, or the row's
    // verdict rides on which vocabulary the caller happened to fill in.
    it('does not judge on resourceType when database_type is absent', () => {
      render(
        <WaitingApprovalTable
          variant="confirmed"
          onLogicalDbOpen={() => {}}
          resources={[
            {
              ...athena('db_a', 'ap-northeast-1', true, [3, 0]),
              // The confirmed caller overloads this slot with the database type, so it is the one
              // field that CAN carry a matching value while `displayDbType` is empty. The verdict
              // must still refuse to read it: a row missing database_type keeps its counts.
              resourceType: 'athena',
            },
          ]}
        />,
      );

      const cells = within(screen.getAllByRole('row')[1]).getAllByRole('cell').slice(4);
      expect(cells.map((td) => td.textContent)).not.toContain('설정 불필요');
      expect(screen.getByRole('button', { name: 'db_a 연동 논리 DB 목록 보기' })).toBeTruthy();
    });

    // A database type we were not told is not a database type without logical DBs.
    // `database_type` is optional in the contract, and claiming 설정 불필요 there hid three real
    // target databases on the final-approval screen and removed the 설정 button that reaches them.
    it('keeps the counts when the database type is missing, rather than claiming 설정 불필요', () => {
      render(
        <WaitingApprovalTable
          variant="confirmed"
          resources={[
            {
              resourceId: 'unknown-engine-1',
              resourceType: '',
              region: 'ap-northeast-1',
              resourceName: 'unknown-engine-1',
              selected: true,
              logicalDbCount: 3,
              excludedLogicalDbCount: 0,
            },
          ]}
        />,
      );

      const cells = within(screen.getAllByRole('row')[1]).getAllByRole('cell').slice(4);
      expect(cells.map((td) => td.textContent)).toEqual(['3개', '0개']);
    });

    it('folds a region row to its databases, closed by default (steps 6·7)', () => {
      render(
        <WaitingApprovalTable
          variant="confirmed"
          resources={[
            {
              ...athena('unused', 'ap-northeast-1', true),
              resourceId: 'athena:1:ap-northeast-1/AwsDataCatalog',
              // Steps 6·7 read `database_type` off the confirmed-integration contract, not the
              // scan's `resource_type` the fixture above carries. The confirmed caller puts that
              // one value in BOTH fields (ConfirmedIntegrationTable): `resourceType` because the
              // fold prints its label from there, `displayDbType` because the 논리 DB verdict
              // reads database_type and nothing else.
              resourceType: 'athena',
              displayDbType: 'athena',
              foldedMembers: [
                { resourceId: 'athena:1:ap-northeast-1:AwsDataCatalog/sampledb', resourceName: 'sampledb' },
                { resourceId: 'athena:1:ap-northeast-1:AwsDataCatalog/integration', resourceName: 'integration' },
              ],
            },
          ]}
        />,
      );

      // Closed: the region is one row and says what it is, not what a database is called.
      expect(screen.getAllByRole('row')).toHaveLength(2);
      expect(screen.queryByText('sampledb')).toBeNull();
      const cells = within(screen.getAllByRole('row')[1]).getAllByRole('cell');
      expect(cells[0].textContent).toBe('Athena');
      expect(cells[3].textContent).toBe('ap-northeast-1');

      fireEvent.click(screen.getByRole('button', { name: /데이터베이스 목록 펼치기$/ }));

      const rows = screen.getAllByRole('row');
      expect(rows).toHaveLength(4);
      // Read down the tree: Athena → Database, and the region repeats on every database
      // (owner, 2026-08-13) — a column is read DOWN, and a blank there says "no region".
      for (const row of rows.slice(2)) {
        const memberCells = within(row).getAllByRole('cell');
        expect(memberCells[2].textContent).toBe('Database');
        expect(memberCells[3].textContent).toBe('ap-northeast-1');
      }
      expect(screen.getByText('sampledb')).toBeTruthy();
      expect(screen.getByText('integration')).toBeTruthy();
    });

    // `resource_name` is optional, so two unnamed databases in one region would collide on a ''
    // React key and one of them would be dropped. The id is what is unique.
    it('keys folded children on the id, so unnamed databases do not collide', () => {
      render(
        <WaitingApprovalTable
          variant="confirmed"
          resources={[
            {
              ...athena('unused', 'ap-northeast-1', true),
              resourceId: 'athena:1:ap-northeast-1/AwsDataCatalog',
              resourceType: 'athena',
              displayDbType: 'athena',
              foldedMembers: [
                { resourceId: 'athena:1:ap-northeast-1:AwsDataCatalog/a', resourceName: '' },
                { resourceId: 'athena:1:ap-northeast-1:AwsDataCatalog/b', resourceName: '' },
              ],
            },
          ]}
          expandFolds
        />,
      );

      // Both survive — header + region + two children.
      expect(screen.getAllByRole('row')).toHaveLength(4);
      expect(screen.getAllByText('—')).toHaveLength(2);
    });

    // The row toggles on click and this cell holds a copy button; without the guard, copying
    // the region id also opened the fold.
    it('does not toggle the fold when the Resource ID copy button is clicked', () => {
      render(
        <WaitingApprovalTable
          variant="confirmed"
          resources={[
            {
              ...athena('unused', 'ap-northeast-1', true),
              resourceId: 'athena:1:ap-northeast-1/AwsDataCatalog',
              resourceType: 'athena',
              displayDbType: 'athena',
              foldedMembers: [
                { resourceId: 'athena:1:ap-northeast-1:AwsDataCatalog/sampledb', resourceName: 'sampledb' },
              ],
            },
          ]}
        />,
      );

      expect(screen.getAllByRole('row')).toHaveLength(2);
      fireEvent.click(screen.getByRole('button', { name: /Resource ID/ }));
      expect(screen.getAllByRole('row')).toHaveLength(2);
      expect(screen.queryByText('sampledb')).toBeNull();
    });

    // A row can be in the filtered list because of a database inside its fold. Leaving it shut
    // shows a region that does not visibly contain what the user typed.
    it('opens every fold while the list is narrowed, with no toggle to press', () => {
      const folded = [
        {
          ...athena('unused', 'ap-northeast-1', true),
          resourceId: 'athena:1:ap-northeast-1/AwsDataCatalog',
          resourceType: 'athena',
          displayDbType: 'athena',
          foldedMembers: [
            { resourceId: 'athena:1:ap-northeast-1:AwsDataCatalog/sampledb', resourceName: 'sampledb' },
          ],
        },
      ];
      const { rerender } = render(
        <WaitingApprovalTable variant="confirmed" resources={folded} expandFolds />,
      );

      expect(screen.getByText('sampledb')).toBeTruthy();
      // The filter owns the state, so nothing may offer to change it: as a live toggle the
      // press did nothing visible and recorded an EXPAND, so clearing the filter left the fold
      // open — the opposite of what was pressed. The fold has TWO entry points and both have
      // to go quiet; gating only the chevron left the row itself still writing the state.
      expect(screen.queryByRole('button', { name: /데이터베이스 목록/ })).toBeNull();
      fireEvent.click(within(screen.getAllByRole('row')[1]).getAllByRole('cell')[3]);

      rerender(<WaitingApprovalTable variant="confirmed" resources={folded} />);
      expect(screen.queryByText('sampledb')).toBeNull();
    });

    // The count is a SUM across the fold's databases; the drill-in queries one resource id, so
    // opening the region id would answer with a list that cannot match the number clicked.
    it('renders a folded row’s counts as text, not a drill-in link', () => {
      render(
        <WaitingApprovalTable
          variant="confirmed"
          resources={[
            {
              ...athena('unused', 'ap-northeast-1', true),
              resourceId: 'athena:1:ap-northeast-1/AwsDataCatalog',
              // No engine — the contract allows it, and this is the only path on which a folded
              // row reaches the count columns at all.
              resourceType: '',
              logicalDbCount: 7,
              excludedLogicalDbCount: 2,
              foldedMembers: [
                { resourceId: 'athena:1:ap-northeast-1:AwsDataCatalog/a', resourceName: 'a' },
                { resourceId: 'athena:1:ap-northeast-1:AwsDataCatalog/b', resourceName: 'b' },
              ],
            },
          ]}
        />,
      );

      const cells = within(screen.getAllByRole('row')[1]).getAllByRole('cell');
      expect(cells.slice(4).map((td) => td.textContent)).toEqual(['7개', '2개']);
      expect(screen.queryByRole('button', { name: /연동 논리 DB 목록 보기/ })).toBeNull();
      // An unlabelled row would otherwise be a bare chevron with nothing beside it.
      expect(cells[0].textContent).toBe('—');
    });
  });

  // An RDS cluster connects through ONE member instance. Steps 2·3 are review surfaces, so the
  // list is read-only: it shows what the cluster holds and which one step 1 chose.
  describe('RDS cluster instances', () => {
    const WRITER = {
      resource_id: 'arn:db:demo-1',
      resource_name: 'demo-1',
      availability_zone: 'ap-northeast-2a',
      cluster_member_role: 'WRITER',
    };
    const READER_HIGH = {
      resource_id: 'arn:db:demo-3',
      resource_name: 'demo-3',
      availability_zone: 'ap-northeast-2c',
      cluster_member_role: 'READER',
    };
    const READER_LOW = {
      resource_id: 'arn:db:demo-2',
      resource_name: 'demo-2',
      availability_zone: 'ap-northeast-2b',
      cluster_member_role: 'READER',
    };
    // Writer-first, readers out of ARN order — as the wire sends it.
    const WIRE_ORDER = [WRITER, READER_HIGH, READER_LOW];

    const cluster = (
      overrides: Partial<WaitingApprovalResource> = {},
    ): WaitingApprovalResource => ({
      resourceId: 'arn:cluster:demo',
      resourceType: 'AWS_DB_CLUSTER',
      region: 'ap-northeast-2',
      resourceName: 'demo-cluster',
      selected: true,
      rdsInstanceCandidates: WIRE_ORDER,
      selectedRdsInstanceResourceId: READER_LOW.resource_id,
      ...overrides,
    });

    /**
     * The instance names, in render order. They are not rows of the OUTER table — the members
     * live in the accordion body (`RdsInstancePanel`), which carries its own table roles, so
     * they are read out of that band and never off a page-wide row query.
     */
    const instanceNames = () => {
      const band = screen.queryByRole('table', { name: rdsInstanceBandLabel('demo-cluster') });
      if (!band) return [];
      return Array.from(band.querySelectorAll('span'))
        .map((span) => span.textContent ?? '')
        .filter((text) => /^demo-\d$/.test(text));
    };

    it('lists instances Reader-first then by ARN, regardless of wire order', () => {
      render(<WaitingApprovalTable resources={[cluster()]} />);
      expect(instanceNames()).toEqual(['demo-2', 'demo-3', 'demo-1']);
    });

    it('marks only the chosen instance 선택됨, and never offers a radio', () => {
      render(<WaitingApprovalTable resources={[cluster()]} />);
      expect(screen.getAllByText('선택됨')).toHaveLength(1);
      expect(screen.queryAllByRole('radio')).toHaveLength(0);
      // The chip rides the chosen instance's own LINE inside the band.
      expect(screen.getByText('선택됨').closest('div')?.textContent).toContain('demo-2');
    });

    // colSpan is hand-passed by each host table (`colSpan={6}` here), so a column added to or
    // removed from the header silently leaves the band short or overflowing. `lib/theme.ts`
    // names this exact failure mode as the reason a separate verdict column was rejected.
    it('spans the band across every column of this table', () => {
      render(<WaitingApprovalTable resources={[cluster()]} />);
      const band = required(
        screen.getByRole('table', { name: rdsInstanceBandLabel('demo-cluster') }).closest('td'),
        "the band's spanning cell",
      );
      expect(Number(band.getAttribute('colspan'))).toBe(
        document.querySelectorAll('thead th').length,
      );
    });

    it('shows the member role on every instance line', () => {
      render(<WaitingApprovalTable resources={[cluster()]} />);
      const band = within(screen.getByRole('table', { name: rdsInstanceBandLabel('demo-cluster') }));
      expect(band.getAllByText('Reader')).toHaveLength(2);
      expect(band.getAllByText('Writer')).toHaveLength(1);
      // Scoped to the band because the cluster row now carries the chosen member's role too —
      // a document-wide count would be 3 Readers and pin nothing in particular.
      expect(screen.getAllByText('Reader')).toHaveLength(3);
    });

    // The band is why the columns can say this at all: as rows of this table the AZ was filed
    // under the Region header (the one column left that could hold it) and the endpoint — the
    // other thing a reviewer compares — had nowhere to go.
    it('gives each instance its own labelled AZ and endpoint columns', () => {
      render(<WaitingApprovalTable resources={[cluster()]} />);
      expect(screen.getByText('가용 영역')).toBeTruthy();
      expect(screen.getByText('엔드포인트')).toBeTruthy();
      // The table's Region column stays the CLUSTER's region — one row, one value.
      expect(screen.getAllByText('ap-northeast-2')).toHaveLength(1);
      expect(screen.getByText('ap-northeast-2a')).toBeTruthy();
      expect(screen.getByText('ap-northeast-2b')).toBeTruthy();
      expect(screen.getByText('ap-northeast-2c')).toBeTruthy();
    });

    // The cluster row NAMES the member it connects through, exactly as step 1 does (owner,
    // 2026-08-13) — the count it used to print was the tally PR #630 threw out, and on a review
    // surface the choice is the fact being reviewed.
    it('names the chosen instance on the cluster row, not a count', () => {
      render(<WaitingApprovalTable resources={[cluster()]} />);
      const clusterCell = required(
        screen.getByText('demo-cluster').closest('td'),
        "the cluster's identity cell",
      );
      expect(clusterCell.textContent).toContain('demo-2');
      expect(clusterCell.textContent).toContain('Reader');
      expect(screen.queryByText('3개 인스턴스')).toBeNull();
    });

    it('tags the cluster row RDS Cluster, before the name', () => {
      render(<WaitingApprovalTable resources={[cluster()]} />);
      const nameCell = screen.getByText('RDS Cluster').closest('td');
      expect(nameCell?.textContent?.indexOf('RDS Cluster')).toBeLessThan(
        nameCell?.textContent?.indexOf('demo-cluster') ?? -1,
      );
      // Instance rows are not clusters — one tag for the one cluster.
      expect(screen.getAllByText('RDS Cluster')).toHaveLength(1);
    });

    it('starts expanded and collapses from the chevron', () => {
      render(<WaitingApprovalTable resources={[cluster()]} />);
      expect(instanceNames()).toHaveLength(3);

      fireEvent.click(screen.getByRole('button', { name: 'demo-cluster 인스턴스 목록 접기' }));
      expect(instanceNames()).toHaveLength(0);
      // Folding hides the comparison, never the choice: the tag and the chosen member survive.
      expect(screen.getByText('RDS Cluster')).toBeTruthy();
      const clusterCell = required(
        screen.getByText('demo-cluster').closest('td'),
        "the cluster's identity cell",
      );
      expect(clusterCell.textContent).toContain('demo-2');
    });

    // An excluded PARENT never dims its members' text — exclusion is what the rail says. The band sits
    // on `bgColors.panel`, whose contract forbids `tertiary` there (4.37:1, under AA), so this
    // holds the line for both reasons at once.
    it('keeps an excluded cluster’s instance lines at full contrast', () => {
      render(
        <WaitingApprovalTable
          resources={[cluster({ selected: false, selectedRdsInstanceResourceId: undefined })]}
        />,
      );
      // An excluded cluster starts folded (useClusterFold) — open it to read the lines.
      fireEvent.click(screen.getByRole('button', { name: 'demo-cluster 인스턴스 목록 펼치기' }));
      const band = screen.getByRole('table', { name: rdsInstanceBandLabel('demo-cluster') });
      expect(instanceNames()).toHaveLength(3);
      expect(band.innerHTML).not.toContain(textColors.tertiary);
    });

    // An excluded cluster chose nothing, so nothing is marked; the list is still the evidence,
    // and it starts folded because that evidence is reference rather than review.
    it('folds an excluded cluster, and lists it with no 선택됨 chip once opened', () => {
      render(
        <WaitingApprovalTable
          resources={[cluster({ selected: false, selectedRdsInstanceResourceId: undefined })]}
        />,
      );
      expect(instanceNames()).toHaveLength(0);

      fireEvent.click(screen.getByRole('button', { name: 'demo-cluster 인스턴스 목록 펼치기' }));
      expect(instanceNames()).toHaveLength(3);
      expect(screen.queryByText('선택됨')).toBeNull();
      // Nothing was chosen, so the third line falls back to the count — the honest thing left.
      expect(screen.getByText('인스턴스 3건')).toBeTruthy();
    });

    // Every other row shape, and every other variant, must be untouched by this addition.
    it('leaves a row without instances exactly as it was', () => {
      render(<WaitingApprovalTable resources={fixture} />);
      expect(screen.queryByText(/인스턴스 /)).toBeNull();
      expect(screen.queryByText('Instance')).toBeNull();
      expect(screen.queryByText('RDS Cluster')).toBeNull();
    });

    it('does not list instances on the confirmed variant', () => {
      render(<WaitingApprovalTable variant="confirmed" resources={[cluster()]} />);
      expect(instanceNames()).toHaveLength(0);
      expect(screen.queryByText('선택됨')).toBeNull();
    });
  });

  // Steps 4·6·7 show the cluster FACT but not the member instances — those stay a steps 1–3
  // concern. The tag has to key off the declared top-level type, because `resourceType` is an
  // engine name on exactly these two variants.
  describe('RDS cluster tag without an instance list (steps 4·6·7)', () => {
    const clusterRow = (
      overrides: Partial<WaitingApprovalResource> = {},
    ): WaitingApprovalResource => ({
      resourceId: 'arn:cluster:demo',
      // The engine, as steps 4·6·7 set it — it can never answer "is this a cluster".
      resourceType: 'MYSQL',
      declaredResourceType: 'AWS_DB_CLUSTER',
      region: 'ap-northeast-2',
      resourceName: 'demo-cluster',
      selected: true,
      displayDbType: 'MYSQL',
      ...overrides,
    });

    it('tags the cluster row on the install variant, above the name and with no instances', () => {
      render(<WaitingApprovalTable variant="install" resources={[clusterRow()]} />);
      const nameCell = screen.getByText('RDS Cluster').closest('td');
      expect(nameCell?.textContent?.indexOf('RDS Cluster')).toBeLessThan(
        nameCell?.textContent?.indexOf('demo-cluster') ?? -1,
      );
      expect(screen.queryByText('선택됨')).toBeNull();
      expect(screen.queryByText(/인스턴스 /)).toBeNull();
    });

    // Round 3 (시안 F): on the confirmed variant the kind leaves the identity stack for its
    // own 종류 column. Round 9 (owner): the column sits right of Resource ID and the value
    // is plain text — the chip form is retired.
    it('seats the kind after Resource ID as plain text on the confirmed variant', () => {
      render(<WaitingApprovalTable variant="confirmed" resources={[clusterRow()]} />);
      expect(screen.getByRole('columnheader', { name: '종류' })).toBeTruthy();
      const kindCell = screen.getByText('RDS Cluster').closest('td');
      const row = kindCell?.closest('tr');
      // name → id → kind: third cell, not the leading anchor slot.
      expect(row?.cells[2]).toBe(kindCell);
      // Bare text in the cell — no chip element wraps the value any more.
      expect(kindCell?.textContent).toBe('RDS Cluster');
      expect(kindCell?.children).toHaveLength(0);
      expect(screen.getByText('demo-cluster').closest('td')).not.toBe(kindCell);
      expect(screen.queryByText('선택됨')).toBeNull();
      expect(screen.queryByText(/인스턴스 /)).toBeNull();
    });

    it('keeps printing the engine in the type column', () => {
      render(<WaitingApprovalTable variant="confirmed" resources={[clusterRow()]} />);
      expect(screen.getByText('MySQL')).toBeTruthy();
    });

    // The whole reason for the separate field: an engine name in `resourceType` must not be
    // mistaken for a type, and a row with no declared type must not sprout a tag.
    it('does not tag a row whose declared type is absent or not a cluster', () => {
      render(
        <WaitingApprovalTable
          variant="confirmed"
          resources={[
            clusterRow({ resourceId: 'a', declaredResourceType: undefined }),
            clusterRow({ resourceId: 'b', declaredResourceType: 'AWS_DB_INSTANCE' }),
          ]}
        />,
      );
      expect(screen.queryByText('RDS Cluster')).toBeNull();
    });
  });

  // Round 4 — the covered-clip console grammar. jsdom does no layout, so these assert the
  // MECHANISM is wired (which element clips, which element measures), not the pixels; the
  // pixel behaviour is the browser check in the decision record.
  describe('covered clip (round 4, confirmed variant)', () => {
    const row = (): WaitingApprovalResource => ({
      resourceId: 'arn:aws:rds:ap-northeast-2:804656952396:db:covered',
      resourceType: 'MYSQL',
      region: 'ap-northeast-2',
      resourceName: 'covered-name',
      selected: true,
      displayDbType: 'MYSQL',
    });

    // The hook's per-column floor probes `[data-resize-label]`; unwrap the label and the
    // floor silently degrades to the global 56px AND a shrunk header paints over its
    // neighbour again. Every confirmed header must carry the self-clipping probe span.
    it('wraps every confirmed header label in the clipping floor probe', () => {
      render(<WaitingApprovalTable variant="confirmed" resources={[row()]} />);
      for (const header of screen.getAllByRole('columnheader')) {
        const label = header.querySelector('[data-resize-label]');
        expect(label).toBeTruthy();
        expect(label?.classList.contains('truncate')).toBe(true);
      }
    });

    it('clips at the cell and lets the value run — no self-ellipsis in confirmed cells', () => {
      render(<WaitingApprovalTable variant="confirmed" resources={[row()]} />);
      const nameSpan = screen.getByText('covered-name');
      const nameCell = nameSpan.closest('td');
      // The TD owns the cut (overflow at the padding box = the column stroke)…
      expect(nameCell?.classList.contains('overflow-hidden')).toBe(true);
      expect(nameCell?.classList.contains('whitespace-nowrap')).toBe(true);
      // …so the value itself must NOT ellipsize first: `truncate` would move the cut to the
      // content box, 18px short of the stroke, and draw the "shortened" … instead of the cut.
      expect(nameSpan.classList.contains('truncate')).toBe(false);
    });

    it('keeps the approval variant on the ellipsis grammar', () => {
      render(<WaitingApprovalTable variant="approval" resources={[row()]} />);
      const nameSpan = screen.getByText('covered-name');
      expect(nameSpan.classList.contains('truncate')).toBe(true);
      expect(nameSpan.closest('td')?.classList.contains('overflow-hidden')).toBe(false);
    });

    // Round 11 (owner): "ResourceId가 종류 행에 의해서 더 많이 가려져" — the copy button's
    // in-flow tail reserve made the id's cut land ~46px before the boundary while every
    // other covered cell cuts AT it, so the next column read as covering the id deeper.
    // The reserve is gone: the wrapper runs to the boundary (+18px = the cell's own right
    // padding) and the button overlays on hover.
    // ⛔ Round 15 (owner): "resourceId에 hover로 blur처리를 했니??? 이런거 하지마." The
    // overlay used to stay legible by masking the id's tail to transparent; the id now
    // keeps every pixel of ink and the button covers it with its own opaque chip. The
    // absence of `mask-image` is the assertion — a fade would be a regression.
    it('runs the id to the boundary and overlays the copy button (round 11)', () => {
      const { rerender } = render(
        <WaitingApprovalTable variant="confirmed" resources={[row()]} />,
      );
      const copy = screen.getByRole('button', { name: 'Resource ID 복사' });
      expect(copy.className).toContain('absolute');
      expect(copy.className).toContain('bg-white');
      expect(copy.parentElement?.className).toContain('w-[calc(100%+18px)]');
      expect(copy.parentElement?.className).not.toContain('inline-flex');
      expect(
        screen.getByText('arn:aws:rds:ap-northeast-2:804656952396:db:covered').className,
      ).not.toContain('mask-image');

      // The approval variant keeps the in-flow button — the overlay belongs to the
      // covered grammar only.
      rerender(<WaitingApprovalTable variant="approval" resources={[row()]} />);
      const approvalCopy = screen.getByRole('button', { name: 'Resource ID 복사' });
      expect(approvalCopy.className).not.toContain('absolute');
      expect(approvalCopy.className).toContain('shrink-0');
    });

    // Round 5: the console grid dropped its rails to border-default, and that step only
    // survives the row hover if the hover is the prototype's quiet #F7F9FB — under the
    // approval tint (#EAEEF7) the rails wash to 1.08:1. Wiring only; ratios are measured
    // in the browser (docs/ux/benchmark/target-source-resource-table-console.md).
    it('hovers confirmed rows on the console tint, approval rows on the blue lift', () => {
      const { rerender } = render(
        <WaitingApprovalTable variant="confirmed" resources={[row()]} />,
      );
      const confirmedTr = screen.getByText('covered-name').closest('tr');
      expect(confirmedTr?.className).toContain('hover:bg-[#F7F9FB]');
      expect(confirmedTr?.className).not.toContain('hover:bg-[#EAEEF7]');

      rerender(<WaitingApprovalTable variant="approval" resources={[row()]} />);
      const approvalTr = screen.getByText('covered-name').closest('tr');
      expect(approvalTr?.className).toContain('hover:bg-[#EAEEF7]');
    });

    it('covers the column rail with the resize guide, full header height', () => {
      // Handles only render when a resize instance is wired in, and the covering guide
      // is keyed off clampToContent — the console-table mode — inside the hook itself.
      const Harness = () => {
        const columns = useColumnResize({ clampToContent: true });
        return <WaitingApprovalTable variant="confirmed" resources={[row()]} columns={columns} />;
      };
      render(<Harness />);
      const handle = screen.getAllByRole('separator')[0];
      // Straddling (-right-px, 2px) and full-height: the rail is the NEXT th's
      // border-l, so a flush-inside guide left the grey pixel showing beside the blue
      // (round 6 — "Header의 구분선은 확실히 가리는게 좋을 것 같아").
      expect(handle.className).toContain('after:-right-px');
      expect(handle.className).toContain('after:inset-y-0');
      expect(handle.className).toContain('after:w-0.5');
      expect(handle.className).not.toContain('after:right-[3px]');
    });

    it('divides confirmed rows on the shared hairline, not border-strong', () => {
      // Round 6: with permanent rails sharing the separation work, border-strong rows
      // overshot the consoles (their row rules measure ≈1.19:1) — rows return to the
      // app-wide #EBEEF2 hairline and the hover tint is what blocks a row out.
      render(<WaitingApprovalTable variant="confirmed" resources={[row()]} />);
      const tbody = screen.getByText('covered-name').closest('tbody');
      expect(tbody?.className).toContain('divide-[#EBEEF2]');
      expect(tbody?.className).not.toContain('#D1D5DB');
    });

    it('drops the resting body rails for the covered-sheet shadow', () => {
      // Round 7: at rest the boundary is the covering column's cast shadow (a
      // right-edge gradient in every non-last cell) — permanent td rails are gone,
      // while the header keeps its rails ("Header는 진해도 상관없어").
      render(<WaitingApprovalTable variant="confirmed" resources={[row()]} />);
      const table = screen.getByText('covered-name').closest('table');
      expect(table?.className).toContain('linear-gradient(to_left');
      expect(table?.className).not.toContain('td+td');
      expect(table?.className).toContain('[&_th+th]:border-l');
    });

    it('mounts the console shell for the confirmed variant', () => {
      // Round 13: the grid, the resizable header and the seam's two states moved into
      // ConsoleTable, which owns their tests. What belongs HERE is the wiring: that this
      // variant is on the shell at all, and with the columns this table declares.
      const { container } = render(
        <WaitingApprovalTable variant="confirmed" resources={[row()]} />,
      );
      const table = required(container.querySelector('table'), 'the confirmed table');
      expect(table.className).toContain('table-fixed');
      expect(table.className).toContain('linear-gradient(to_left');
      expect(container.querySelector('[data-seam-tracer]')).toBeTruthy();
      // Σ(162 name + 312 id + 142 dbType + 156 region + 118 논리DB + 96 제외) = 986. No
      // 종류 column: this fixture is neither an RDS cluster nor an EC2 instance, and
      // leaving the column OUT of the spec is how "no row could fill it" is expressed.
      expect((table as HTMLElement).style.width).toBe('986px');
    });

    it('skips the seam tracer for approval tables', () => {
      const { container } = render(
        <WaitingApprovalTable variant="approval" resources={[row()]} />,
      );
      expect(container.querySelector('[data-seam-tracer]')).toBeNull();
    });
  });
});
