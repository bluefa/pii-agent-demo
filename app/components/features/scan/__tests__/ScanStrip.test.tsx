// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScanStrip, type ScanFunnelCounts, type ScanStripProps } from '@/app/components/features/scan/ScanStrip';

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

  it('summarizes the last successful scan with relative age and duration', () => {
    render(<ScanStrip {...baseProps} job={successJob} newCount={2} />);
    expect(screen.getByText('마지막 스캔 3분 전')).toBeTruthy();
    // The scanned-resource total appears nowhere: it is in a different unit from the
    // DB count below, so side by side it only creates an unanswerable gap.
    expect(screen.getByText(/32초 소요 · 신규 2/)).toBeTruthy();
    expect(screen.queryByText(/개 발견/)).toBeNull();
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

  // The scan band is explicitly SEPARATE from the resource table: it always keeps its
  // own bordered frame and never takes the table-toolbar surface.
  it('always renders as a standalone bordered band', () => {
    const { container } = render(<ScanStrip {...baseProps} job={successJob} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('rounded-xl');
    expect(root.className).toContain('border');
    expect(root.className).not.toContain('rounded-t-[12px]');
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

const baseFunnel: ScanFunnelCounts = {
  eligible: 12,
  selected: 5,
  excluded: 7,
  missingReasons: 0,
  filter: 'all',
  onFilterChange: () => {},
};

describe('ScanStrip funnel row', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-31T05:03:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // The three cells speak one unit (candidate DBs) and selected + excluded ===
  // eligible. The scan's discovery total (~100k) is out of this row entirely: two
  // units at the same size on one line read as a comparison that has no answer.
  it('reports the three same-unit counts and no discovery total', () => {
    render(<ScanStrip {...baseProps} job={successJob} newCount={3} funnel={baseFunnel} />);
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.queryByText('107,873')).toBeNull();
    expect(screen.queryByText(/스캔 발견/)).toBeNull();
    // The eligible cell reports a count only — no delta against the previous scan.
    expect(screen.queryByText('+3')).toBeNull();
  });

  // The counts now live in the cells; repeating them in the meta line would make
  // the band state the same number twice.
  it('drops the found/new counts from the meta line when the funnel carries them', () => {
    render(<ScanStrip {...baseProps} job={successJob} newCount={2} funnel={baseFunnel} />);
    expect(screen.getByText(/32초 소요/)).toBeTruthy();
    expect(screen.queryByText(/개 발견/)).toBeNull();
    expect(screen.queryByText(/신규 2/)).toBeNull();
  });

  // A funnel needs a scan behind it. With no scan on record the cells would
  // report a result that does not exist, and would push the one true fact —
  // "아직 스캔한 적이 없어요" — below them.
  it('suppresses the funnel entirely when no scan is on record', () => {
    render(<ScanStrip {...baseProps} job={null} funnel={baseFunnel} />);
    expect(screen.getByText('아직 스캔한 적이 없어요')).toBeTruthy();
    expect(screen.queryByText('연동 가능 DB')).toBeNull();
    expect(screen.queryByRole('button', { name: /선택함/ })).toBeNull();
    expect(screen.getByRole('button', { name: '스캔 시작' })).toBeTruthy();
  });

  // A finished-but-failed scan keeps the three counts — the list below is the
  // previous scan's, so those rows (and their numbers) are still real.
  it('keeps the counts on a finished-but-failed scan', () => {
    render(<ScanStrip {...baseProps} job={permissionFailJob} funnel={baseFunnel} />);
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('스캔 권한 오류 — 설정 확인 필요')).toBeTruthy();
  });

  it('surfaces the blocking missing-reason count on the excluded cell', () => {
    const { rerender } = render(<ScanStrip {...baseProps} job={successJob} funnel={baseFunnel} />);
    expect(screen.queryByText(/사유 .*건 미입력/)).toBeNull();
    rerender(<ScanStrip {...baseProps} job={successJob} funnel={{ ...baseFunnel, missingReasons: 3 }} />);
    expect(screen.getByText('사유 3건 미입력')).toBeTruthy();
  });

  it('filters the table from the selected/excluded cells and toggles back off', () => {
    const onFilterChange = vi.fn();
    const { rerender } = render(
      <ScanStrip {...baseProps} job={successJob} funnel={{ ...baseFunnel, onFilterChange }} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /선택함/ }));
    expect(onFilterChange).toHaveBeenLastCalledWith('target');
    fireEvent.click(screen.getByRole('button', { name: /제외함/ }));
    expect(onFilterChange).toHaveBeenLastCalledWith('excluded');

    // Pressing the active cell clears the filter — the only way back to 'all'.
    rerender(
      <ScanStrip {...baseProps} job={successJob} funnel={{ ...baseFunnel, filter: 'target', onFilterChange }} />,
    );
    const selectedCell = screen.getByRole('button', { name: /선택함/ });
    expect(selectedCell.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(selectedCell);
    expect(onFilterChange).toHaveBeenLastCalledWith('all');
  });

  // The reporting cell must not look interactive: the eligible count is the table's
  // total (= the 'all' state), not a filter of its own.
  it('keeps the reporting cell out of the tab order', () => {
    render(<ScanStrip {...baseProps} job={successJob} funnel={baseFunnel} />);
    expect(screen.queryByRole('button', { name: /연동 가능 DB/ })).toBeNull();
  });
});
