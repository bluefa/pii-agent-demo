// @vitest-environment jsdom
/**
 * 「대상 설정」 폼 — 설치모드 + 실데이터가 한 폼에 서고, **바뀐 것만** PUT 된다.
 *
 * 두 값은 엔드포인트가 다르므로 한 번에 저장할 수 없다. 안 건드린 값까지 쓰면 실패했을
 * 때 무엇이 되돌아갔는지 말할 수 없고 감사 로그에도 없던 변경이 남는다 — 그 규칙이
 * 이 파일의 트립와이어다.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { TargetSettingsModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/TargetSettingsModal';

const updateInstallationMode = vi.fn();
const updateTargetSourceDoesSupportRaw = vi.fn();

vi.mock('@/app/lib/api/ops', () => ({
  updateInstallationMode: (...args: unknown[]) => updateInstallationMode(...args),
  updateTargetSourceDoesSupportRaw: (...args: unknown[]) =>
    updateTargetSourceDoesSupportRaw(...args),
}));

const onSaved = vi.fn();
const onClose = vi.fn();

const open = (over: Partial<Parameters<typeof TargetSettingsModal>[0]> = {}): void => {
  render(
    <TargetSettingsModal
      open
      onClose={onClose}
      targetSourceId={1008}
      showInstallMode
      currentGrant
      currentRaw={false}
      onSaved={onSaved}
      {...over}
    />,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  updateInstallationMode.mockResolvedValue({
    target_source_id: 1008,
    grant_service_terraform_execution_permission: false,
  });
  updateTargetSourceDoesSupportRaw.mockResolvedValue(undefined);
});

describe('TargetSettingsModal', () => {
  it('AWS 는 두 절, 그 밖은 실데이터 한 절', () => {
    open();
    expect(screen.getByText('설치모드')).toBeTruthy();
    expect(screen.getByText('실데이터 여부')).toBeTruthy();
  });

  it('설치모드가 없는 프로바이더는 그 절이 통째로 빠진다', () => {
    open({ showInstallMode: false });
    expect(screen.queryByText('설치모드')).toBeNull();
    expect(screen.getByText('실데이터 여부')).toBeTruthy();
  });

  it('아무것도 안 바꾸면 저장이 잠겨 있다', () => {
    open();
    expect(screen.getByRole('button', { name: '변경' }).hasAttribute('disabled')).toBe(true);
  });

  it('실데이터만 바꾸면 설치모드는 PUT 하지 않는다', async () => {
    open();
    fireEvent.click(screen.getByText('실데이터 포함'));
    fireEvent.click(screen.getByRole('button', { name: '변경' }));
    await waitFor(() =>
      expect(updateTargetSourceDoesSupportRaw).toHaveBeenCalledWith(1008, true),
    );
    expect(updateInstallationMode).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith({ raw: true });
  });

  it('설치모드만 바꾸면 실데이터는 PUT 하지 않는다', async () => {
    open();
    fireEvent.click(screen.getByText('수동 설치'));
    fireEvent.click(screen.getByRole('button', { name: '변경' }));
    await waitFor(() => expect(updateInstallationMode).toHaveBeenCalledWith(1008, false));
    expect(updateTargetSourceDoesSupportRaw).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith({ grant: false });
  });

  it('둘 다 바꾸면 둘 다 PUT 하고 한 번에 알린다', async () => {
    open();
    fireEvent.click(screen.getByText('수동 설치'));
    fireEvent.click(screen.getByText('실데이터 포함'));
    fireEvent.click(screen.getByRole('button', { name: '변경' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ grant: false, raw: true }));
    expect(updateInstallationMode).toHaveBeenCalledTimes(1);
    expect(updateTargetSourceDoesSupportRaw).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  it('뒤엣것이 실패하면 앞엣것이 저장됐다고 말한다', async () => {
    updateTargetSourceDoesSupportRaw.mockRejectedValue(new Error('boom'));
    open();
    fireEvent.click(screen.getByText('수동 설치'));
    fireEvent.click(screen.getByText('실데이터 포함'));
    fireEvent.click(screen.getByRole('button', { name: '변경' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('설치모드는 저장했지만');
    // 성공한 쪽은 화면이 이미 반영해야 한다 — 안 그러면 다시 눌러 같은 값을 또 쓴다.
    expect(onSaved).toHaveBeenCalledWith({ grant: false });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('현재 값이 응답에 없으면 그 사실을 적고, 고르기 전에는 저장이 잠긴다', () => {
    open({ currentRaw: undefined });
    expect(screen.getByText('지금 값이 응답에 없습니다. 고른 값으로 새로 설정합니다.')).toBeTruthy();
    expect(screen.getByRole('button', { name: '변경' }).hasAttribute('disabled')).toBe(true);
  });
});
