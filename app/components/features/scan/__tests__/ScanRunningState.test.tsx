// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScanRunningState } from '@/app/components/features/scan/ScanRunningState';

const bar = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('div[style*="width"]');

describe('ScanRunningState', () => {
  it('스캔 중에는 진행률을 그대로 그린다', () => {
    render(<ScanRunningState progress={72} stage="scanning" />);
    expect(screen.getByText('인프라 스캔 진행중입니다')).toBeTruthy();
    expect(screen.getByText('72%')).toBeTruthy();
    expect(bar()?.style.width).toBe('72%');
  });

  it('집계 구간은 바를 가득 채우고 남은 일을 말한다', () => {
    render(<ScanRunningState progress={100} stage="finalizing" />);
    expect(screen.getByText('스캔 마무리 중이에요')).toBeTruthy();
    expect(screen.getByText(/결과를 집계하고 있어요/)).toBeTruthy();
    expect(bar()?.style.width).toBe('100%');
  });

  it('완료 프레임은 같은 골격 위에서 체크와 완료 문구만 바꾼다', () => {
    const { container } = render(<ScanRunningState progress={40} stage="complete" />);

    // 넘겨받은 progress 와 무관하게 가득 — 이 시점의 진행률은 정보가 아니다.
    expect(bar()?.style.width).toBe('100%');
    expect(screen.getByText('인프라 스캔이 끝났어요')).toBeTruthy();
    // 체크는 dasharray 를 갖고 offset 은 기본값 0 — 모션이 꺼져도 그려진 채 남는다.
    const check = container.querySelector('path[stroke-dasharray="30"]');
    expect(check).not.toBeNull();
    expect((check as SVGPathElement).style.strokeDashoffset).toBe('');
  });

  // 라이브 리전은 이 컴포넌트가 아니라 카드 본문에 상주한다(프레임보다 오래 살아야
  // 목록 도착을 알릴 수 있다) — 여기서는 진행률이 보조기술에 노출되는지만 본다.
  it('진행률을 progressbar 로 노출한다', () => {
    render(<ScanRunningState progress={72} stage="scanning" />);
    const track = screen.getByRole('progressbar', { name: '인프라 스캔 진행률' });
    expect(track.getAttribute('aria-valuenow')).toBe('72');

    // 라이브 리전을 이 안에 다시 들이면 카드 본문의 리전과 이중으로 낭독된다.
    expect(document.querySelector('[aria-live]')).toBeNull();
  });

  it('발견 건수를 말하지 않는다 — 다음 화면의 깔때기와 단위가 다르다', () => {
    const { container } = render(<ScanRunningState progress={100} stage="complete" />);
    // 금지 대상은 "숫자"가 아니라 "발견 건수"다 — 백분율 라벨을 빼는 건 얼마든지
    // 있을 수 있는 디자인 변경이므로, 세는 게 아니라 건수 표기 자체를 짚는다.
    expect(container.textContent).not.toMatch(/\d[\d,]*\s*개/);
    // 0건으로 끝나는 스캔에도 지킬 수 있는 약속만 한다.
    expect(screen.getByText('잠시 후 결과를 보여드릴게요.')).toBeTruthy();
  });

  it('집계 구간은 아직 체크가 아니라 휠이다', () => {
    const { container } = render(<ScanRunningState progress={100} stage="finalizing" />);
    expect(container.querySelector('path[stroke-dasharray="30"]')).toBeNull();
    expect(container.querySelector('.animate-spin')).not.toBeNull();
  });

  it('모션은 사용자 설정을 따른다', () => {
    const { container: running } = render(<ScanRunningState progress={40} stage="scanning" />);
    // 휠은 모션을 끈 사용자에게 멈춰 선다(그래도 타일과 색은 남는다).
    expect(running.querySelector('.animate-spin')?.className).toContain('motion-reduce:animate-none');

    const { container: done } = render(<ScanRunningState progress={100} stage="complete" />);
    // 체크 드로우는 motion-safe 에서만 재생되고, offset 기본값 0 덕에 꺼져도 그려진다.
    expect(done.querySelector('path[stroke-dasharray="30"]')?.getAttribute('class'))
      .toContain('scan-check-draw');
  });
});
