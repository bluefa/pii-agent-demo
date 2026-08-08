/**
 * Tests for `ServiceMoveConfirmModal`.
 *
 * The component is presentational. We assert:
 *   - closed state renders nothing
 *   - open state renders title, body copy, both action buttons
 *   - the destination block carries serviceName and serviceCode verbatim
 *   - with no name the code becomes the name line and is not also tagged
 */

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { ServiceMoveConfirmModal } from '@/app/target-sources/[targetSourceId]/_components/ServiceMoveConfirmModal';

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
    // Neutral on which service: the sidebar's current-service row opens this too.
    expect(html).toContain('서비스 인프라 목록으로 이동할까요?');
    expect(html).toContain('SVC-001');
    expect(html).toContain('Sample Service');
    expect(html).toContain('아래 서비스의 인프라 목록으로 이동합니다.');
    expect(html).toContain('머무르기');
    expect(html).toContain('이동하기');
  });

  it('drops the code tag when there is no name — the code is then the name line', () => {
    const html = renderToStaticMarkup(
      <ServiceMoveConfirmModal
        isOpen
        onClose={noop}
        onConfirm={noop}
        serviceCode="SVC-001"
        serviceName=""
      />,
    );
    // Once as the name line, and not a second time as its own tag.
    expect(html.match(/SVC-001/g)).toHaveLength(1);
  });
});
