// @vitest-environment jsdom
/**
 * 사이드바 — Jira Ticket 항목과 그 배지(티켓 실패 + watcher 실패의 합). 운영 알림 배지는
 * 그대로다: 두 수는 그쪽에 더해지지 않는다.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { passRoutes } from '@/lib/routes';

vi.mock('next/navigation', () => ({ usePathname: () => '/admin/pipelines/ops/jira' }));
vi.mock('@/app/lib/api/task-queue', () => ({
  getDashboardSummary: vi.fn().mockResolvedValue({
    pendingApprovalCount: 0,
    rejectedApprovalCount: 0,
    recentlyCreatedCount: 0,
    confirmingCount: 1,
    needInstallCount: 0,
    needTestConnectionCount: 0,
    needPiiAgentConfirmCount: 0,
    jiraTicketFailedCount: 4,
    jiraWatcherFailedCount: 2,
  }),
}));
vi.mock('@/app/lib/api/access', () => ({
  getAccessRequests: vi.fn().mockResolvedValue({ totalElements: 0 }),
}));

import PipelinesLayout from '@/app/admin/pipelines/layout';

describe('PipelinesLayout — Jira Ticket 항목', () => {
  it('운영 콘솔 그룹에 서고, 배지는 두 실패 수의 합이다', async () => {
    render(<PipelinesLayout>child</PipelinesLayout>);
    const item = screen.getByRole('link', { name: /Jira Ticket/ });
    expect(item.getAttribute('href')).toBe(passRoutes.pipelines.ops.jira);
    expect(item.getAttribute('aria-current')).toBe('page');

    await waitFor(() =>
      expect(screen.getByRole('status', { name: '조치가 필요한 Jira 티켓 6건' }).textContent).toBe('6'),
    );
    // 운영 알림 배지는 자기 네 버킷만 센다.
    expect(screen.getByRole('status', { name: '조치가 필요한 대상 1건' }).textContent).toBe('1');
  });
});
