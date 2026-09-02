import { describe, expect, it } from 'vitest';
import {
  APPROVAL_QUEUE_TARGETS,
  approvalQueueAccount,
} from '@/lib/bff/mock/approval-queue-fixtures';
import { mockTargetSources } from '@/lib/bff/mock/target-sources';
import { mockProjects, mockServiceCodes } from '@/lib/mock-data';

/**
 * 연동 요청 큐(대기 · 반려 · 이력)의 모든 행은 열 수 있는 대상이어야 한다.
 *
 * 세 뷰는 각 행을 `/admin/pipelines/ops/target-sources/{id}` 로 링크하고, 그 화면은
 * `GET /target-sources/{id}` 를 읽는다. 큐 픽스처와 카탈로그가 서로 다른 id 집합을
 * 들고 있던 동안 대부분의 행이 "정보를 불러오지 못했습니다" 로 떨어졌다 — 큐 목록은
 * 멀쩡히 그려지므로 목록만 보면 아무 문제가 없어 보인다.
 *
 * 존재만으로는 부족하다: 열린 화면이 큐가 부르던 것과 같은 서비스·같은 클라우드여야
 * 이동이 맞게 됐는지 확인할 근거가 된다.
 */
const detail = async (id: number): Promise<{ status: number; body: Record<string, unknown> }> => {
  const res = await mockTargetSources.get(String(id));
  return { status: res.status, body: await res.json() };
};

describe('연동 요청 큐가 보여줄 수 있는 대상은 모두 상세가 열린다', () => {
  it.each(APPROVAL_QUEUE_TARGETS.map((t) => [t.ts, t.code, t.pv] as const))(
    '#%i (%s / %s)',
    async (ts, code, pv) => {
      const { status, body } = await detail(ts);
      expect(status).toBe(200);
      expect(body.service_code).toBe(code);
      // 큐는 wire 표기('AZURE')로 말하고 상세도 wire 표기로 답한다.
      expect(body.cloud_provider).toBe(pv.toUpperCase());
    },
  );

  it('큐가 아는 서비스 코드는 카탈로그에도 있다 (상세 헤더가 코드를 이름 자리에 적지 않도록)', () => {
    const known = new Set(mockServiceCodes.map((s) => s.code));
    const missing = [...new Set(APPROVAL_QUEUE_TARGETS.map((t) => t.code))].filter(
      (code) => !known.has(code),
    );
    expect(missing).toEqual([]);
  });

  /**
   * 서비스 운영 목록은 한 대상을 카탈로그와 큐 두 경로 중 아무 쪽에서나 받을 수 있다
   * (task-queue.ts 의 serviceCode 분기가 둘을 합치고 id 로 dedup 한다). 두 경로가 각자
   * 계정을 지어내면, 어느 쪽이 이겼느냐에 따라 카드의 계정 줄이 바뀌거나 통째로 빈다.
   * 그래서 여기서 시드한 대상은 큐 응답과 같은 함수에서 계정을 받아야 한다.
   */
  it('큐 때문에 시드된 대상은 큐와 같은 계정을 든다', () => {
    const seeded = mockProjects.filter((p) => p.id.startsWith('queue-proj-'));
    expect(seeded.length).toBeGreaterThan(0);
    for (const project of seeded) {
      const target = APPROVAL_QUEUE_TARGETS.find((t) => t.ts === project.targetSourceId);
      expect(target).toBeDefined();
      const account = approvalQueueAccount(target!.ts, target!.pv);
      expect(project.awsAccountId ?? null).toBe(account.awsAccountId);
      expect(project.tenantId ?? null).toBe(account.tenantId);
      expect(project.subscriptionId ?? null).toBe(account.subscriptionId);
      expect(project.gcpProjectId ?? null).toBe(account.gcpProjectId);
    }
  });

  it('어느 픽스처에도 없는 id 는 여전히 404 다', async () => {
    const { status } = await detail(999_999);
    expect(status).toBe(404);
  });
});
