// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { type IdcResourceView } from '@/app/lib/api/idc';
import { IdcResourceTable } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';
import { IdcConnStatusCell } from '@/app/target-sources/[targetSourceId]/_components/idc/cells';

// Stub the tooltip/pagination chrome so only the table cells under test render.
vi.mock('@/app/components/ui/Tooltip', () => ({
  InfoTooltip: () => null,
  IdentifierTip: () => null,
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/app/components/ui/Pagination', () => ({ Pagination: () => null }));

const view = (over: Partial<IdcResourceView>): IdcResourceView => ({
  resourceId: 'r',
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
  ...over,
});

/**
 * The credential-aware connection status (v16 audit fix). It is no longer a table column —
 * steps 5·6·7 all render `logicalro` — but the completion-approval modal still asks the same
 * question per row, so the cell keeps its own coverage.
 */
describe('IdcConnStatusCell — credential-aware status', () => {
  it('renders Success for a credentialed row whose test passed', () => {
    render(
      <IdcConnStatusCell
        resource={view({ resourceId: 'with-cred', credentialId: 'idc_svc_mysql', connection: 'SUCCESS' })}
      />,
    );
    expect(screen.getByText('Success')).toBeTruthy();
  });

  it("shows '자격 증명 필요' for a live row with no credential", () => {
    render(
      <IdcConnStatusCell
        resource={view({ resourceId: 'no-cred', credentialId: undefined, connection: 'PENDING' })}
      />,
    );
    expect(screen.getByText('자격 증명 필요')).toBeTruthy();
    expect(screen.queryByText('Pending')).toBeNull();
  });
});

/**
 * Steps 5·6·7 column set (`src`, `logicalro`) — the Step 5 logical-DB result. A non-zero count
 * opens the read-only list; 0 has nothing to open; a resource with no summary row renders
 * "—" rather than a fabricated 0.
 */
describe('IdcResourceTable — step-6 logicalro', () => {
  const counts = new Map([['r1', { target: 6, excluded: 0 }]]);

  it('renders a non-zero count as a button and zero as plain text', () => {
    const onOpen = vi.fn();
    render(
      <IdcResourceTable
        resources={[view({ resourceId: 'r1' })]}
        cols={['src', 'logicalro']}
        logicalDbCounts={counts}
        onLogicalOpen={onOpen}
      />,
    );
    const open = screen.getByRole('button', { name: /연동 논리 DB 목록 보기/ });
    expect(screen.queryByRole('button', { name: /연동 제외 대상 보기/ })).toBeNull();
    fireEvent.click(open);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('renders — when the resource has no summary row', () => {
    const { container } = render(
      <IdcResourceTable
        resources={[view({ resourceId: 'other' })]}
        cols={['src', 'logicalro']}
        logicalDbCounts={counts}
      />,
    );
    const cells = Array.from(container.querySelectorAll('tbody td')).map((td) => td.textContent);
    // 구분 / 접속 주소 / Port / Database Type / Source IP / 연동 논리 DB / 연동 제외
    expect(cells[5]).toBe('—');
    expect(cells[6]).toBe('—');
  });

  it('drops the DB Credential and Connection Status columns', () => {
    render(
      <IdcResourceTable
        resources={[view({ resourceId: 'r1', credentialId: 'idc_svc_mysql' })]}
        cols={['src', 'logicalro']}
        logicalDbCounts={counts}
      />,
    );
    expect(screen.queryByText('DB Credential')).toBeNull();
    expect(screen.queryByText('Connection Status')).toBeNull();
    expect(screen.queryByText('idc_svc_mysql')).toBeNull();
  });
});
