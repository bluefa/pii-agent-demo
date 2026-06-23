// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ConfirmedResource } from '@/lib/types/resources';

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('@/app/components/ui/toast', () => ({
  useToast: () => ({
    info: vi.fn(),
    success: toastSuccess,
    error: toastError,
    warning: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

vi.mock(
  '@/app/integration/target-sources/[targetSourceId]/_components/logical-db/LogicalDbModalLoader',
  () => ({
    LogicalDbModalLoader: ({
      open,
      targetSourceId,
      resourceName,
      onSaved,
      onError,
      onClose,
    }: {
      open: boolean;
      targetSourceId: number;
      resourceName: string;
      onSaved: () => void;
      onError: () => void;
      onClose: () => void;
    }) =>
      open ? (
        <div data-testid="modal-loader">
          <span data-testid="modal-resource">{resourceName}</span>
          <span data-testid="modal-tsid">{targetSourceId}</span>
          <button type="button" onClick={onSaved}>
            fire-saved
          </button>
          <button type="button" onClick={onError}>
            fire-error
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

const retrySpy = vi.fn();

vi.mock(
  '@/app/integration/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider',
  () => ({
    useConfirmedIntegration: () => ({ targetSourceId: 1020, state: currentState, retry: retrySpy }),
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

  it('opens the modal loader with the resource name + targetSourceId when the row CTA is clicked', () => {
    currentState = { status: 'ready', data: [sampleResource] };
    render(<LogicalDbSlot />);
    fireEvent.click(screen.getByRole('button', { name: '논리 DB 확인' }));
    expect(screen.getByTestId('modal-loader')).toBeTruthy();
    expect(screen.getByTestId('modal-resource').textContent).toBe('sea-live-space-prod');
    expect(screen.getByTestId('modal-tsid').textContent).toBe('1020');
  });

  it('fires a success toast + retry + close when the save completes', () => {
    currentState = { status: 'ready', data: [sampleResource] };
    toastSuccess.mockClear();
    retrySpy.mockClear();
    render(<LogicalDbSlot />);
    fireEvent.click(screen.getByRole('button', { name: '논리 DB 확인' }));
    fireEvent.click(screen.getByText('fire-saved'));
    expect(toastSuccess).toHaveBeenCalledWith('논리 DB 제외 정책을 저장했습니다.');
    expect(retrySpy).toHaveBeenCalled();
    expect(screen.queryByTestId('modal-loader')).toBeNull();
  });

  it('fires an error toast (modal stays open) when the save fails', () => {
    currentState = { status: 'ready', data: [sampleResource] };
    toastError.mockClear();
    render(<LogicalDbSlot />);
    fireEvent.click(screen.getByRole('button', { name: '논리 DB 확인' }));
    fireEvent.click(screen.getByText('fire-error'));
    expect(toastError).toHaveBeenCalledWith('논리 DB 제외 정책 저장에 실패했습니다.');
    expect(screen.getByTestId('modal-loader')).toBeTruthy();
  });

  it('closes the modal silently when cancel runs', () => {
    currentState = { status: 'ready', data: [sampleResource] };
    toastSuccess.mockClear();
    render(<LogicalDbSlot />);
    fireEvent.click(screen.getByRole('button', { name: '논리 DB 확인' }));
    fireEvent.click(screen.getByText('fire-close'));
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(screen.queryByTestId('modal-loader')).toBeNull();
  });
});
