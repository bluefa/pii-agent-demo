/**
 * Tests for `ServiceMoveConfirmModal`.
 *
 * The component is presentational. We assert:
 *   - closed state renders nothing
 *   - open state renders title, body copy, both action buttons
 *   - body interpolates serviceCode / serviceName verbatim
 */

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { ServiceMoveConfirmModal } from '@/app/integration/target-sources/[targetSourceId]/_components/ServiceMoveConfirmModal';

const noop = (): void => undefined;

describe('ServiceMoveConfirmModal — closed state', () => {
  it('renders nothing when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <ServiceMoveConfirmModal
        isOpen={false}
        onClose={noop}
        onConfirm={noop}
        serviceCode="SVC-001"
        serviceName="Sample Service"
      />,
    );
    expect(html).toBe('');
  });
});

describe('ServiceMoveConfirmModal — open state', () => {
  it('renders the title, action buttons and the interpolated body copy', () => {
    const html = renderToStaticMarkup(
      <ServiceMoveConfirmModal
        isOpen
        onClose={noop}
        onConfirm={noop}
        serviceCode="SVC-001"
        serviceName="Sample Service"
      />,
    );
    expect(html).toContain('서비스 이동 확인');
    expect(html).toContain('SVC-001');
    expect(html).toContain('Sample Service');
    expect(html).toContain('서비스 관리 페이지로 이동하시겠습니까?');
    expect(html).toContain('취소');
    expect(html).toContain('이동');
  });
});
