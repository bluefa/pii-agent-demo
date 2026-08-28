// @vitest-environment jsdom
/**
 * 연동 초기화 tab — the reset call and the two gates in front of it.
 *
 * The reason is what the audit log keeps, so the test asserts the exact string that
 * reaches the API rather than "was called": a trim or a stale-state bug leaves the CTA
 * enabled and the request green while the log records something the operator did not write.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const resetTargetSource = vi.fn();

vi.mock('@/app/lib/api', () => ({
  resetTargetSource: (...args: unknown[]) => resetTargetSource(...args),
}));

import { DangerTab } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/DangerTab';

const TARGET_SOURCE_ID = 1801;

const mount = () => {
  const onReset = vi.fn();
  render(<DangerTab targetSourceId={TARGET_SOURCE_ID} onReset={onReset} />);
  return { onReset };
};

const cta = (): HTMLButtonElement =>
  screen.getByRole('button', { name: '연동 상태 초기화' }) as HTMLButtonElement;

const typeReason = (reason: string): void => {
  fireEvent.change(screen.getByLabelText('초기화 사유'), { target: { value: reason } });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DangerTab', () => {
  it('사유가 비면 초기화할 수 없다', () => {
    mount();
    expect(cta().disabled).toBe(true);

    // 공백만 친 것은 쓰지 않은 것이다 — 그대로 보내면 감사 로그에 빈 사유가 남는다.
    typeReason('   ');
    expect(cta().disabled).toBe(true);

    typeReason('운영 DB 이전');
    expect(cta().disabled).toBe(false);
  });

  it('확인까지 누르면 사유와 함께 초기화를 한 번 요청하고, 화면을 다시 읽는다', async () => {
    resetTargetSource.mockResolvedValue({ success: true });
    const { onReset } = mount();

    // 앞뒤 공백을 달고 친다 — 저장되는 것은 사람이 쓴 문장이지, 그 공백까지가 아니다.
    typeReason('  운영 DB를 신규 VPC로 이전  ');
    fireEvent.click(cta());
    // 확인 대화상자가 요청 앞에 선다 — CTA 만으로는 아무것도 나가지 않는다.
    expect(resetTargetSource).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole('button', { name: '초기화' }));

    await waitFor(() => expect(onReset).toHaveBeenCalledTimes(1));
    expect(resetTargetSource).toHaveBeenCalledTimes(1);
    expect(resetTargetSource).toHaveBeenCalledWith(TARGET_SOURCE_ID, '운영 DB를 신규 VPC로 이전');
  });

  it('실패하면 화면을 다시 읽지 않는다', async () => {
    resetTargetSource.mockRejectedValue(new Error('reset failed'));
    const { onReset } = mount();

    typeReason('운영 DB 이전');
    fireEvent.click(cta());
    fireEvent.click(await screen.findByRole('button', { name: '초기화' }));

    await waitFor(() => expect(resetTargetSource).toHaveBeenCalledTimes(1));
    expect(onReset).not.toHaveBeenCalled();
  });
});
