/**
 * Tests for `ServiceMoveConfirmModal`.
 *
 * The component is presentational. We assert:
 *   - closed state renders nothing
 *   - open state renders title, body copy, both action buttons
 */

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { ServiceMoveConfirmModal } from '@/app/target-sources/[targetSourceId]/_components/ServiceMoveConfirmModal';

const noop = (): void => undefined;

describe('ServiceMoveConfirmModal — closed state', () => {
  it('renders nothing when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <ServiceMoveConfirmModal isOpen={false} onClose={noop} onConfirm={noop} />,
    );
    expect(html).toBe('');
  });
});

describe('ServiceMoveConfirmModal — open state', () => {
  it('renders the title, body copy and action buttons', () => {
    const html = renderToStaticMarkup(
      <ServiceMoveConfirmModal isOpen onClose={noop} onConfirm={noop} />,
    );
    // Neutral on which service: the sidebar's current-service row opens this too.
    expect(html).toContain('서비스 인프라 목록으로 이동할까요?');
    expect(html).toContain('선택한 서비스의 인프라 목록으로 이동합니다.');
    expect(html).toContain('머무르기');
    expect(html).toContain('이동하기');
  });
});
