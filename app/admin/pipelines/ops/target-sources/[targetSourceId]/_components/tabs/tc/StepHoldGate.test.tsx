// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StepHoldGate } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/StepHoldGate';
import type { StepHoldView } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/stepHold';

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

  it('요건문 · 태그 · 열린 버튼 — 그게 전부다', () => {
    const { onRequestApproval } = renderGate({
      state: 'unmet',
      tag: { tone: 'warn', label: '재실행 요청됨' },
      canRequest: true,
      blockedHint: null,
    });
    const region = screen.getByRole('region', { name: '5단계 종료 조건' });
    // 마크의 낱말(svg title)까지 포함한 전체 텍스트 — 이 밖에 아무것도 없다.
    expect(region.textContent).toBe('미충족승인 요청을 눌러야 5단계 이상으로 진입합니다재실행 요청됨승인 요청');
    fireEvent.click(screen.getByRole('button', { name: '승인 요청' }));
    expect(onRequestApproval).toHaveBeenCalledTimes(1);
  });

  it('전제가 안 서면 버튼은 사유를 든 채 잠긴다 — 눌러도 아무 일 없다', () => {
    const { onRequestApproval } = renderGate({
      state: 'unmet',
      tag: { tone: 'off', label: '실행 없음' },
      canRequest: false,
      blockedHint: '연결 테스트가 성공해야 승인 요청을 보낼 수 있습니다',
    });
    const button = screen.getByRole('button', { name: '승인 요청' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(button);
    expect(onRequestApproval).not.toHaveBeenCalled();
  });

  it('요청됐으면 버튼이 없다', () => {
    renderGate({ state: 'ok', tag: { tone: 'ok', label: '승인 요청됨' }, canRequest: false, blockedHint: null });
    expect(screen.queryByRole('button', { name: '승인 요청' })).toBeNull();
    expect(screen.getByTitle('충족')).toBeTruthy();
  });

  it('조회 중에는 상태를 읽어 주고 버튼이 없다', () => {
    renderGate({ state: 'loading', canRequest: false, blockedHint: null });
    expect(screen.getByRole('status', { name: '확인 중' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '승인 요청' })).toBeNull();
  });
});
