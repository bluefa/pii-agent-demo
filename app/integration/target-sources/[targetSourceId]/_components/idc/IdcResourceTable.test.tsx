// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { IDC_SEED } from '@/lib/mock-idc';
import { toIdcResourceView, type IdcResourceView } from '@/app/lib/api/idc';
import { IdcResourceTable } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';

// Stub the tooltip/pagination chrome so only the table cells under test render.
vi.mock('@/app/components/ui/Tooltip', () => ({
  InfoTooltip: () => null,
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
 * Step-6 column set (`src`, `credro`, `conn`) — locks the two v16 audit fixes:
 * the read-only credential text and the credential-aware connection status.
 */
describe('IdcResourceTable — step-6 credro/conn', () => {
  it('renders the assigned credential as mono text when present', () => {
    render(
      <IdcResourceTable
        resources={[view({ resourceId: 'with-cred', credentialId: 'idc_svc_mysql', connection: 'SUCCESS' })]}
        cols={['src', 'credro', 'conn']}
      />,
    );
    const row = screen.getByText('idc_svc_mysql').closest('tr')!;
    // Credential-aware status: cred + SUCCESS -> Success (not the plain Pending/Success badge path).
    expect(within(row).getByText('Success')).toBeTruthy();
  });

  it("shows '자격 증명 필요' for a live row with no credential", () => {
    render(
      <IdcResourceTable
        resources={[view({ resourceId: 'no-cred', credentialId: undefined, connection: 'PENDING' })]}
        cols={['src', 'credro', 'conn']}
      />,
    );
    expect(screen.getByText('자격 증명 필요')).toBeTruthy();
    // No-cred credro cell renders the em-dash placeholder, never 'Pending'.
    expect(screen.queryByText('Pending')).toBeNull();
  });
});

/** The IDC mock seed must carry row1's read-only credential (v16 idcTargets row1). */
describe('IDC_SEED credential seeding', () => {
  it('seeds idc_svc_mysql on row1 only, leaving the other rows credential-less', () => {
    const views = IDC_SEED.map((r, i) => toIdcResourceView(r, i));
    expect(views[0].credentialId).toBe('idc_svc_mysql');
    expect(views[1].credentialId).toBeUndefined();
    expect(views[2].credentialId).toBeUndefined();
  });
});
