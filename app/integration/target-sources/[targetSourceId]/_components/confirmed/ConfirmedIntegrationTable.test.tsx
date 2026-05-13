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
    it('renders pre-install columns: 리소스 ID / 유형 / DB 타입 / Credential', () => {
      render(
        <ConfirmedIntegrationTable confirmed={[makeResource()]} />,
      );
      expect(screen.getByText('리소스 ID')).toBeTruthy();
      expect(screen.getByText('유형')).toBeTruthy();
      expect(screen.getByText('DB 타입')).toBeTruthy();
      expect(screen.getByText('Credential')).toBeTruthy();
    });

    it('does not render Status, 연동 대상 논리 DB, 연동 제외 논리 DB columns', () => {
      render(<ConfirmedIntegrationTable confirmed={[makeResource()]} />);
      expect(screen.queryByText('Status')).toBeNull();
      expect(screen.queryByText('연동 대상 논리 DB')).toBeNull();
      expect(screen.queryByText('연동 제외 논리 DB')).toBeNull();
    });
  });

  describe('variant=complete', () => {
    it('renders Status + logical DB columns', () => {
      render(
        <ConfirmedIntegrationTable
          confirmed={[makeResource()]}
          variant="complete"
        />,
      );
      expect(screen.getByText('DB Type')).toBeTruthy();
      expect(screen.getByText('Resource ID')).toBeTruthy();
      expect(screen.getByText('DB Credential')).toBeTruthy();
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

    it('renders — placeholder for both logical DB count cells', () => {
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
      // cells: DB Type / Resource ID / DB Credential / target logical DB / excluded logical DB / Status
      expect(cellTexts[3]).toBe('—');
      expect(cellTexts[4]).toBe('—');
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
    const button = screen.getByRole('button', { name: 'conf-x 복사' });
    expect(button.className).toContain('opacity-0');
    expect(button.className).toContain('group-hover:opacity-100');
  });
});
