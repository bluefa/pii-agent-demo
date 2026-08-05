// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  DIM_TEXT,
  WaitingApprovalTable,
  type WaitingApprovalResource,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';

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

  it('dims excluded-row text to the AA tier, leaving selected rows at full contrast', () => {
    render(<WaitingApprovalTable resources={fixture} />);
    const rows = screen.getAllByRole('row').slice(1);
    const selectedCells = within(rows[0]).getAllByRole('cell');
    const excludedCells = within(rows[2]).getAllByRole('cell');
    expect(selectedCells[0].className).not.toContain(DIM_TEXT);
    // Excluded: every text cell rests on the dim tier (4.63:1 on the row tint — AA floor with margin).
    expect(excludedCells[0].className).toContain(DIM_TEXT);
    expect(within(excludedCells[1]).getByText('pg-analytics-03').className).toContain(DIM_TEXT);
    expect(excludedCells[2].className).toContain(DIM_TEXT);
    expect(excludedCells[3].className).toContain(DIM_TEXT);
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
      expect(screen.getByText('1 대상 · 1 제외 · 총 2')).toBeTruthy();
      expect(screen.getByText('1 대상 · 0 제외 · 총 1')).toBeTruthy();
    });

    // Read down the tree the Database Type column says Athena → Database, so a child name like
    // `db_a` is identified as a database rather than left as a bare string. Region is the
    // parent's alone, and the child's id is dropped — it is the parent's path plus that name.
    it('says Athena on the parent and Database on each child, with Region only on the parent', () => {
      render(
        <WaitingApprovalTable
          resources={[athena('db_a', 'ap-northeast-1', true), athena('db_b', 'ap-northeast-1', false)]}
        />,
      );

      const rows = screen.getAllByRole('row');
      // Column order: Name(0) · ID(1) · DB Type(2) · Region(3) · 요청 대상 여부(4) · 제외 사유(5).
      const parent = within(rows[1]).getAllByRole('cell');
      expect(parent[2].textContent).toBe('Athena');
      expect(parent[3].textContent).toBe('ap-northeast-1');

      for (const row of rows.slice(2)) {
        const cells = within(row).getAllByRole('cell');
        expect(cells[1].textContent).toBe('');
        expect(cells[2].textContent).toBe('Database');
        expect(cells[3].textContent).toBe('');
      }
    });

    it('keeps ungrouped rows out of any group', () => {
      render(<WaitingApprovalTable resources={[...fixture, athena('db_a', 'ap-northeast-1', true)]} />);
      expect(screen.getAllByRole('button', { name: /그룹 (펼치기|접기)$/ })).toHaveLength(1);
      expect(screen.getByText('sea-live-space-prod')).toBeTruthy();
    });

    // Steps 6·7 never build a TREE. The spec makes the region the resource from step 4 on, so
    // those steps FOLD instead — one row per region, its databases behind a disclosure — and the
    // caller builds that fold off `athena_region_resource_id`, passing `foldedMembers` (below).
    // Rows that arrive without it stay exactly as they came.
    it('does not group in the confirmed variant', () => {
      render(
        <WaitingApprovalTable
          variant="confirmed"
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
            { ...athena('db_a', 'ap-northeast-1', true), resourceType: 'athena' },
            {
              resourceId: 'rds-1',
              resourceType: 'mysql',
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

    // An engine we were not told is not an engine without logical DBs. `database_type` is
    // optional in the contract, and claiming 설정 불필요 there hid three real target databases
    // on the final-approval screen and removed the 설정 button that reaches them.
    it('keeps the counts when the engine is missing, rather than claiming 설정 불필요', () => {
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
              // scan's `resource_type` the fixture above carries.
              resourceType: 'athena',
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
      // Read down the tree: Athena → Database. The name alone is just a string.
      for (const row of rows.slice(2)) {
        expect(within(row).getAllByRole('cell')[2].textContent).toBe('Database');
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
});
