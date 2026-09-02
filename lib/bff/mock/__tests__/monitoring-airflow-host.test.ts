import { describe, expect, it } from 'vitest';
import { mockMonitoring } from '@/lib/bff/mock/monitoring';
import type { DagDatabaseStatus, DagStatusResponse } from '@/lib/types/dag-status';

/**
 * §11 airflow-host 목이 DAG 상세 모달의 네 갈래를 전부 만들 수 있어야 하고, §10 목과 한
 * 사실을 말해야 한다: 이름이 없는 행(보드의 `DAG 없음`)에 주소를 지어 주면 모달은 같은 행을
 * "생성됨"이라 부른다.
 */
const FIXTURE_TARGETS = [1642, 1511, 1801, 1799, 1583] as const;

const dbs = async (targetSourceId: number): Promise<DagDatabaseStatus[]> => {
  const body: DagStatusResponse = await (await mockMonitoring.getDagStatus(targetSourceId)).json();
  return body.agents.flatMap((a) => a.databaseStatuses);
};

const host = async (uri: string): Promise<{ status: number; body: unknown }> => {
  const res = await mockMonitoring.getAirflowHost(uri);
  return { status: res.status, body: await res.json() };
};

describe('airflow-host 목 — 모달의 네 갈래', () => {
  it('이름이 없는 행(unscheduled)은 픽스처 전부에서 주소도 없다', async () => {
    let seen = 0;
    for (const target of FIXTURE_TARGETS) {
      for (const row of (await dbs(target)).filter((d) => d.dagName === null)) {
        seen += 1;
        expect(await host(row.databaseUri), `${target} ${row.databaseUri}`).toEqual({ status: 200, body: '' });
      }
    }
    // 1511 billing_v2 · comment_archive, 1583 ivt_archive, 1801 미스케줄 4행 — 비어 있으면 검사가 없다.
    expect(seen).toBeGreaterThanOrEqual(7);
  });

  it('이름은 있는데 주소만 없는 행 — 1511 rating_rollup', async () => {
    const row = (await dbs(1511)).find((d) => d.databaseUri.includes('rollup'));
    expect(row?.dagName).not.toBeNull();
    expect(await host(row!.databaseUri)).toEqual({ status: 200, body: '' });
  });

  it('조회 실패 — 1511 moderation 은 502', async () => {
    const row = (await dbs(1511)).find((d) => d.databaseUri.includes('moderation'));
    expect((await host(row!.databaseUri)).status).toBe(502);
  });

  it('이름이 있는 나머지 행은 주소를 받는다 — 1511 reviews', async () => {
    const row = (await dbs(1511)).find((d) => d.databaseUri.endsWith('/reviews'));
    const { status, body } = await host(row!.databaseUri);
    expect(status).toBe(200);
    expect(String(body).startsWith('https://')).toBe(true);
  });
});
