// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Pagination, buildVisiblePages } from '@/app/components/ui/Pagination';

describe('buildVisiblePages', () => {
  it('returns the full range when total <= 7', () => {
    expect(buildVisiblePages(0, 5)).toEqual([0, 1, 2, 3, 4]);
    expect(buildVisiblePages(3, 7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('collapses the middle with ellipses when total > 7', () => {
    expect(buildVisiblePages(0, 20)).toEqual([0, 1, '…', 19]);
    expect(buildVisiblePages(10, 20)).toEqual([0, '…', 9, 10, 11, '…', 19]);
    expect(buildVisiblePages(19, 20)).toEqual([0, '…', 18, 19]);
  });
});

describe('Pagination', () => {
  const renderPagination = (overrides: Partial<React.ComponentProps<typeof Pagination>> = {}) => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();
    const utils = render(
      <Pagination
        page={overrides.page ?? 0}
        pageSize={overrides.pageSize ?? 10}
        totalCount={overrides.totalCount ?? 100}
        onPageChange={overrides.onPageChange ?? onPageChange}
        onPageSizeChange={overrides.onPageSizeChange ?? onPageSizeChange}
      />,
    );
    return { ...utils, onPageChange, onPageSizeChange };
  };

  it('calls onPageChange with the clicked page index (v15 numbered buttons only)', () => {
    const { onPageChange } = renderPagination({ page: 5, pageSize: 10, totalCount: 100 });

    fireEvent.click(screen.getByLabelText('1 페이지'));
    expect(onPageChange).toHaveBeenLastCalledWith(0);

    fireEvent.click(screen.getByLabelText('10 페이지'));
    expect(onPageChange).toHaveBeenLastCalledWith(9);
  });

  it('marks the current page button with aria-current="page"', () => {
    renderPagination({ page: 2, pageSize: 10, totalCount: 100 });
    const currentPageBtn = screen.getByRole('button', { current: 'page' });
    expect(currentPageBtn.textContent).toBe('3');
  });

  it('calls onPageSizeChange when changing the size select', () => {
    const { onPageSizeChange } = renderPagination({ page: 0, pageSize: 10, totalCount: 100 });
    fireEvent.change(screen.getByLabelText('페이지당 표시 건수'), { target: { value: '50' } });
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it('renders 0–0 range when totalCount is 0', () => {
    renderPagination({ page: 0, pageSize: 10, totalCount: 0 });
    expect(screen.getByText(/0–0/)).toBeTruthy();
  });

  it('renders prev/next only by default — no first/last double-chevrons', () => {
    renderPagination({ page: 1, pageSize: 10, totalCount: 100 });
    expect(screen.getByLabelText('이전 페이지')).toBeTruthy();
    expect(screen.getByLabelText('다음 페이지')).toBeTruthy();
    expect(screen.queryByLabelText('처음 페이지')).toBeNull();
    expect(screen.queryByLabelText('끝 페이지')).toBeNull();
  });

  it('restores the first/last double-chevrons with controls="full"', () => {
    render(
      <Pagination
        page={1}
        pageSize={10}
        totalCount={100}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        controls="full"
      />,
    );
    expect(screen.getByLabelText('처음 페이지')).toBeTruthy();
    expect(screen.getByLabelText('끝 페이지')).toBeTruthy();
  });

  // 끝 페이지는 double-chevron 없이도 한 번에 닿는다 — `buildVisiblePages` 가 마지막
  // 인덱스를 항상 그리기 때문이다. 이게 무너지면 기본값에서 그 버튼을 뺀 결정도 무너진다.
  it('keeps the last page one click away without the 끝 페이지 button', () => {
    const { onPageChange } = renderPagination({ page: 0, pageSize: 10, totalCount: 200 });
    fireEvent.click(screen.getByLabelText('20 페이지'));
    expect(onPageChange).toHaveBeenLastCalledWith(19);
  });

  // 비활성은 투명도가 아니라 색이어야 한다 — `opacity-35` 는 이 바 위에서 1.89:1 이었다.
  it('dims a disabled edge control with a colour, never opacity', () => {
    renderPagination({ page: 0, pageSize: 10, totalCount: 100 });
    const prev = screen.getByLabelText('이전 페이지');
    expect(prev.className).not.toMatch(/opacity-/);
    expect(prev.className).toContain('disabled:text-[var(--pl-text-weak)]');
  });

  // 셀렉트 화살표는 브라우저가 그린다. `appearance-none` 이 다시 붙으면 커스텀 화살표가
  // 있어야 하는데, 그 커스텀 화살표(data-URI)는 Tailwind v4 에서 컴파일되지 않아
  // 아무것도 그려지지 않았다 — 화살표 없는 55px 상자가 그렇게 나왔다.
  it('leaves the page-size select on its native arrow', () => {
    renderPagination({ page: 0, pageSize: 10, totalCount: 100 });
    const select = screen.getByLabelText('페이지당 표시 건수');
    expect(select.className).not.toContain('appearance-none');
  });
});
