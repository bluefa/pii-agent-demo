// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IdcResourceTable } from '@/app/admin/pipelines/queue/requests/_components/IdcResourceTable';
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';

vi.mock('@/app/components/ui/Tooltip', () => ({
  InfoTooltip: () => null,
  IdentifierTip: () => null,
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
}));

const row = (over: Partial<RequestResourceRow>): RequestResourceRow =>
  ({
    resourceId: 'r1',
    connectTargets: ['10.0.0.1'],
    port: 3306,
    databaseType: 'MYSQL',
    oracleSid: null,
    sourceIps: ['172.16.0.11'],
    selected: true,
    nlbIndex: null,
    integrationCategory: 'INTEGRATION_TARGET',
    exclusionReason: null,
    ...over,
  }) as RequestResourceRow;

/**
 * Console shape (LIN-100) — the admin copy's ledger sums, pinned. Corrections landed with
 * the migration (접속 260→200 · dbType 170→172 · 출발지 160→144, owner-approved), so the
 * old numbers must not resurface. With the verdict pair the reason column is the sink;
 * without it the endpoint is the single flex and stays its own sink.
 */
describe('admin IdcResourceTable — console column spec', () => {
  const shape = (props: Partial<React.ComponentProps<typeof IdcResourceTable>>) => {
    const { container } = render(
      <IdcResourceTable rows={[row({})]} onAssignNlb={() => {}} {...props} />,
    );
    const table = container.querySelector('table') as HTMLTableElement;
    return {
      minWidth: table.style.minWidth,
      widths: Array.from(container.querySelectorAll('thead th')).map(
        (th) => (th as HTMLElement).style.width,
      ),
    };
  };

  it('full request view holds the 1070 floor with 제외 사유 as the sink', () => {
    const { minWidth, widths } = shape({ onShowServices: () => {} });
    expect(minWidth).toBe('1070px');
    // endpoint(flex, %) · dbType · port · target · nlb · src · services · reason(auto sink)
    expect(widths).toEqual([
      `${((200 / 1070) * 100).toFixed(4)}%`,
      '172px',
      '80px',
      '112px',
      '110px',
      '144px',
      '110px',
      'auto',
    ]);
  });

  it('확정 variant (no verdict, no services) holds 706 with the endpoint as sink', () => {
    const { minWidth, widths } = shape({ showVerdict: false });
    expect(minWidth).toBe('706px');
    expect(widths).toEqual(['auto', '172px', '80px', '110px', '144px']);
  });
});
