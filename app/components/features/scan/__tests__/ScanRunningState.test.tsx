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
    expect(screen.getByText('스캔 완료')).toBeTruthy();
    // 체크는 dasharray 를 갖고 offset 은 기본값 0 — 모션이 꺼져도 그려진 채 남는다.
    const check = container.querySelector('path[stroke-dasharray="30"]');
    expect(check).not.toBeNull();
    expect((check as SVGPathElement).style.strokeDashoffset).toBe('');
  });

  it('완료를 라이브 리전으로도 알린다', () => {
    render(<ScanRunningState progress={100} stage="complete" />);
    const title = screen.getByText('스캔 완료');
    expect(title.getAttribute('aria-live')).toBe('polite');
  });

  it('발견 건수를 말하지 않는다 — 다음 화면의 깔때기와 단위가 다르다', () => {
    const { container } = render(<ScanRunningState progress={100} stage="complete" />);
    // 100% 표기 말고는 숫자가 없어야 한다.
    const numbers = (container.textContent ?? '').match(/\d[\d,]*/g) ?? [];
    expect(numbers).toEqual(['100']);
  });
});
