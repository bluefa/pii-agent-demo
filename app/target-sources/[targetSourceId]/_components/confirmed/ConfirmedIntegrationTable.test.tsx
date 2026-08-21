// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConfirmedResource } from '@/lib/types/resources';

const getSummariesMock = vi.fn();
vi.mock('@/app/lib/api', () => ({
  getLatestTestConnectionResultSummaries: (...args: unknown[]) => getSummariesMock(...args),
}));

import { ConfirmedIntegrationTable } from '@/app/target-sources/[targetSourceId]/_components/confirmed/ConfirmedIntegrationTable';

const makeResource = (
  overrides: Partial<ConfirmedResource> = {},
): ConfirmedResource => ({
  resourceId: 'res-1',
  type: 'RDS',
  databaseType: 'MYSQL',
  region: 'ap-northeast-2',
  resourceName: 'res-1',
  host: 'localhost',
  port: 3306,
  oracleServiceId: null,
  networkInterfaceId: null,
  ipConfigurationName: null,
  credentialId: 'cred-1',
  connectionStatus: 'CONNECTED',
  ...overrides,
});

describe('ConfirmedIntegrationTable', () => {
  beforeEach(() => {
    getSummariesMock.mockReset();
    // Default: no summaries available → logical-DB cells render "—".
    getSummariesMock.mockResolvedValue([]);
  });

  it('renders empty-state message when no resources are passed', () => {
    render(<ConfirmedIntegrationTable confirmed={[]} targetSourceId={42} />);
    expect(screen.getByText('확정된 연동 대상 DB 가 없습니다.')).toBeTruthy();
  });

  describe('steps 6·7 shared grammar', () => {
    it('renders the step-2·3 approval columns plus the Step 5 logical-DB counts', () => {
      const { container } = render(
        <ConfirmedIntegrationTable confirmed={[makeResource()]} targetSourceId={42} />,
      );
      const headers = Array.from(container.querySelectorAll('thead th')).map((th) => th.textContent);
      expect(headers).toEqual([
        'Resource Name',
        'Resource ID',
        'Database Type',
        'Region',
        '연동 논리 DB',
        '연동 제외',
      ]);
    });

    // Which credential was picked is a step-5 decision; a successful connection is the
    // evidence it was right, so steps 6·7 spend the column on what is actually reviewed.
    it('drops the DB Credential column', () => {
      render(
        <ConfirmedIntegrationTable
          confirmed={[makeResource({ credentialId: 'cred-prod' })]}
          targetSourceId={42}
        />,
      );
      expect(screen.queryByText('DB Credential')).toBeNull();
      expect(screen.queryByText('cred-prod')).toBeNull();
    });

    it('drops the Connection Status column (not in the confirmed-integration contract)', () => {
      render(<ConfirmedIntegrationTable confirmed={[makeResource()]} targetSourceId={42} />);
      expect(screen.queryByText('Connection Status')).toBeNull();
      expect(screen.queryByText('Success')).toBeNull();
      expect(screen.queryByText('Pending')).toBeNull();
    });

    it('renders a non-zero count as a button and zero as plain text', async () => {
      getSummariesMock.mockResolvedValue([
        {
          resource_id: 'res-1',
          agent_id: 'agent-1',
          logical_database_count: 6,
          excluded_logical_database_count: 0,
        },
      ]);
      const { container } = render(
        <ConfirmedIntegrationTable confirmed={[makeResource({ resourceId: 'res-1' })]} targetSourceId={42} />,
      );
      // 6 opens the list; 0 has nothing to open, so it must not be a control.
      await waitFor(() => expect(screen.getByRole('button', { name: /연동 논리 DB 목록 보기/ })).toBeTruthy());
      expect(screen.queryByRole('button', { name: /연동 제외 대상 보기/ })).toBeNull();
      const dataRow = container.querySelector('tbody tr');
      if (!(dataRow instanceof HTMLElement)) throw new Error('expected data row');
      const cellTexts = Array.from(within(dataRow).getAllByRole('cell')).map((c) => c.textContent);
      expect(cellTexts[4]).toBe('6개');
      expect(cellTexts[5]).toBe('0개');
    });

    // No summary row for the resource → "—", never a fabricated 0.
    it('renders — when the resource has no summary row', async () => {
      getSummariesMock.mockResolvedValue([]);
      const { container } = render(
        <ConfirmedIntegrationTable confirmed={[makeResource({ resourceId: 'res-1' })]} targetSourceId={42} />,
      );
      await waitFor(() => expect(getSummariesMock).toHaveBeenCalled());
      const dataRow = container.querySelector('tbody tr');
      if (!(dataRow instanceof HTMLElement)) throw new Error('expected data row');
      const cellTexts = Array.from(within(dataRow).getAllByRole('cell')).map((c) => c.textContent);
      expect(cellTexts[4]).toBe('—');
      expect(cellTexts[5]).toBe('—');
    });

    // Round 3 (시안 D via F): search/filter appear only past Cloudscape's ">5 items" line —
    // at one row the counter band already says everything they could.
    it('hides search + filter at ≤5 rows and always shows the counter band', () => {
      render(<ConfirmedIntegrationTable confirmed={[makeResource()]} targetSourceId={42} />);
      expect(screen.queryByRole('textbox', { name: '리소스 검색' })).toBeNull();
      expect(screen.queryByRole('button', { name: '필터' })).toBeNull();
      expect(screen.getByText('연동 리소스')).toBeTruthy();
      expect(screen.getByText('· 1건')).toBeTruthy();
      expect(screen.getByRole('button', { name: '열 너비 초기화' })).toBeTruthy();
    });

    it('shows search + filter once the list passes five rows', () => {
      const six = Array.from({ length: 6 }, (_, i) =>
        makeResource({ resourceId: `res-${i}`, resourceName: `db-${i}` }),
      );
      render(<ConfirmedIntegrationTable confirmed={six} targetSourceId={42} />);
      expect(screen.getByRole('textbox', { name: '리소스 검색' })).toBeTruthy();
      expect(screen.getByRole('button', { name: '필터' })).toBeTruthy();
    });

    it('renders Region and Resource Name values', () => {
      render(
        <ConfirmedIntegrationTable
          confirmed={[makeResource({ region: 'ap-northeast-1', resourceName: 'sea-live-space-prod' })]}
          targetSourceId={42}
        />,
      );
      expect(screen.getByText('ap-northeast-1')).toBeTruthy();
      expect(screen.getByText('sea-live-space-prod')).toBeTruthy();
    });

    it('fetches the test-connection summaries — step 6 now renders the counts too', async () => {
      render(<ConfirmedIntegrationTable confirmed={[makeResource()]} targetSourceId={42} />);
      await waitFor(() => expect(getSummariesMock).toHaveBeenCalled());
    });

    it('does not render Status, 연동 대상 논리 DB, 연동 제외 논리 DB columns', () => {
      render(<ConfirmedIntegrationTable confirmed={[makeResource()]} targetSourceId={42} />);
      expect(screen.queryByText('Status')).toBeNull();
      expect(screen.queryByText('연동 대상 논리 DB')).toBeNull();
      expect(screen.queryByText('연동 제외 논리 DB')).toBeNull();
    });
  });

  it('mounts a hover-revealed CopyButton on Resource ID', () => {
    render(
      <ConfirmedIntegrationTable
        confirmed={[makeResource({ resourceId: 'conf-x' })]}
        targetSourceId={42}
      />,
    );
    const button = screen.getByRole('button', { name: 'Resource ID 복사' });
    expect(button.className).toContain('opacity-0');
    expect(button.className).toContain('group-hover/resid:opacity-100');
  });

  // Steps 6·7. This table sets `resourceType` to the ENGINE (it doubles as the fold label and
  // the grouping key), so the cluster fact has to travel on `declaredResourceType` — carrying
  // `type` was previously dropped here entirely.
  describe('RDS cluster tag', () => {
    it('tags a cluster row while still printing its engine', async () => {
      render(
        <ConfirmedIntegrationTable
          confirmed={[makeResource({ type: 'AWS_DB_CLUSTER', resourceName: 'demo-cluster' })]}
          targetSourceId={42}
        />,
      );
      await waitFor(() => expect(screen.getByText('RDS Cluster')).toBeTruthy());
      // The DB Type column is unaffected — the tag adds a fact, it does not replace one.
      expect(screen.getByText('MySQL')).toBeTruthy();
      expect(screen.getByText('demo-cluster')).toBeTruthy();
    });

    it('leaves a single-instance row untagged', async () => {
      render(
        <ConfirmedIntegrationTable
          confirmed={[makeResource({ type: 'AWS_DB_INSTANCE' })]}
          targetSourceId={42}
        />,
      );
      await waitFor(() => expect(screen.getByText('MySQL')).toBeTruthy());
      expect(screen.queryByText('RDS Cluster')).toBeNull();
    });
  });
});
