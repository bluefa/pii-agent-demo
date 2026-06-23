// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ConfirmedResource } from '@/lib/types/resources';

const toastInfo = vi.fn();

vi.mock('@/app/components/ui/toast', () => ({
  useToast: () => ({
    info: toastInfo,
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

vi.mock(
  '@/app/integration/target-sources/[targetSourceId]/_components/logical-db/LogicalDbModalLoader',
  () => ({
    LogicalDbModalLoader: ({
      open,
      resourceName,
      onSave,
      onClose,
    }: {
      open: boolean;
      resourceName: string;
      onSave: () => void;
      onClose: () => void;
    }) =>
      open ? (
        <div data-testid="modal-loader">
          <span data-testid="modal-resource">{resourceName}</span>
          <button type="button" onClick={onSave}>
            fire-save
          </button>
          <button type="button" onClick={onClose}>
            fire-close
          </button>
        </div>
      ) : null,
  }),
);

let currentState: { status: 'ready'; data: ConfirmedResource[] } | { status: 'loading' } | { status: 'error'; message: string } = {
  status: 'ready',
  data: [],
};

vi.mock(
  '@/app/integration/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider',
  () => ({
    useConfirmedIntegration: () => ({ state: currentState, retry: vi.fn() }),
  }),
);

import { LogicalDbSlot } from '@/app/integration/target-sources/[targetSourceId]/_components/logical-db/LogicalDbSlot';

const sampleResource: ConfirmedResource = {
  resourceId: 'sea-live-space-prod',
  type: 'azure-mysql',
  databaseType: 'MYSQL',
  region: 'ap-northeast-1',
  resourceName: 'sea-live-space-prod',
  host: '10.0.0.1',
  port: 3306,
  oracleServiceId: null,
  networkInterfaceId: null,
  ipConfigurationName: null,
  credentialId: 'cred-1',
  connectionStatus: 'CONNECTED',
};

describe('LogicalDbSlot', () => {
  it('renders nothing when there are no confirmed resources', () => {
    currentState = { status: 'ready', data: [] };
    const { container } = render(<LogicalDbSlot />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the underlying data is still loading', () => {
    currentState = { status: 'loading' };
    const { container } = render(<LogicalDbSlot />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a per-row "논리 DB 확인" trigger for each confirmed resource', () => {
    currentState = { status: 'ready', data: [sampleResource] };
    render(<LogicalDbSlot />);
    expect(screen.getByText('sea-live-space-prod')).toBeTruthy();
    expect(screen.getByRole('button', { name: '논리 DB 확인' })).toBeTruthy();
  });

  it('opens the modal loader with the resource name when the row CTA is clicked', () => {
    currentState = { status: 'ready', data: [sampleResource] };
    render(<LogicalDbSlot />);
    fireEvent.click(screen.getByRole('button', { name: '논리 DB 확인' }));
    expect(screen.getByTestId('modal-loader')).toBeTruthy();
    expect(screen.getByTestId('modal-resource').textContent).toBe('sea-live-space-prod');
  });

  it('fires a toast.info when the modal save action runs', () => {
    currentState = { status: 'ready', data: [sampleResource] };
    toastInfo.mockClear();
    render(<LogicalDbSlot />);
    fireEvent.click(screen.getByRole('button', { name: '논리 DB 확인' }));
    fireEvent.click(screen.getByText('fire-save'));
    expect(toastInfo).toHaveBeenCalledWith(
      '논리 DB 정보 저장은 BFF 연동 후 활성화됩니다.',
    );
  });

  it('closes the modal silently when cancel runs', () => {
    currentState = { status: 'ready', data: [sampleResource] };
    toastInfo.mockClear();
    render(<LogicalDbSlot />);
    fireEvent.click(screen.getByRole('button', { name: '논리 DB 확인' }));
    fireEvent.click(screen.getByText('fire-close'));
    expect(toastInfo).not.toHaveBeenCalled();
    expect(screen.queryByTestId('modal-loader')).toBeNull();
  });
});
