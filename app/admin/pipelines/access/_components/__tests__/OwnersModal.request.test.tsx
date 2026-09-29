// @vitest-environment jsdom
/**
 * The request footer belongs to the requestable tab only — a service the viewer already has
 * gets the read-only modal (header X, no footer).
 *
 * This repo has no RTL auto-cleanup — every render unmounts itself.
 */
import { fireEvent, render, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { OwnersModal } from '@/app/admin/pipelines/access/_components/AccessModals';

const open = (onRequest?: () => void) =>
  render(
    <OwnersModal
      open
      onClose={() => {}}
      serviceCode="DLV"
      serviceName="배송 물류"
      owners={['minsu.park']}
      ownerCount={1}
      onRequest={onRequest}
    />,
  );

describe('담당자 모달의 권한 요청 footer', () => {
  it('onRequest 가 없으면 권한 요청 버튼이 없다', () => {
    const { baseElement, unmount } = open();
    expect(within(baseElement).queryByRole('button', { name: '권한 요청' })).toBeNull();
    unmount();
  });

  it('onRequest 가 있으면 권한 요청 버튼이 그것을 부른다', () => {
    const onRequest = vi.fn();
    const { baseElement, unmount } = open(onRequest);
    fireEvent.click(within(baseElement).getByRole('button', { name: '권한 요청' }));
    expect(onRequest).toHaveBeenCalledTimes(1);
    unmount();
  });
});
