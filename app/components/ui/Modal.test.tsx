// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Modal } from '@/app/components/ui/Modal';

/**
 * LIN-82 — the overlay centers the dialog and cannot scroll, so an uncapped box
 * with a tall body (e.g. 승인 요청 상세 with hundreds of resources) pushed the
 * header X and the footer 닫기 outside the viewport for good.
 */
describe('Modal viewport cap', () => {
  const dialogOf = (): HTMLElement => screen.getByRole('dialog');

  it('caps the dialog at the viewport and scrolls the body instead of growing', () => {
    render(
      <Modal isOpen onClose={() => {}} title="승인 요청 상세" footer={<button>닫기</button>}>
        <p>body</p>
      </Modal>,
    );

    const dialog = dialogOf();
    expect(dialog.className).toContain('max-h-[90vh]');
    expect(dialog.className).toContain('flex flex-col');

    const body = screen.getByText('body').parentElement;
    expect(body).not.toBeNull();
    expect(body?.className).toContain('overflow-y-auto');
    // Without min-h-0 the flex child refuses to shrink and overflow-y-auto never scrolls.
    expect(body?.className).toContain('min-h-0');
  });

  it('keeps the header and the footer out of the shrinking', () => {
    render(
      <Modal isOpen onClose={() => {}} title="승인 요청 상세" footer={<button>확인</button>}>
        <p>body</p>
      </Modal>,
    );

    // The header owns the title, the footer owns the action — neither may shrink
    // away when the body fills the cap.
    expect(screen.getByText('승인 요청 상세').closest('div.flex-none')).not.toBeNull();
    expect(screen.getByRole('button', { name: '확인' }).closest('div.flex-none')).not.toBeNull();
  });

  it('applies the same cap to the toss chrome', () => {
    render(
      <Modal isOpen onClose={() => {}} title="확인" chrome="toss">
        <p>body</p>
      </Modal>,
    );
    expect(dialogOf().className).toContain('max-h-[90vh]');
  });

  it('applies the cap to the bare chrome, which renders no header', () => {
    render(
      <Modal isOpen onClose={() => {}} chrome="bare" ariaLabel="확인">
        <p>body</p>
      </Modal>,
    );
    const dialog = dialogOf();
    expect(dialog.className).toContain('max-h-[90vh]');
    expect(screen.queryByRole('button', { name: '닫기' })).toBeNull();
  });
});
