/**
 * §10 목이 다섯 버킷을 **전부** 만들 수 있는지.
 *
 * `running` 버킷은 오래도록 어떤 픽스처에서도 나오지 않았다: 유일한 RUNNING 패턴
 * (`runningToday`)이 지난 날짜를 성공으로 채워 `succeededThisWeek` 를 참으로 만들었고,
 * 그러면 `classifyDb` 는 그 행을 'succeeded' 로 분류한다. 그래서 행 판정과 요약 카운트가
 * 서로 다른 집합을 세던 버그가 **테스트 전부 초록인 채로** 살아 있었다 — 화면에서만
 * 재현되는 상태를 목이 만들지 못하면 초록은 아무것도 보증하지 않는다.
 *
 * 검사가 무엇이 아닌지: 특정 대상의 개수를 세지 않는다. 세는 것은 "이 버킷을 만들 수
 * 있는 픽스처가 저장소에 존재하는가"다.
 */
import { describe, expect, it } from 'vitest';
import { mockMonitoring } from '@/lib/bff/mock/monitoring';
import { classifyDb, type DbBucket } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/approvalGate';
import type { DagStatusResponse } from '@/lib/types/dag-status';

const bucketsOf = async (targetSourceId: number): Promise<Set<DbBucket>> => {
  const res = await mockMonitoring.getDagStatus(targetSourceId);
  const body = (await res.json()) as DagStatusResponse;
  return new Set(body.agents.flatMap((a) => a.databaseStatuses.map(classifyDb)));
};

describe('dag-status 목의 버킷 커버리지', () => {
  it('IDC(1583)는 running 을 만든다 — 성공 기록 없이 오늘 시작된 실행', async () => {
    expect(await bucketsOf(1583)).toContain('running');
  });

  it('IDC(1583) 한 대상 안에 succeeded · failed · unscheduled · running 이 같이 선다', async () => {
    // 한 화면에서 요약 줄과 행 판정이 갈리는지 보려면 그 넷이 한 응답에 있어야 한다.
    const buckets = await bucketsOf(1583);
    for (const bucket of ['succeeded', 'failed', 'unscheduled', 'running'] as const) {
      expect(buckets).toContain(bucket);
    }
  });

  it('스케일 픽스처(1801)의 리소스 수는 명부가 정한다 — 손으로 적은 개수가 아니다', async () => {
    const { LGS_RESOURCE_IDS } = await import('@/lib/mock-data');
    const res = await mockMonitoring.getDagStatus(1801);
    const body = (await res.json()) as DagStatusResponse;
    expect(body.agents).toHaveLength(LGS_RESOURCE_IDS.length);
    // 조인 키가 어긋나면 표가 통째로 대시가 된다 — 그 어긋남을 여기서 잡는다.
    expect(body.agents.map((a) => a.resourceId)).toEqual([...LGS_RESOURCE_IDS]);
  });
});
