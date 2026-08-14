// @vitest-environment jsdom
/**
 * 승인·반려·권한 요청 모달은 몸통(`TextModal`) 하나를 나눠 쓴다. 그 몸통이 문구 말고
 * 실제로 다르게 굴어야 하는 축은 하나뿐이다 — **사유가 필수인가.** 셋이 따로 쓰여 있을
 * 때는 각자 자기 CTA 를 잠갔고, 합친 지금은 `required` 하나가 그 일을 한다. 여기서 그
 * 축을 세 모달 모두에 대해 박아 둔다: 하나라도 플래그가 어긋나면 필수 사유 없이 반려가
 * 나가거나, 메시지 없는 승인이 막힌다.
 */
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';

import {
  ApproveAccessModal,
  RejectAccessModal,
  RequestAccessModal,
} from '@/app/admin/pipelines/access/_components/AccessModals';

const noop = async (): Promise<void> => {};

const cta = (label: string): HTMLButtonElement =>
  screen.getByRole('button', { name: label }) as HTMLButtonElement;

describe('AccessModals — 필수 사유가 CTA 를 잠근다', () => {
  it('승인 메시지는 선택이라 비어 있어도 승인할 수 있다', () => {
    render(<ApproveAccessModal open onClose={noop} subject="김철수님의 AWS 접근 요청" onSubmit={noop} />);
    expect(cta('승인').disabled).toBe(false);
  });

  it('반려 사유는 필수라 비어 있으면 반려할 수 없다', () => {
    render(<RejectAccessModal open onClose={noop} subject="김철수님의 AWS 접근 요청" onSubmit={noop} />);
    expect(cta('반려').disabled).toBe(true);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '권한 범위가 과해요' } });
    expect(cta('반려').disabled).toBe(false);

    // 공백만으로는 사유가 되지 않는다.
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
    expect(cta('반려').disabled).toBe(true);
  });

  it('요청 사유도 필수다', () => {
    render(
      <RequestAccessModal
        open
        onClose={noop}
        serviceCode="SVC-A"
        serviceName="결제"
        onSubmit={noop}
      />,
    );
    expect(cta('요청').disabled).toBe(true);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '정산 대사 업무' } });
    expect(cta('요청').disabled).toBe(false);
  });
});

/**
 * 두 번째 축 — **입력 상한.** 요청 사유만 500 이다(승인 시트의 고정 높이 칸에서 읽히는
 * 글이라서). 셋이 한 몸통을 쓰므로 기본값을 500 으로 내리면 승인 메시지·반려 사유까지
 * 조용히 따라 내려간다 — 그쪽은 요청자에게 통째로 전달되는 글이라 잘리면 안 된다.
 */
describe('AccessModals — 입력 상한', () => {
  const box = (): HTMLTextAreaElement => screen.getByRole('textbox') as HTMLTextAreaElement;

  it('요청 사유는 500자까지다', () => {
    render(
      <RequestAccessModal
        open
        onClose={noop}
        serviceCode="SVC-A"
        serviceName="결제"
        onSubmit={noop}
      />,
    );
    expect(box().maxLength).toBe(500);
  });

  it('승인 메시지와 반려 사유는 1000자 그대로다', () => {
    const { unmount } = render(
      <ApproveAccessModal open onClose={noop} subject="김철수님의 AWS 접근 요청" onSubmit={noop} />,
    );
    expect(box().maxLength).toBe(1000);
    unmount();

    render(
      <RejectAccessModal open onClose={noop} subject="김철수님의 AWS 접근 요청" onSubmit={noop} />,
    );
    expect(box().maxLength).toBe(1000);
  });
});
