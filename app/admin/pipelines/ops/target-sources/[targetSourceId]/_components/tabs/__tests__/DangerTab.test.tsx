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

const mount = (isSdu = false) => {
  const onReset = vi.fn();
  render(<DangerTab targetSourceId={TARGET_SOURCE_ID} isSdu={isSdu} onReset={onReset} />);
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

/**
 * 초기화가 **무엇을 버리는가**는 대상 종류가 정한다(계약 §8).
 *
 * SDU 에서 reset 은 업로드 상태(확인 답변 · 수신자 · BDC 진행)만 버리고 **연동 대상 정의는
 * 남긴다.** 계약이 이유까지 적어 두었다 — 초기화는 담당자를 1단계로 돌려보내는데, 1단계가
 * 바로 그 정의를 고치는 자리라 지우면 외워서 다시 칠 빈 화면을 주게 된다.
 *
 * 이 축이 있는 이유는 여기가 **되돌릴 수 없는 동작의 마지막 확인**이기 때문이다. 사라지지
 * 않는 것을 사라진다고 적으면 관리자는 눌러야 할 버튼을 누르지 않거나, 오지 않을 손실에
 * 대비한다. 그리고 SDU 에는 지울 승인이 없다(§0).
 */
const openConfirm = (): void => {
  typeReason('운영 DB 이전');
  fireEvent.click(cta());
};

describe('DangerTab — 초기화가 버리는 것 (§8)', () => {
  it('SDU 는 무엇이 사라지는지와 정의가 남는다는 것을 함께 말한다', async () => {
    mount(true);

    const discarded = screen.getByText(/담당자 확인 답변과 S3 Access Key 수신자, BDC 진행이 사라집니다/);
    expect(discarded).toBeTruthy();
    // 남는다는 말이 없으면 관리자는 담당자에게 빈 화면을 준다고 믿는다.
    expect(screen.getByText(/연동 대상 정의는 남습니다/)).toBeTruthy();

    openConfirm();
    // 마지막 확인도 둘 다 말한다 — 안내를 읽지 않고 여기까지 온 사람에게는 이 한 줄이
    // 전부다. 그리고 이 경로에는 승인이 없다(§0).
    const confirm = await screen.findByText(
      '이 Target Source는 1단계로 돌아가고, 담당자 확인 답변과 S3 Access Key 수신자, BDC 진행이 사라집니다. 연동 대상 정의는 남습니다.',
    );
    expect(confirm.textContent).not.toContain('승인');
    expect(document.body.textContent).not.toContain('연동 대상 DB 선택부터 다시 진행합니다');
  });

  it('SDU 가 아닌 대상의 문장은 한 글자도 달라지지 않는다', async () => {
    mount(false);

    // 전수 비교다 — 「승인」 하나만 확인하면 다른 줄이 조용히 바뀌어도 통과한다.
    expect(
      screen.getByText(
        '초기화하면 이 Target Source는 1단계로 돌아가, 연동 대상 DB 선택부터 다시 진행합니다.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('확정 정보 삭제나 Terraform 제거 같은 사전 작업은 필요하지 않습니다.'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        '서비스 담당자의 요청이 있거나, 연동을 반드시 처음부터 다시 해야 하는 경우에만 수행하세요.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/연동 대상 정의는 남습니다/)).toBeNull();

    openConfirm();
    expect(
      await screen.findByText(
        '이 Target Source는 1단계로 돌아가고, 이미 끝난 설치와 승인은 모두 사라집니다.',
      ),
    ).toBeTruthy();
  });
});
