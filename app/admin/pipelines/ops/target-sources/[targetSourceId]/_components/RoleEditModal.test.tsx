// @vitest-environment jsdom
/**
 * Role 폼이 여는 자리는 둘이다 — 헤더 「계정 정보」 묶음 머리(주체 전부)와 스캔 탭의
 * 자격 증명 카드(판정이 떨어진 하나). 같은 폼이 절의 수만 달리 선다.
 *
 * 트립와이어는 **이름이 바뀐 절만 PUT** 이다: 안 건드린 Role 까지 쓰면 그 주체의 검증
 * 판정이 이유 없이 초기화된다.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { RoleEditModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/RoleEditModal';

const updateAwsRole = vi.fn();
vi.mock('@/app/lib/api/ops', () => ({
  updateAwsRole: (...args: unknown[]) => updateAwsRole(...args),
}));

const onSaved = vi.fn();
const onClose = vi.fn();

const ACCOUNT = '804656952396';
const arn = (name: string): string => `arn:aws:iam::${ACCOUNT}:role/${name}`;

const open = (over: Partial<Parameters<typeof RoleEditModal>[0]> = {}): void => {
  render(
    <RoleEditModal
      open
      onClose={onClose}
      targetSourceId={1008}
      kinds={['scan', 'execution']}
      currentArns={{ scan: arn('BDCPIIInfraScanRole'), execution: arn('tf-worker') }}
      accountId={ACCOUNT}
      isChinaRegion={false}
      regionLabel="Global"
      onSaved={onSaved}
      {...over}
    />,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  updateAwsRole.mockImplementation(async (_id: number, _kind: string, roleArn: string) => ({
    roleArn,
  }));
});

describe('RoleEditModal', () => {
  it('주체 하나면 그 이름이 제목이 된다 (스캔 탭 진입)', () => {
    open({ kinds: ['scan'] });
    expect(screen.getByText('Scan Role 등록/수정')).toBeTruthy();
    expect(screen.queryByText('Terraform Execution Role 이름')).toBeNull();
  });

  it('주체가 여럿이면 절이 그만큼 서고 제목은 중립이 된다', () => {
    open();
    expect(screen.getByText('Role 등록/수정')).toBeTruthy();
    expect(screen.getByLabelText(/Scan Role 이름/)).toBeTruthy();
    expect(screen.getByLabelText(/Terraform Execution Role 이름/)).toBeTruthy();
  });

  it('등록된 이름으로 열린다 — 빈 입력으로 열면 덮어쓰기 사고가 된다', () => {
    open();
    expect((screen.getByLabelText(/Scan Role 이름/) as HTMLInputElement).value).toBe(
      'BDCPIIInfraScanRole',
    );
  });

  it('아무것도 안 바꾸면 저장이 잠겨 있다', () => {
    open();
    expect(screen.getByRole('button', { name: '저장' }).hasAttribute('disabled')).toBe(true);
  });

  it('한 절만 바꾸면 그 kind 만 PUT 한다', async () => {
    open();
    fireEvent.change(screen.getByLabelText(/Terraform Execution Role 이름/), {
      target: { value: 'tf-worker-v2' },
    });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    // 호출 수는 **끝난 뒤에** 센다 — waitFor 로 1 을 기다리면 두 번째 PUT 이 나가기
    // 직전에 통과해, "안 바뀐 절도 쓴다" 는 회귀를 그대로 지나친다.
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updateAwsRole).toHaveBeenCalledTimes(1);
    expect(updateAwsRole).toHaveBeenCalledWith(1008, 'execution', arn('tf-worker-v2'));
    expect(onSaved).toHaveBeenCalledWith('execution', arn('tf-worker-v2'));
  });

  it('둘 다 바꾸면 둘 다 PUT 하고 닫는다', async () => {
    open();
    fireEvent.change(screen.getByLabelText(/Scan Role 이름/), { target: { value: 'scan-v2' } });
    fireEvent.change(screen.getByLabelText(/Terraform Execution Role 이름/), {
      target: { value: 'tf-v2' },
    });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(updateAwsRole).toHaveBeenCalledTimes(2));
    expect(onClose).toHaveBeenCalled();
  });

  it('잘못된 이름은 어느 절인지 말하고 PUT 하지 않는다', async () => {
    open();
    fireEvent.change(screen.getByLabelText(/Scan Role 이름/), { target: { value: 'bad name!' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Scan Role:');
    expect(updateAwsRole).not.toHaveBeenCalled();
  });

  it('뒤 절이 실패하면 앞 절은 저장됐다고 말한다', async () => {
    updateAwsRole.mockImplementationOnce(async (_i: number, _k: string, a: string) => ({
      roleArn: a,
    }));
    updateAwsRole.mockImplementationOnce(async () => {
      throw new Error('boom');
    });
    open();
    fireEvent.change(screen.getByLabelText(/Scan Role 이름/), { target: { value: 'scan-v2' } });
    fireEvent.change(screen.getByLabelText(/Terraform Execution Role 이름/), {
      target: { value: 'tf-v2' },
    });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Scan Role은(는) 저장했지만');
    expect(alert.textContent).toContain('Terraform Execution Role');
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('계정 ID 가 없으면 진짜 원인을 말한다', async () => {
    open({ accountId: '', currentArns: {} });
    fireEvent.change(screen.getByLabelText(/Scan Role 이름/), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('AWS 계정 ID가 없어');
    expect(updateAwsRole).not.toHaveBeenCalled();
  });
});
