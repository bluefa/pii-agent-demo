// @vitest-environment jsdom
/**
 * 홉 하나짜리 회귀 — `serviceWork` 가 `TargetPipelineSections` 를 **통과해** 카드에 닿는가.
 *
 * 판정(`installGate.test.ts`)도 상자(`ServiceWorkNotice.test.tsx`)도 자리
 * (`CurrentPipelineCard.test.tsx`)도 각자 테스트가 있지만, 셋 다 이 컴포넌트를 건너뛴다.
 * prop 이 optional 이라 중간에서 넘겨주는 것을 잊어도 타입은 통과하고, 그때 화면에서
 * 사라지는 것은 경고 전부다 — 값은 마지막 홉까지 살아야 전달된 것이다.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TargetPipelineSections } from '@/app/admin/pipelines/_detail/TargetPipelineSections';
import type { ServiceWorkNoticeData } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/ServiceWorkNotice';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/admin/pipelines/ops/target-sources/1006',
}));

vi.mock('@/app/admin/pipelines/_components/usePlToast', () => ({
  usePlToast: () => ({ show: vi.fn() }),
}));

// 아직 한 번도 돌지 않은 대상 — 빈 카드가 서고, 그 카드가 `작업 시작` 을 가진다.
vi.mock('@/app/lib/api/pipeline', () => ({
  listPipelinesByTarget: vi.fn().mockResolvedValue({ content: [], totalElements: 0, totalPages: 1 }),
  getLatestPipelineByTarget: vi.fn().mockResolvedValue(null),
  getPipeline: vi.fn().mockRejectedValue(new Error('no run')),
  getTaskDefinitions: vi.fn().mockResolvedValue({ task_definitions: [] }),
}));

const NEEDED: ServiceWorkNoticeData = {
  result: {
    kind: 'needed',
    step: { id: 'service', title: 'Terraform 직접 적용' },
    done: 0,
    total: 1,
    rows: [{ resourceId: 'rds-1', resourceName: 'rds-1', status: 'FAIL', guide: null }],
  },
  lastCheck: { status: 'SUCCESS', checkedAt: '2026-08-31T01:00:00Z' },
  onReload: vi.fn(),
};

describe('TargetPipelineSections — serviceWork 는 카드까지 간다', () => {
  it('빈 현재 작업 카드에 경고가 닿는다', async () => {
    render(
      <TargetPipelineSections
        targetSourceId="1006"
        provider="AWS"
        onStart={vi.fn()}
        serviceWork={NEEDED}
        onSelectTab={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('설치 작업 전에 서비스 측 대응이 먼저 필요합니다')).toBeTruthy(),
    );
    expect(screen.getByRole('button', { name: /상세 정보 보기/ })).toBeTruthy();
  });

  it('넘겨줄 것이 없으면 아무 자리도 차지하지 않는다', async () => {
    render(
      <TargetPipelineSections
        targetSourceId="1006"
        provider="AWS"
        onStart={vi.fn()}
        onSelectTab={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: /작업 시작/ })).toBeTruthy());
    expect(screen.queryByText(/서비스 측 대응/)).toBeNull();
  });
});
