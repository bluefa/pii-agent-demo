// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IdcTargetFormModal } from '@/app/target-sources/[targetSourceId]/_components/idc/modals/IdcTargetFormModal';

vi.mock('@/app/components/ui/Modal', () => ({
  Modal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const setup = () => {
  render(<IdcTargetFormModal isOpen onSubmit={vi.fn()} onClose={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Database Type'), { target: { value: 'MySQL' } });
  return screen.getByPlaceholderText('예: 3306');
};

describe('IdcTargetFormModal web port warning', () => {
  it('warns when a common web server port is typed, naming the DB default', () => {
    const port = setup();
    fireEvent.change(port, { target: { value: '8080' } });
    expect(screen.getByText(/8080 은 웹 서버 포트일 수 있어요/).textContent).toContain('MySQL 기본 포트는 3306');
  });

  it('stays quiet for the default port and for a custom non-web port', () => {
    const port = setup();
    expect(screen.queryByText(/웹 서버 포트/)).toBeNull();
    fireEvent.change(port, { target: { value: '3307' } });
    expect(screen.queryByText(/웹 서버 포트/)).toBeNull();
  });
});
