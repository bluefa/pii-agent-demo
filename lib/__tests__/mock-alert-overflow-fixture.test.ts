/**
 * 절단 확인용 과장 길이(1388)는 **운영 알림 응답 안에서만** 산다.
 *
 * 처음에는 PROC[1388].svc 를 99자로 직접 늘렸는데, PROC 는 알림 전용 픽스처가 아니라
 * `/process-statuses`(파이프라인 모니터)와 타깃 조회가 함께 읽는 표라 목 모드의 다른
 * 화면들까지 99자 이름을 받았다. 확인하려던 것은 알림 표 하나의 절단이었다.
 *
 * 이 테스트는 같은 target source 를 두 응답에서 나란히 꺼내 세운다 — 오버라이드가
 * 알림 밖으로 새는 순간, 또는 알림 안에서 사라지는 순간 깨진다.
 */
import { describe, expect, it } from 'vitest';

import { mockTaskQueue } from '@/lib/bff/mock/task-queue';

/** 1388(BIL) 은 st='CONFIRMED' → 'need-install' 버킷에 든다. */
const OVERFLOW_TS = 1388;
const OVERFLOW_KIND = 'need-install' as const;
/** 계약상 이름·설명 상한. 오버라이드는 이 상한 밖 입력이어야 절단을 확인할 수 있다. */
const CONTRACT_MAX = 30;

const rowsOf = async (res: Response): Promise<Array<Record<string, unknown>>> => {
  const body = (await res.json()) as { content: Array<Record<string, unknown>> };
  return body.content;
};

/**
 * 문자열을 **재귀로** 모은다. 모니터 응답은 이름을 top-level 이 아니라
 * `target_source.service_info.serviceName` 에 담는다 — 얕게 훑는 판정은 값이 새도
 * 초록으로 통과한다(뮤테이션으로 확인했다). 중첩이 바뀌어도 이 판정은 따라간다.
 */
const stringsIn = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(stringsIn);
  return [];
};

describe('운영 알림 절단 픽스처', () => {
  it('알림 응답은 상한 밖 이름과 설명을 준다', async () => {
    const rows = await rowsOf(
      await mockTaskQueue.getAlertTargetSources({ kind: OVERFLOW_KIND, page: 0, size: 10 }),
    );
    const row = rows.find((r) => r.targetSourceId === OVERFLOW_TS);

    expect(row).toBeDefined();
    expect(String(row?.serviceName).length).toBeGreaterThan(CONTRACT_MAX);
    expect(String(row?.description).length).toBeGreaterThan(CONTRACT_MAX);
  });

  it('같은 대상이 파이프라인 모니터에서는 평범한 이름으로 남는다', async () => {
    const rows = await rowsOf(
      await mockTaskQueue.getProcessStatuses({ targetSourceId: OVERFLOW_TS, page: 0, size: 10 }),
    );

    expect(rows).toHaveLength(1);
    // 이름 필드명·위치는 wire 표기를 따르므로 값으로 판정한다 — 이 행 어디에도
    // 상한 밖 문자열이 있어서는 안 된다.
    const longest = Math.max(...stringsIn(rows[0]).map((s) => s.length));
    expect(longest).toBeLessThanOrEqual(CONTRACT_MAX);
  });
});
