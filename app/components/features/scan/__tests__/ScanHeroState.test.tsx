// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScanHeroState, type ScanHeroStateProps } from '@/app/components/features/scan/ScanHeroState';

const baseProps: ScanHeroStateProps = {
  provider: 'GCP',
  permission: { status: 'idle' },
  onCheckPermission: () => {},
  onStartScan: () => {},
  canStart: true,
  starting: false,
};

describe('ScanHeroState', () => {
  it('makes 스캔 시작 the primary CTA and names the provider credential', () => {
    const onStartScan = vi.fn();
    render(<ScanHeroState {...baseProps} onStartScan={onStartScan} />);
    expect(screen.getByText('아직 스캔한 적이 없어요')).toBeTruthy();
    expect(screen.getByText(/스캔하면 연결된 GCP 계정의 DB 리소스를 조회해요/)).toBeTruthy();
    // Provider-specific credential label — the UI names what it actually verifies.
    expect(screen.getByText('Scan Service Account')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /스캔 시작/ }));
    expect(onStartScan).toHaveBeenCalledTimes(1);
  });

  it('prints the scan principal under its kind, and drops the line when absent', () => {
    const principal = 'pii-agent-scan@pii-agent-prod-12345.iam.gserviceaccount.com';
    const { rerender } = render(<ScanHeroState {...baseProps} scanPrincipal={principal} />);
    expect(screen.getByText(principal)).toBeTruthy();
    // 계약이 키를 안 실으면 종류 줄까지만 — 빈 자리를 만들지 않는다.
    rerender(<ScanHeroState {...baseProps} />);
    expect(screen.queryByText(principal)).toBeNull();
    expect(screen.getByText('Scan Service Account')).toBeTruthy();
  });

  it('runs the permission preflight on demand', () => {
    const onCheckPermission = vi.fn();
    render(<ScanHeroState {...baseProps} onCheckPermission={onCheckPermission} />);
    fireEvent.click(screen.getByRole('button', { name: '지금 확인하기' }));
    expect(onCheckPermission).toHaveBeenCalledTimes(1);
  });

  it('shows the failure message with a re-check entry and never blocks the scan CTA', () => {
    render(
      <ScanHeroState
        {...baseProps}
        permission={{ status: 'fail', message: '권한을 확인하지 못했어요. 가이드 문서를 참고해 설정을 점검해주세요.' }}
      />,
    );
    expect(screen.getByText(/권한을 확인하지 못했어요/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '다시 확인' })).toBeTruthy();
    const scanButton = screen.getByRole('button', { name: /스캔 시작/ });
    expect((scanButton as HTMLButtonElement).disabled).toBe(false);
  });
});
