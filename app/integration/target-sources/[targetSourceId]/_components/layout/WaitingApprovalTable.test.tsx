// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  WaitingApprovalTable,
  type WaitingApprovalResource,
} from '@/app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';

const fixture: WaitingApprovalResource[] = [
  {
    resourceId: 'mysql-prod-01',
    resourceType: 'MySQL',
    region: 'ap-northeast-1',
    resourceName: 'sea-live-space-prod',
    selected: true,
    scanStatus: 'NEW_SCAN',
  },
  {
    resourceId: 'mysql-stg-02',
    resourceType: 'MySQL',
    region: 'ap-northeast-1',
    resourceName: 'sea-live-space-stg',
    selected: true,
    scanStatus: 'UNCHANGED',
  },
  {
    resourceId: 'pg-analytics-03',
    resourceType: 'PostgreSQL',
    region: 'ap-northeast-1',
    resourceName: 'sea-live-space-prd',
    selected: false,
    scanStatus: null,
  },
];

describe('WaitingApprovalTable', () => {
  it('renders the 7 column headers in order', () => {
    render(<WaitingApprovalTable resources={fixture} />);
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toEqual([
      '#',
      'DB Type',
      'Resource ID',
      'Region',
      'Resource Name',
      '연동 대상 여부',
      '스캔 이력',
    ]);
  });

  it('renders 1-based row index', () => {
    render(<WaitingApprovalTable resources={fixture} />);
    const rows = screen.getAllByRole('row').slice(1); // skip header row
    expect(within(rows[0]).getByText('1')).toBeTruthy();
    expect(within(rows[1]).getByText('2')).toBeTruthy();
    expect(within(rows[2]).getByText('3')).toBeTruthy();
  });

  it('maps selected boolean to 대상/비대상', () => {
    render(<WaitingApprovalTable resources={fixture} />);
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('대상')).toBeTruthy();
    expect(within(rows[1]).getByText('대상')).toBeTruthy();
    expect(within(rows[2]).getByText('비대상')).toBeTruthy();
  });

  it('maps scanStatus enum to label', () => {
    render(<WaitingApprovalTable resources={fixture} />);
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('신규')).toBeTruthy();
    expect(within(rows[1]).getByText('변경')).toBeTruthy();
    // null scanStatus → em-dash placeholder
    expect(within(rows[2]).getByText('—')).toBeTruthy();
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
    // index 2: Resource ID, 3: Region, 4: Resource Name
    expect(cells[2].className).toContain('font-mono');
    expect(cells[3].className).toContain('font-mono');
    expect(cells[4].className).toContain('font-mono');
  });
});
