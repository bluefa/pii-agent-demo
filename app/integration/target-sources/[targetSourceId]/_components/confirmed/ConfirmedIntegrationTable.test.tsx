// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConfirmedResource } from '@/lib/types/resources';

const getSummariesMock = vi.fn();
vi.mock('@/app/lib/api', () => ({
  getLatestTestConnectionResultSummaries: (...args: unknown[]) => getSummariesMock(...args),
}));

import {
  ConfirmedIntegrationTable,
  type ConfirmedIntegrationTableVariant,
} from '@/app/integration/target-sources/[targetSourceId]/_components/confirmed/ConfirmedIntegrationTable';

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

  describe('variant=pre-install (default)', () => {
    it('renders the 6 v15 columns: Database Type / Resource ID / Region / Resource Name / DB Credential / Connection Status', () => {
      render(
        <ConfirmedIntegrationTable confirmed={[makeResource()]} targetSourceId={42} />,
      );
      expect(screen.getByRole('columnheader', { name: 'Database Type' })).toBeTruthy();
      expect(screen.getByRole('columnheader', { name: 'Resource ID' })).toBeTruthy();
      expect(screen.getByRole('columnheader', { name: 'Region' })).toBeTruthy();
      expect(screen.getByRole('columnheader', { name: 'Resource Name' })).toBeTruthy();
      expect(screen.getByRole('columnheader', { name: 'DB Credential' })).toBeTruthy();
      expect(screen.getByRole('columnheader', { name: 'Connection Status' })).toBeTruthy();
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

    it('renders Connection Status as "-" (not fabricated) — no test-connection result on this step', () => {
      const { container } = render(
        <ConfirmedIntegrationTable confirmed={[makeResource()]} targetSourceId={42} />,
      );
      // Connection Status is not in the confirmed-integration contract; no Success/Pending
      // badge is invented here (that only comes from a Step 5 test-connection fetch).
      expect(screen.queryByText('Success')).toBeNull();
      expect(screen.queryByText('Pending')).toBeNull();
      const dataRow = container.querySelector('tbody tr');
      if (!(dataRow instanceof HTMLElement)) throw new Error('expected data row');
      const cellTexts = Array.from(within(dataRow).getAllByRole('cell')).map((c) => c.textContent);
      // cells: Database Type / Resource ID / Region / Resource Name / DB Credential / Connection Status
      expect(cellTexts[5]).toBe('-');
    });

    it('does not fetch test-connection summaries on the pre-install variant', () => {
      render(<ConfirmedIntegrationTable confirmed={[makeResource()]} targetSourceId={42} />);
      expect(getSummariesMock).not.toHaveBeenCalled();
    });

    it('does not render Status, 연동 대상 논리 DB, 연동 제외 논리 DB columns', () => {
      render(<ConfirmedIntegrationTable confirmed={[makeResource()]} targetSourceId={42} />);
      expect(screen.queryByText('Status')).toBeNull();
      expect(screen.queryByText('연동 대상 논리 DB')).toBeNull();
      expect(screen.queryByText('연동 제외 논리 DB')).toBeNull();
    });
  });

  describe('variant=complete', () => {
    it('renders the v15 columns incl. Region + Resource Name + logical DB + Status', () => {
      render(
        <ConfirmedIntegrationTable
          confirmed={[makeResource()]}
          variant="complete"
          targetSourceId={42}
        />,
      );
      expect(screen.getByRole('columnheader', { name: 'Database Type' })).toBeTruthy();
      expect(screen.getByRole('columnheader', { name: 'Resource ID' })).toBeTruthy();
      expect(screen.getByRole('columnheader', { name: 'Region' })).toBeTruthy();
      expect(screen.getByRole('columnheader', { name: 'Resource Name' })).toBeTruthy();
      expect(screen.getByRole('columnheader', { name: 'DB Credential' })).toBeTruthy();
      expect(screen.getByText('연동 대상 논리 DB')).toBeTruthy();
      expect(screen.getByText('연동 제외 논리 DB')).toBeTruthy();
      expect(screen.getByText('Status')).toBeTruthy();
    });

    it('does not render the pre-install-only 유형 column', () => {
      render(
        <ConfirmedIntegrationTable
          confirmed={[makeResource()]}
          variant="complete"
          targetSourceId={42}
        />,
      );
      expect(screen.queryByText('유형')).toBeNull();
    });

    it('renders the per-row Status cell as "—" (no per-resource health in the contract)', () => {
      const { container } = render(
        <ConfirmedIntegrationTable
          confirmed={[makeResource()]}
          variant="complete"
          targetSourceId={42}
        />,
      );
      // No fabricated Healthy/Unhealthy badge — the contract has no per-resource health.
      expect(screen.queryByText('Healthy')).toBeNull();
      expect(screen.queryByText('Unhealthy')).toBeNull();
      const dataRow = container.querySelector('tbody tr');
      if (!(dataRow instanceof HTMLElement)) throw new Error('expected data row');
      const cellTexts = Array.from(within(dataRow).getAllByRole('cell')).map((c) => c.textContent);
      // cells: Database Type / Resource ID / Region / Resource Name / DB Credential
      //        / target logical DB / excluded logical DB / Status
      expect(cellTexts[7]).toBe('—');
    });

    it('renders real logical DB counts from the latest test-connection result summaries', async () => {
      getSummariesMock.mockResolvedValue([
        {
          resource_id: 'res-1',
          agent_id: 'agent-1',
          logical_database_count: 9,
          excluded_logical_database_count: 2,
        },
      ]);
      const { container } = render(
        <ConfirmedIntegrationTable
          confirmed={[makeResource({ resourceId: 'res-1' })]}
          variant="complete"
          targetSourceId={42}
        />,
      );
      await waitFor(() => {
        const dataRow = container.querySelector('tbody tr');
        if (!(dataRow instanceof HTMLElement)) throw new Error('expected data row');
        const cellTexts = Array.from(within(dataRow).getAllByRole('cell')).map((c) => c.textContent);
        // cells[5] = 연동 대상 논리 DB, cells[6] = 연동 제외 논리 DB
        expect(cellTexts[5]).toBe('9');
        expect(cellTexts[6]).toBe('2');
      });
    });

    it('renders "—" for logical DB counts when a resource has no summary entry', async () => {
      getSummariesMock.mockResolvedValue([
        {
          resource_id: 'other-res',
          agent_id: 'agent-1',
          logical_database_count: 5,
          excluded_logical_database_count: 1,
        },
      ]);
      const { container } = render(
        <ConfirmedIntegrationTable
          confirmed={[makeResource({ resourceId: 'res-1' })]}
          variant="complete"
          targetSourceId={42}
        />,
      );
      // Give the fetch a tick; the missing-entry resource keeps its "—" placeholder.
      await waitFor(() => expect(getSummariesMock).toHaveBeenCalled());
      const dataRow = container.querySelector('tbody tr');
      if (!(dataRow instanceof HTMLElement)) throw new Error('expected data row');
      const cellTexts = Array.from(within(dataRow).getAllByRole('cell')).map((c) => c.textContent);
      expect(cellTexts[5]).toBe('—');
      expect(cellTexts[6]).toBe('—');
    });
  });

  it.each<[ConfirmedIntegrationTableVariant]>([
    ['pre-install'],
    ['complete'],
  ])('mounts a hover-revealed CopyButton on Resource ID in %s variant', (variant) => {
    render(
      <ConfirmedIntegrationTable
        confirmed={[makeResource({ resourceId: 'conf-x' })]}
        variant={variant}
        targetSourceId={42}
      />,
    );
    const button = screen.getByRole('button', { name: 'Resource ID 복사' });
    expect(button.className).toContain('opacity-0');
    expect(button.className).toContain('group-hover/resid:opacity-100');
  });
});
