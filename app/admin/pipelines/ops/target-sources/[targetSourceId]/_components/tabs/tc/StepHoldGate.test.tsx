// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StepHoldGate } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/StepHoldGate';
import type { StepHoldView } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/stepHold';

const REJECTED: StepHoldView = {
  turn: '지금은 서비스 담당자 차례입니다.',
  run: { state: 'ok', facts: [{ label: '완료', value: '26.06.01 09:04' }] },
  ack: {
    state: 'unmet',
    tag: { tone: 'warn', label: '재실행 요청됨' },
    facts: [
      { label: '재실행 요청', value: '26.07.19 14:52' },
      { label: '사유', value: 'NLB 리스너 미반영 여부 확인 후 재실행 요청' },
      { value: '서비스 담당자가 연결 테스트를 다시 실행하고 승인 요청을 누르면 6단계로 넘어갑니다.' },
    ],
  },
};

describe('StepHoldGate', () => {
  it('view 가 null 이면 아무것도 그리지 않는다', () => {
    const { container } = render(<StepHoldGate view={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('두 요건문 · 상태 태그 · 반려 사유 · 차례가 화면에 선다', () => {
    render(<StepHoldGate view={REJECTED} />);
    const text = screen.getByRole('region', { name: '5단계 종료 조건' }).textContent ?? '';
    expect(text).toContain('최신 연결 테스트 결과가 성공이어야 합니다');
    expect(text).toContain('서비스 담당자가 승인 요청을 눌러야 합니다');
    expect(text).toContain('재실행 요청됨');
    expect(text).toContain('NLB 리스너 미반영 여부 확인 후 재실행 요청');
    expect(text).toContain('지금은 서비스 담당자 차례입니다.');
    // 마크는 색이 아니라 낱말로도 판정을 말한다.
    expect(screen.getByTitle('충족')).toBeTruthy();
    expect(screen.getByTitle('미충족')).toBeTruthy();
  });

  it('조회 중에는 근거 자리를 스켈레톤으로 잡고 상태를 읽어 준다', () => {
    render(
      <StepHoldGate
        view={{ turn: null, run: { state: 'loading', facts: [] }, ack: { state: 'loading', facts: [] } }}
      />,
    );
    expect(screen.getAllByRole('status', { name: '확인 중' })).toHaveLength(2);
    expect(screen.queryByText('지금은 서비스 담당자 차례입니다.')).toBeNull();
  });
});
