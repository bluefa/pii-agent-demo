/**
 * Tests for `UnsavedChangesModal` (W3-b §Step 5).
 *
 * The component is fully presentational — open/close and button
 * variants are the only behaviours we can assert without a DOM
 * environment. `renderToStaticMarkup` keeps tests in the node
 * vitest env (see `vitest.config.ts`).
 */

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { UnsavedChangesModal } from '@/app/integration/admin/guides/components/UnsavedChangesModal';

const noop = (): void => undefined;

describe('UnsavedChangesModal — closed state', () => {
  it('renders nothing when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <UnsavedChangesModal isOpen={false} onConfirm={noop} onCancel={noop} />,
    );
    expect(html).toBe('');
  });
});

describe('UnsavedChangesModal — open state', () => {
  it('renders the dirty-changes copy', () => {
    const html = renderToStaticMarkup(
      <UnsavedChangesModal isOpen onConfirm={noop} onCancel={noop} />,
    );
    expect(html).toContain('저장되지 않은 변경사항');
    expect(html).toContain('이동하시겠습니까?');
  });

  it('renders both action buttons', () => {
    const html = renderToStaticMarkup(
      <UnsavedChangesModal isOpen onConfirm={noop} onCancel={noop} />,
    );
    expect(html).toContain('취소');
    expect(html).toContain('변경 폐기 후 이동');
  });

  it('confirm action uses the danger variant', () => {
    const html = renderToStaticMarkup(
      <UnsavedChangesModal isOpen onConfirm={noop} onCancel={noop} />,
    );
    // Button.tsx maps `variant="danger"` to `bg-red-600` from the
    // theme's `buttonStyles.variants.danger`.
    expect(html).toMatch(/bg-red-600[^"]*">변경 폐기 후 이동/);
  });
});
