// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import type { ConfirmedResource } from '@/lib/types/resources';
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
  it('renders empty-state message when no resources are passed', () => {
    render(<ConfirmedIntegrationTable confirmed={[]} />);
    expect(screen.getByText('확정된 연동 대상 DB 가 없습니다.')).toBeTruthy();
  });

  describe('variant=pre-install (default)', () => {
    it('renders the 6 v15 columns: Database Type / Resource ID / Region / Resource Name / DB Credential / Connection Status', () => {
      render(
        <ConfirmedIntegrationTable confirmed={[makeResource()]} />,
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
        />,
      );
      expect(screen.getByText('ap-northeast-1')).toBeTruthy();
      expect(screen.getByText('sea-live-space-prod')).toBeTruthy();
    });

    it('renders Connection Status as "-" (not fabricated) — no test-connection result on this step', () => {
      const { container } = render(<ConfirmedIntegrationTable confirmed={[makeResource()]} />);
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

    it('does not render Status, 연동 대상 논리 DB, 연동 제외 논리 DB columns', () => {
      render(<ConfirmedIntegrationTable confirmed={[makeResource()]} />);
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
        />,
      );
      expect(screen.queryByText('유형')).toBeNull();
    });

    it('renders Healthy badge for CONNECTED rows', () => {
      render(
        <ConfirmedIntegrationTable
          confirmed={[makeResource({ connectionStatus: 'CONNECTED' })]}
          variant="complete"
        />,
      );
      expect(screen.getByText('Healthy')).toBeTruthy();
    });

    it('renders Unhealthy badge for DISCONNECTED rows', () => {
      render(
        <ConfirmedIntegrationTable
          confirmed={[makeResource({ connectionStatus: 'DISCONNECTED' })]}
          variant="complete"
        />,
      );
      expect(screen.getByText('Unhealthy')).toBeTruthy();
    });

    it('renders real (non-dash) logical DB counts derived from resourceId', () => {
      const { container } = render(
        <ConfirmedIntegrationTable
          confirmed={[makeResource()]}
          variant="complete"
        />,
      );
      const dataRow = container.querySelector('tbody tr');
      if (!(dataRow instanceof HTMLElement)) throw new Error('expected data row');
      const cellTexts = Array.from(within(dataRow).getAllByRole('cell')).map(
        (cell) => cell.textContent,
      );
      // cells: Database Type / Resource ID / Region / Resource Name / DB Credential
      //        / target logical DB / excluded logical DB / Status
      expect(cellTexts[5]).toMatch(/^\d+$/);
      expect(cellTexts[6]).toMatch(/^\d+$/);
      expect(cellTexts[5]).not.toBe('—');
      expect(cellTexts[6]).not.toBe('—');
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
      />,
    );
    const button = screen.getByRole('button', { name: 'Resource ID 복사' });
    expect(button.className).toContain('opacity-0');
    expect(button.className).toContain('group-hover/resid:opacity-100');
  });
});
