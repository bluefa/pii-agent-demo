// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScanStrip, type ScanStripProps } from '@/app/components/features/scan/ScanStrip';

const successJob: ScanStripProps['job'] = {
  id: 1,
  scan_status: 'SUCCESS',
  updated_at: '2026-07-31T05:00:00Z',
  duration_seconds: 32.4,
  resource_count_by_resource_type: { RDS: 7, S3: 2 },
};

const permissionFailJob: ScanStripProps['job'] = {
  id: 2,
  scan_status: 'FAIL',
  updated_at: '2026-07-31T05:00:00Z',
  scan_error: 'AUTH_PERMISSION_ERROR',
};

const baseProps: Omit<ScanStripProps, 'job'> = {
  newCount: 0,
  permission: { status: 'idle' },
  onCheckPermission: () => {},
  onOpenHistory: () => {},
  onStartScan: () => {},
  showScanButton: true,
  scanDisabled: false,
  starting: false,
};

describe('ScanStrip', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-31T05:03:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('summarizes the last successful scan with relative age, duration and found count', () => {
    render(<ScanStrip {...baseProps} job={successJob} newCount={2} />);
    expect(screen.getByText('마지막 스캔 3분 전')).toBeTruthy();
    expect(screen.getByText(/32초 소요 · 9개 발견 · 신규 2/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '다시 스캔' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '스캔 이력' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '권한 확인' })).toBeTruthy();
  });

  it('derives the permission-error badge from a failed scan (no standing green badge)', () => {
    render(<ScanStrip {...baseProps} job={permissionFailJob} />);
    expect(screen.getByText('마지막 스캔 실패 3분 전')).toBeTruthy();
    expect(screen.getByText('스캔 권한 오류 — 설정 확인 필요')).toBeTruthy();
    // idle permission renders nothing — a months-old verification must not look like assurance.
    expect(screen.queryByText(/권한 확인됨/)).toBeNull();
  });

  it('hides the scan button when the failed body owns the retry CTA', () => {
    render(<ScanStrip {...baseProps} job={permissionFailJob} showScanButton={false} />);
    expect(screen.queryByRole('button', { name: '다시 스캔' })).toBeNull();
  });

  // job == null: a list exists but no finished scan does (mock seed / lost history).
  // The strip stays as the only scan entry point and says so honestly.
  it('renders the no-record fallback when no finished job exists', () => {
    render(<ScanStrip {...baseProps} job={null} />);
    expect(screen.getByText('아직 스캔한 적이 없어요')).toBeTruthy();
    expect(screen.getByRole('button', { name: '스캔 시작' })).toBeTruthy();
    expect(screen.queryByText(/마지막 스캔/)).toBeNull();
  });

  it('renders the timestamped verification result and wires the two ghost actions', () => {
    const onOpenHistory = vi.fn();
    const onCheckPermission = vi.fn();
    render(
      <ScanStrip
        {...baseProps}
        job={successJob}
        permission={{ status: 'ok', checkedAt: '2026-07-31T05:02:30Z' }}
        onOpenHistory={onOpenHistory}
        onCheckPermission={onCheckPermission}
      />,
    );
    expect(screen.getByText(/권한 확인됨 · 방금 전/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '스캔 이력' }));
    expect(onOpenHistory).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '권한 확인' }));
    expect(onCheckPermission).toHaveBeenCalledTimes(1);
  });
});
