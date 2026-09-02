import { beforeEach, describe, expect, it } from 'vitest';
import { mockTaskQueue } from '@/lib/bff/mock/task-queue';
import { mockTargetSources } from '@/lib/bff/mock/target-sources';
import { RECENT_CREATION_WINDOW_DAYS } from '@/lib/mock-data';
import { resetStore } from '@/lib/mock-store';

/**
 * 운영 알림 '최근 14일 생성' 버킷 — 타일 건수와 그 아래 목록은 같은 사실이어야 한다.
 *
 * 픽스처의 생성일이 전부 고정 문자열이라, 시드가 없으면 이 버킷은 오늘이 언제든 0 건이다.
 * 0 건은 화면상 "조용한 성공"과 구별되지 않으므로, 목이 사실을 만들었는지 여기서 잰다.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

interface RecentRow {
  targetSourceId: number;
  createdAt: string;
  serviceCode: string;
  serviceName: string;
}

const recentPage = async (page = 0, size = 100) => {
  const res = await mockTaskQueue.getAlertTargetSources({ kind: 'recent', page, size });
  return (await res.json()) as { totalElements: number; content: RecentRow[] };
};

const summaryCount = async (): Promise<number> => {
  const res = await mockTaskQueue.getDashboardSummary();
  const body = (await res.json()) as { recently_created_count: number };
  return body.recently_created_count;
};

describe("mockTaskQueue — '최근 생성' 버킷", () => {
  beforeEach(() => {
    resetStore();
  });

  it('목록이 비어 있지 않다 — 시드가 창 안의 대상을 실제로 만든다', async () => {
    const { totalElements, content } = await recentPage();
    expect(totalElements).toBeGreaterThan(0);
    expect(content.length).toBe(totalElements);
  });

  it('타일 건수가 목록의 totalElements 와 같다', async () => {
    const { totalElements } = await recentPage();
    expect(await summaryCount()).toBe(totalElements);
  });

  it('모든 행이 14일 창 안에 있고 최신순이다', async () => {
    const { content } = await recentPage();
    const cutoff = Date.now() - RECENT_CREATION_WINDOW_DAYS * DAY_MS;
    for (const row of content) {
      expect(Date.parse(row.createdAt)).toBeGreaterThanOrEqual(cutoff);
    }
    const timestamps = content.map((row) => Date.parse(row.createdAt));
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
  });

  /**
   * 단계 시연용 픽스처는 서지 못한다 — 그것들은 서비스 코드 자리에 플랫폼 이름을 달아,
   * 목록에서 "1023 / idc / IDC / Step 4. 설치 진행 — …" 처럼 읽힌다. 운영자는 그 행을
   * 방금 만들어진 연동 대상과 구별할 수 없다.
   *
   * 시드가 그런 대상을 안 고르는 것만으로는 부족해서 목록 쪽에서 잰다: 판정이 목록에
   * 있어야 나중에 시연 픽스처가 늘어도 조용히 끼어들지 못한다.
   */
  it('플랫폼 이름을 코드로 쓰는 시연용 대상은 목록에 없다', async () => {
    const { content } = await recentPage();
    const platformCodes = content.filter((row) =>
      ['AWS', 'AZURE', 'GCP', 'IDC', 'SDU'].includes(row.serviceCode.trim().toUpperCase()),
    );
    expect(platformCodes).toEqual([]);
  });

  /** 행은 전부 눌리는 링크다 — 열리지 않는 id 를 목록에 세우면 목록만 멀쩡해 보인다. */
  it('모든 행의 상세가 열린다', async () => {
    const { content } = await recentPage();
    for (const row of content) {
      const res = await mockTargetSources.get(String(row.targetSourceId));
      expect(res.status, `target ${row.targetSourceId}`).toBe(200);
    }
  });
});
