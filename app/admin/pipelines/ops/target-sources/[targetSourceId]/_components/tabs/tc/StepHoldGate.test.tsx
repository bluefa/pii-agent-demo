// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StepHoldGate } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/StepHoldGate';
import type { StepHoldView } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/stepHold';

const REJECTED: StepHoldView = {
  turn: '지금은 서비스 담당자 차례입니다.',
  state: 'unmet',
  tag: { tone: 'warn', label: '재실행 요청됨' },
  facts: [
    { label: '완료', value: '26.06.01 09:04' },
    { label: '재실행 요청', value: '26.07.19 14:52' },
    { label: '사유', value: 'NLB 리스너 미반영 여부 확인 후 재실행 요청' },
    { value: '서비스 담당자가 연결 테스트를 다시 실행하고 승인 요청을 누르면 6단계로 넘어갑니다.' },
  ],
  canRequest: true,
};

const renderGate = (view: StepHoldView | null, over: { requesting?: boolean } = {}) => {
  const onRequestApproval = vi.fn();
  const utils = render(
    <StepHoldGate view={view} onRequestApproval={onRequestApproval} requesting={over.requesting ?? false} />,
  );
  return { ...utils, onRequestApproval };
};

describe('StepHoldGate', () => {
  it('view 가 null 이면 아무것도 그리지 않는다', () => {
    const { container } = renderGate(null);
    expect(container.innerHTML).toBe('');
  });

  it('요건문 · 상태 태그 · 반려 사유 · 차례가 화면에 서고, 관리자가 승인 요청을 누를 수 있다', () => {
    const { onRequestApproval } = renderGate(REJECTED);
    const text = screen.getByRole('region', { name: '5단계 종료 조건' }).textContent ?? '';
    expect(text).toContain('승인 요청을 눌러야 5단계 이상으로 진입합니다');
    expect(text).toContain('재실행 요청됨');
    expect(text).toContain('NLB 리스너 미반영 여부 확인 후 재실행 요청');
    expect(text).toContain('지금은 서비스 담당자 차례입니다.');
    // 마크는 색이 아니라 낱말로도 판정을 말한다.
    expect(screen.getByTitle('미충족')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '승인 요청' }));
    expect(onRequestApproval).toHaveBeenCalledTimes(1);
  });

  it('전제가 안 서면 버튼은 사유를 든 채 잠긴다 — 눌러도 아무 일 없다', () => {
    const { onRequestApproval } = renderGate({
      turn: '지금은 서비스 담당자 차례입니다.',
      state: 'unmet',
      tag: { tone: 'off', label: '실행 없음' },
      facts: [{ value: '서비스 담당자가 5단계에서 연결 테스트를 실행하고 승인 요청을 눌러야 합니다.' }],
      canRequest: false,
    });
    const button = screen.getByRole('button', { name: '승인 요청' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(button);
    expect(onRequestApproval).not.toHaveBeenCalled();
  });

  it('요청됐으면 버튼이 없다', () => {
    renderGate({
      turn: '단계 반영을 기다리고 있습니다.',
      state: 'ok',
      tag: { tone: 'ok', label: '승인 요청됨' },
      facts: [{ label: '요청', value: '26.06.01 10:00' }],
      canRequest: false,
    });
    expect(screen.queryByRole('button', { name: '승인 요청' })).toBeNull();
    expect(screen.getByTitle('충족')).toBeTruthy();
  });

  it('조회 중에는 근거 자리를 스켈레톤으로 잡고 상태를 읽어 준다', () => {
    renderGate({ turn: null, state: 'loading', facts: [], canRequest: false });
    expect(screen.getByRole('status', { name: '확인 중' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '승인 요청' })).toBeNull();
  });
});
