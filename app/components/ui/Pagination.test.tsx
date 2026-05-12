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

  it('disables First/Prev on page 0', () => {
    renderPagination({ page: 0, pageSize: 10, totalCount: 100 });
    expect(screen.getByLabelText('처음 페이지').hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('이전 페이지').hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('다음 페이지').hasAttribute('disabled')).toBe(false);
    expect(screen.getByLabelText('끝 페이지').hasAttribute('disabled')).toBe(false);
  });

  it('disables Next/Last on the last page', () => {
    renderPagination({ page: 9, pageSize: 10, totalCount: 100 });
    expect(screen.getByLabelText('처음 페이지').hasAttribute('disabled')).toBe(false);
    expect(screen.getByLabelText('이전 페이지').hasAttribute('disabled')).toBe(false);
    expect(screen.getByLabelText('다음 페이지').hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('끝 페이지').hasAttribute('disabled')).toBe(true);
  });

  it('calls onPageChange with the expected index for each navigation button', () => {
    const { onPageChange } = renderPagination({ page: 5, pageSize: 10, totalCount: 100 });

    fireEvent.click(screen.getByLabelText('처음 페이지'));
    expect(onPageChange).toHaveBeenLastCalledWith(0);

    fireEvent.click(screen.getByLabelText('이전 페이지'));
    expect(onPageChange).toHaveBeenLastCalledWith(4);

    fireEvent.click(screen.getByLabelText('다음 페이지'));
    expect(onPageChange).toHaveBeenLastCalledWith(6);

    fireEvent.click(screen.getByLabelText('끝 페이지'));
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
});
