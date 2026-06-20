// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { EmptyState } from '@/app/components/ui/state/EmptyState';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="대상이 없어요" description="연동 대상을 추가해주세요." />);
    expect(screen.getByText('대상이 없어요')).toBeTruthy();
    expect(screen.getByText('연동 대상을 추가해주세요.')).toBeTruthy();
  });

  it('renders the action slot', () => {
    render(<EmptyState title="비어 있음" action={<button type="button">추가</button>} />);
    expect(screen.getByRole('button', { name: '추가' })).toBeTruthy();
  });

  it('renders the inline variant', () => {
    render(<EmptyState variant="inline" title="없음" />);
    expect(screen.getByText('없음')).toBeTruthy();
  });
});
