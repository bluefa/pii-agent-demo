// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { serviceSidebarStyles } from '@/lib/theme';
import { SidebarPagination } from '@/app/components/features/admin/ServiceSidebar/SidebarPagination';

const page = (number: number, totalPages: number) => ({
  totalElements: totalPages * 12,
  totalPages,
  number,
  size: 12,
});

const arrow = (root: HTMLElement, label: string) =>
  root.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;

describe('SidebarPagination', () => {
  it('renders nothing at a single page', () => {
    const { container } = render(
      <SidebarPagination pageInfo={page(0, 1)} onPageChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('disables the arrow that has nowhere to go', () => {
    // unmount 없이 두 번 render 하면 두 트리가 같은 body 에 남아 라벨이 중복된다 —
    // 이 저장소에는 RTL auto-cleanup 셋업 파일이 없다.
    const first = render(<SidebarPagination pageInfo={page(0, 3)} onPageChange={vi.fn()} />);
    expect(arrow(first.container, '이전 페이지').disabled).toBe(true);
    expect(arrow(first.container, '다음 페이지').disabled).toBe(false);
    first.unmount();

    const last = render(<SidebarPagination pageInfo={page(2, 3)} onPageChange={vi.fn()} />);
    expect(arrow(last.container, '다음 페이지').disabled).toBe(true);
    expect(arrow(last.container, '이전 페이지').disabled).toBe(false);
    last.unmount();
  });

  /**
   * 오너 지시(2026-08-11): 이 푸터의 모든 치수를 +2px.
   *
   * 한 덩어리로 고정하는 이유는, 이 값들이 서로에 대해서만 의미가 있기 때문이다 —
   * 버튼만 26px 로 키우고 화살표를 12px 로 두면 글리프가 자기 판 안에서 헐거워지고,
   * 글자만 14px 로 올리면 24px 버튼보다 커진다. 하나가 움직이면 전부 움직여야 한다.
   */
  it('holds the +2px footer scale as one set', () => {
    expect(serviceSidebarStyles.footer).toContain('gap-1.5'); // 4 → 6
    expect(serviceSidebarStyles.footer).toContain('px-3.5'); // 12 → 14
    expect(serviceSidebarStyles.footer).toContain('py-3'); // 10 → 12
    expect(serviceSidebarStyles.footerPage).toContain('px-1.5'); // 4 → 6
    expect(serviceSidebarStyles.footerPage).toContain('text-[14px]'); // 12 → 14
    expect(serviceSidebarStyles.pagerBtn).toContain('h-[26px]'); // 24 → 26
    expect(serviceSidebarStyles.pagerBtn).toContain('w-[26px]');
    expect(serviceSidebarStyles.pagerBtn).toContain('rounded-[6px]'); // 4 → 6

    // 화살표는 토큰이 아니라 컴포넌트가 들고 있으므로 렌더로 확인한다.
    const view = render(<SidebarPagination pageInfo={page(1, 3)} onPageChange={vi.fn()} />);
    for (const label of ['이전 페이지', '다음 페이지']) {
      const svg = arrow(view.container, label).querySelector('svg');
      expect(svg?.getAttribute('width')).toBe('14'); // 12 → 14
      expect(svg?.getAttribute('height')).toBe('14');
    }
    view.unmount();
  });

  /** 홀수 px 직접 선언 금지 — 램프는 짝수로만 움직인다. */
  it('lands every bumped value on an even pixel', () => {
    const declared = [
      serviceSidebarStyles.footer,
      serviceSidebarStyles.footerPage,
      serviceSidebarStyles.pagerBtn,
    ].join(' ');
    for (const [, px] of declared.matchAll(/\[(\d+)px\]/g)) {
      expect(Number(px) % 2, `${px}px is odd`).toBe(0);
    }
  });
});
