// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApprovalRequestLatestResponse } from '@/app/lib/api';

vi.mock('@/app/lib/api', () => ({
  getApprovalRequestLatest: vi.fn(),
  cancelApprovalRequest: vi.fn(),
}));

import { getApprovalRequestLatest } from '@/app/lib/api';
import { ApprovalApplyingBanner } from '@/app/components/features/process-status/ApprovalApplyingBanner';
import { ApprovalWaitingCard } from '@/app/components/features/process-status/ApprovalWaitingCard';

const latestResponse: ApprovalRequestLatestResponse = {
  request: {
    id: 42,
    target_source_id: 1002,
    status: 'APPROVED',
    requested_by: { user_id: 'requester' },
    requested_at: '2026-04-30T01:00:00.000Z',
    resource_total_count: 3,
    resource_selected_count: 2,
  },
  result: {
    request_id: 42,
    status: 'APPROVED',
    processed_by: { user_id: 'admin' },
    processed_at: '2026-04-30T01:10:00.000Z',
    reason: null,
  },
};

const getApprovalRequestLatestMock = vi.mocked(getApprovalRequestLatest);

describe('Approval summary hydration guard', () => {
  beforeEach(() => {
    getApprovalRequestLatestMock.mockReset();
    getApprovalRequestLatestMock.mockResolvedValue(latestResponse);
  });

  it('server-renders the applying summary button disabled', () => {
    const html = renderToStaticMarkup(<ApprovalApplyingBanner targetSourceId={1002} />);

    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>승인 요약 보기<\/button>/);
  });

  it('enables the applying summary button after hydration and latest response load', async () => {
    render(<ApprovalApplyingBanner targetSourceId={1002} />);

    const button = screen.getByRole('button', { name: '승인 요약 보기' });
    expect(button.hasAttribute('disabled')).toBe(true);

    await waitFor(() => {
      expect(button.hasAttribute('disabled')).toBe(false);
    });
  });

  it('server-renders the waiting summary button disabled', () => {
    const html = renderToStaticMarkup(
      <ApprovalWaitingCard targetSourceId={1002} onCancelSuccess={() => {}} />,
    );

    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>요청 요약 보기<\/button>/);
  });
});
