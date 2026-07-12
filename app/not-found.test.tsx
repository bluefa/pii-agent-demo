// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import NotFound from '@/app/not-found';

describe('NotFound', () => {
  it('renders the Korean 404 copy', () => {
    render(<NotFound />);
    expect(screen.getByText('페이지를 찾을 수 없습니다')).toBeTruthy();
    expect(screen.getByText('주소가 잘못되었거나 삭제된 페이지입니다.')).toBeTruthy();
  });

  it('links back to the service list (basePath applied at runtime)', () => {
    render(<NotFound />);
    const link = screen.getByRole('link', { name: '서비스 목록으로 이동' });
    expect(link.getAttribute('href')).toBe('/services');
  });
});
