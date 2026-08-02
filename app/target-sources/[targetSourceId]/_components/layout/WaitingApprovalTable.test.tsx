// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
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
    expect(selectedCells[0].className).not.toContain('text-[#6B7280]');
    // Excluded: every text cell rests on #6B7280 (4.63:1 on the row tint — AA floor with margin).
    expect(excludedCells[0].className).toContain('text-[#6B7280]');
    expect(within(excludedCells[1]).getByText('pg-analytics-03').className).toContain('text-[#6B7280]');
    expect(excludedCells[2].className).toContain('text-[#6B7280]');
    expect(excludedCells[3].className).toContain('text-[#6B7280]');
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

    it('keeps ungrouped rows out of any group', () => {
      render(<WaitingApprovalTable resources={[...fixture, athena('db_a', 'ap-northeast-1', true)]} />);
      expect(screen.getAllByRole('button', { name: /그룹 (펼치기|접기)$/ })).toHaveLength(1);
      expect(screen.getByText('sea-live-space-prod')).toBeTruthy();
    });

    // Steps 6·7. The spec makes the region the resource from step 4 on, so those steps want one
    // folded Athena row per region — not a parent with database children. Until that fold lands
    // they stay flat: a tree here would assert a shape the step does not have, and would put a
    // logical-DB aggregate on Athena, which has no logical-DB management at all.
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
  });
});
