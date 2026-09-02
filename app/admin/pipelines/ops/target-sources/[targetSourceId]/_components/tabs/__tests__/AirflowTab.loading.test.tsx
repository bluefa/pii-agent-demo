// @vitest-environment jsdom
/**
 * Airflow 확인 탭의 대기 프레임.
 *
 * §10 이 도는 동안 이 탭에는 판정 문장 하나만 있었다 — 카운트 줄도 에이전트 표도 정착본
 * 에서만 그려져서, 응답이 도착하는 순간 그 둘이 통째로 들어서며 탭이 뛰었다.
 */
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/lib/api', () => ({
  getConfirmedIntegration: vi.fn().mockResolvedValue({ resource_infos: [] }),
}));

import { AirflowTab } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/AirflowTab';

describe('AirflowTab — 대기 프레임', () => {
  it('DAG 상태를 기다리는 동안 카운트 줄과 표의 자국을 그린다', async () => {
    const { container } = render(
      <AirflowTab targetSourceId={1642} isIdc={false} dag={{ phase: 'loading' }} />,
    );
    // 확정 스냅샷 조회(best-effort)가 테스트 밖에서 상태를 건드리지 않게 한 틱 흘린다.
    await act(async () => {});

    // 머리의 메타 슬롯 + 카운트 줄 + 표(머리 1 · 본문 3) — 정착본이 서는 자리마다 하나씩.
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(1);
    // 형제 스켈레톤과 같은 문법 — 자국만 그리고 기다린다고 말하지 않으면 낭독은 빈 탭을 읽는다.
    const busy = container.querySelector('[aria-busy]');
    expect(busy).not.toBeNull();
    expect(busy?.textContent).toContain('불러오는 중');
    // 판정 문장은 그대로다 — 스켈레톤이 대신하지 않는다.
    expect(container.textContent).toContain('모니터링 상태를 확인하고 있어요.');
  });
});
