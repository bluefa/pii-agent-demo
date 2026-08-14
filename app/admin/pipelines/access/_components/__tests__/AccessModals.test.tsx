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
