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
      'Database Type',
      'Resource ID',
      'Region',
      'Resource Name',
      '연동 대상 여부',
      '제외 사유',
    ]);
  });

  it('maps selected boolean to 대상/비대상', () => {
    render(<WaitingApprovalTable resources={fixture} />);
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('대상')).toBeTruthy();
    expect(within(rows[1]).getByText('대상')).toBeTruthy();
    expect(within(rows[2]).getByText('비대상')).toBeTruthy();
  });

  it('renders the em-dash placeholder for an excluded row without an exclusion reason', () => {
    render(<WaitingApprovalTable resources={fixture} />);
    const rows = screen.getAllByRole('row').slice(1);
    // row[2] is the excluded fixture row with no exclusionReason → 제외 사유 placeholder.
    expect(within(rows[2]).getAllByText('—').length).toBe(1);
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
    // index 1: Resource ID, 2: Region, 3: Resource Name
    expect(cells[1].className).toContain('font-mono');
    expect(cells[2].className).toContain('font-mono');
    expect(cells[3].className).toContain('font-mono');
  });

  it('mounts a hover-revealed CopyButton on Resource ID, Region, and Resource Name cells', () => {
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
    expect(buttons).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'res-1 복사' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'us-east-1 복사' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'orders-db 복사' })).toBeTruthy();
    buttons.forEach((b) => {
      expect(b.className).toContain('opacity-0');
      expect(b.className).toContain('group-hover:opacity-100');
    });
  });

  it('omits CopyButton when region or resourceName is empty', () => {
    const resources: WaitingApprovalResource[] = [
      {
        resourceId: 'res-2',
        resourceType: 'MySQL',
        region: '',
        resourceName: '',
        selected: true,
      },
    ];
    render(<WaitingApprovalTable resources={resources} />);
    expect(screen.getAllByRole('button', { name: /복사$/ })).toHaveLength(1);
  });
});
