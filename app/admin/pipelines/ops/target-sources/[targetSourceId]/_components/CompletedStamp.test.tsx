// @vitest-environment jsdom
/**
 * 도장은 **최초 1회** 연동을 마쳤다고 선언한다 — 그래서 값이 없을 때 무엇을 그리느냐가
 * 이 컴포넌트의 전부다. 여기서 지키는 것은 둘이다:
 *
 *   1. 값이 없으면 침묵한다. 없다는 것은 "아직 안 됐다"가 아니라 "기록이 없다"이고,
 *      둘을 같은 픽셀로 그리면 화면이 없는 사실을 말하게 된다.
 *   2. 자리는 값과 무관하게 잡힌다. 도장이 있는 행과 없는 행에서 카드의 다른 값이
 *      다른 폭으로 잘리면, 잘림이 대상의 성질이 아니라 도장의 부작용이 된다.
 *
 * 시각 표기도 함께 잡는다: 도장에 들어가는 것은 날짜지 인스턴트가 아니다.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import {
  CompletedStamp,
  CompletedStampSlot,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/CompletedStamp';

const LABEL = '최초 1회 연동 완료';

describe('CompletedStamp', () => {
  it('시각이 아니라 날짜를 찍는다 (Asia/Seoul)', () => {
    render(<CompletedStamp firstInstalledAt="2026-07-13T19:40:00Z" />);
    // UTC 19:40 은 서울 기준 다음 날이다 — 도장이 KST 로 접히는지까지 본다.
    expect(screen.getByText('2026-07-14')).toBeTruthy();
    expect(screen.getByText(LABEL)).toBeTruthy();
  });

  it('전문은 title 로 남는다 — 분까지 필요한 사람이 있다', () => {
    const { container } = render(<CompletedStamp firstInstalledAt="2026-07-13T19:40:00Z" />);
    expect(container.querySelector('[title]')?.getAttribute('title')).toContain(LABEL);
    expect(container.querySelector('[title]')?.getAttribute('title')).toMatch(/2026-07-14/);
  });

  it('기록이 없으면 아무것도 그리지 않는다 — 미완료라고 쓰지 않는다', () => {
    for (const value of [null, undefined, '']) {
      const { container } = render(<CompletedStamp firstInstalledAt={value} />);
      expect(container.textContent).toBe('');
    }
  });
});

describe('CompletedStampSlot', () => {
  it('reserve 면 기록이 없어도 자리는 그대로다', () => {
    const withStamp = render(<CompletedStampSlot firstInstalledAt="2026-06-15T16:47:00Z" reserve />);
    expect(withStamp.container.querySelector('.w-\\[160px\\]')).toBeTruthy();
    expect(screen.getByText('2026-06-16')).toBeTruthy();

    // 값이 없는 행도 같은 폭을 차지해야 옆 칸이 행마다 다른 자리에서 잘리지 않는다.
    const without = render(<CompletedStampSlot firstInstalledAt={null} reserve />);
    expect(without.container.querySelector('.w-\\[160px\\]')).toBeTruthy();
    expect(without.container.textContent).toBe('');
  });

  it('reserve 가 아니면 기록이 없을 때 자리도 없다', () => {
    const { container } = render(<CompletedStampSlot firstInstalledAt={null} />);
    expect(container.innerHTML).toBe('');
  });
});
