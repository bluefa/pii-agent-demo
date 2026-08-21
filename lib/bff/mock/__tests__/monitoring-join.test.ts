import { describe, expect, it } from 'vitest';
import { mockMonitoring } from '@/lib/bff/mock/monitoring';
import { mockProjects } from '@/lib/mock-data';
import { resultUnitId } from '@/lib/resource-grouping';
import type { DagStatusResponse } from '@/lib/types/dag-status';

/**
 * DAG 목의 `resourceId` 는 확정 정보가 부르는 이름과 같아야 한다.
 *
 * 두 목이 각자 id 를 지어내던 동안 표의 Region·DB 열은 전 행 대시였고, 조인이 아예 안 붙는데도
 * 화면은 멀쩡해 보였다 — 조인은 있으면 채우고 없으면 비우는 성격이라 실패가 눈에 띄지 않는다.
 * 그래서 목끼리의 정합을 테스트가 잡는다.
 */
const unitIds = (targetSourceId: number): Set<string> => {
  const project = mockProjects.find((p) => p.targetSourceId === targetSourceId);
  if (!project) throw new Error(`no fixture for ${targetSourceId}`);
  return new Set(
    project.resources.map((r) =>
      resultUnitId({ resourceId: r.resourceId, athenaRegionResourceId: r.athenaRegionResourceId }),
    ),
  );
};

const dagStatus = async (targetSourceId: number): Promise<DagStatusResponse> =>
  (await mockMonitoring.getDagStatus(targetSourceId)).json();

describe('1642 — DAG 목과 확정 정보가 같은 id 를 쓴다', () => {
  it('모든 에이전트가 확정 정보의 결과 단위에 있다', async () => {
    const units = unitIds(1642);
    const { agents } = await dagStatus(1642);
    expect(agents.length).toBeGreaterThan(0);
    for (const a of agents) expect(units).toContain(a.resourceId);
  });

  it('Athena 는 리전 하나가 에이전트 하나 — 확정 정보 DB 가 둘이어도', async () => {
    const { agents } = await dagStatus(1642);
    const athena = agents.filter((a) => a.resourceId.startsWith('athena:'));
    expect(athena.map((a) => a.resourceId)).toHaveLength(2);
    // 리전 단위 id 는 리전마다 하나뿐이다.
    expect(new Set(athena.map((a) => a.resourceId)).size).toBe(2);
    // 그리고 그 에이전트가 이고 있는 논리 DB 는 하나다 — 카탈로그를 한 번 도는 DAG.
    for (const a of athena) expect(a.databaseStatuses).toHaveLength(1);
  });
});
