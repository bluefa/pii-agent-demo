/**
 * 연동 현황 다섯 행의 판정 — 이 파일이 지키는 것은 세 규칙이다.
 *   1. 조회 실패는 실패가 아니다 (거절 ≠ ✕)
 *   2. 미도달은 실패가 아니다 (아무것도 실행 안 된 대상에 ✕ 다섯 개가 서면 안 된다)
 *   3. 어느 행도 단계를 말하지 않는다 (`StatusInputs` 에 processStatus 가 없다)
 */
import { describe, expect, it } from 'vitest';

import { statusRows, type StatusInputs } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/status/statusRows';

const ok = <T,>(value: T) => ({ ok: true, value }) as const;
const rejected = { ok: false } as const;

/** 아무것도 실행된 적 없는 대상 — 다섯 행이 전부 「없음」인 자리. */
const idle: StatusInputs = {
  scan: ok(null),
  tc: ok(null),
  terraform: ok({ has_confirmed_infra: false, tasks: [], cloud_provider: 'AWS' }),
  dag: ok(null),
  isIdc: false,
};

/** 논리 DB 넷 중 하나가 이번 주 성공 기록이 없는 대상. */
const dagWith = (healthStatus: string, succeeded: number, total: number) => ({
  targetSourceId: 1,
  connectionStatus: 'SUCCESS',
  healthStatus,
  timezone: 'Asia/Seoul',
  agents: [
    {
      agentId: 'a1',
      resourceId: 'r1',
      gcpRegion: null,
      connectionStatus: 'SUCCESS',
      databaseStatuses: Array.from({ length: total }, (_, i) => ({
        databaseUri: `db-${i}`,
        databaseName: null,
        schemaName: null,
        dagName: null,
        namespace: null,
        succeededThisWeek: i < succeeded,
        lastSuccessAt: null,
        days: [],
      })),
    },
  ],
});

const valueOf = (rows: ReturnType<typeof statusRows>, name: string) =>
  rows.find((row) => row.name === name);

describe('statusRows', () => {
  it('오너가 지시한 순서로 선다 — 스캔 · 연결 테스트 · 인프라 작업 · 확정 정보 · Airflow', () => {
    expect(statusRows(idle).map((row) => row.name)).toEqual([
      '스캔',
      '연결 테스트',
      '인프라 작업',
      '확정 정보',
      'Airflow',
    ]);
  });

  it('아무것도 실행 안 된 대상에는 실패 마크가 하나도 없다', () => {
    expect(statusRows(idle).some((row) => row.mark === 'err')).toBe(false);
  });

  it('조회가 거절되면 「조회 실패」이지 「실행 없음」이 아니다', () => {
    const rows = statusRows({ ...idle, scan: rejected, tc: rejected });
    for (const name of ['스캔', '연결 테스트']) {
      const row = valueOf(rows, name);
      expect(row).toMatchObject({ mark: 'unknown', value: '조회 실패', failed: true });
    }
  });

  it('404(이력 없음)는 거절이 아니다 — 「실행 없음」이고 다시 시도가 붙지 않는다', () => {
    const rows = statusRows(idle);
    expect(valueOf(rows, '스캔')).toMatchObject({ value: '실행 없음', failed: false });
    expect(valueOf(rows, '연결 테스트')).toMatchObject({ value: '실행 없음', failed: false });
  });

  it('terraform 한 건이 죽으면 두 행만 함께 모른다고 말하고 나머지는 멀쩡하다', () => {
    const rows = statusRows({ ...idle, terraform: rejected });
    expect(valueOf(rows, '인프라 작업')?.failed).toBe(true);
    expect(valueOf(rows, '확정 정보')?.failed).toBe(true);
    expect(valueOf(rows, '스캔')?.failed).toBe(false);
    expect(valueOf(rows, '연결 테스트')?.failed).toBe(false);
    expect(valueOf(rows, 'Airflow')?.failed).toBe(false);
  });

  it('has_confirmed_infra 가 없으면 미확정이 아니라 「알 수 없음」이다', () => {
    const rows = statusRows({ ...idle, terraform: ok({ tasks: [], cloud_provider: 'AWS' }) });
    expect(valueOf(rows, '확정 정보')).toMatchObject({ mark: 'unknown', value: '알 수 없음' });
  });

  it('아는 false 만 미확정이고, 단계는 적지 않는다', () => {
    expect(valueOf(statusRows(idle), '확정 정보')).toMatchObject({
      mark: 'warn',
      value: '미확정',
      sub: null,
    });
  });

  it('SUCCESS 인데 건수 맵이 없으면 성공이 아니라 마무리 중이다', () => {
    const rows = statusRows({
      ...idle,
      scan: ok({ scan_status: 'SUCCESS', resource_count_by_resource_type: null, updated_at: '2026-08-28T05:02:00Z' }),
    });
    expect(valueOf(rows, '스캔')).toMatchObject({ mark: 'run', value: '마무리 중' });
  });

  it('성공한 스캔은 리소스 합계를 싣는다', () => {
    const rows = statusRows({
      ...idle,
      scan: ok({ scan_status: 'SUCCESS', resource_count_by_resource_type: { RDS: 30, S3: 11 }, updated_at: '2026-08-28T05:02:00Z' }),
    });
    expect(valueOf(rows, '스캔')?.mark).toBe('ok');
    expect(valueOf(rows, '스캔')?.sub).toContain('리소스 41개');
  });

  it('실패한 terraform 작업이 하나라도 있으면 그 수를 센다 — 조합 상태를 쓰지 않는다', () => {
    const rows = statusRows({
      ...idle,
      terraform: ok({
        has_confirmed_infra: true,
        cloud_provider: 'AWS',
        tasks: [{ state: 'APPLIED' }, { state: 'APPLY_FAILED' }, { state: 'APPLIED' }],
      }),
    });
    expect(valueOf(rows, '인프라 작업')).toMatchObject({ mark: 'err', value: '1개 실패' });
  });

  it('아직 아무것도 안 돈 인프라는 작업 0건이든 전부 미적용이든 같은 한 문장이고, 조회 시각을 안 단다', () => {
    const empty = statusRows({
      ...idle,
      terraform: ok({ has_confirmed_infra: false, cloud_provider: 'AWS', tasks: [], checked_at: '2026-08-30T09:56:00Z' }),
    });
    const neverApplied = statusRows({
      ...idle,
      terraform: ok({
        has_confirmed_infra: false,
        cloud_provider: 'AWS',
        checked_at: '2026-08-30T09:56:00Z',
        tasks: [{ state: 'NEVER_APPLIED' }, { state: 'NEVER_APPLIED' }],
      }),
    });
    for (const rows of [empty, neverApplied]) {
      expect(valueOf(rows, '인프라 작업')).toMatchObject({
        mark: 'idle',
        value: '인프라 작업 기록 없음',
        sub: null,
      });
    }
  });

  it('읽을 값이 있는 인프라 행은 조회 시각을 단다', () => {
    const rows = statusRows({
      ...idle,
      terraform: ok({
        has_confirmed_infra: true,
        cloud_provider: 'AWS',
        checked_at: '2026-08-30T09:56:00Z',
        tasks: [{ state: 'APPLIED' }, { state: 'APPLIED' }],
      }),
    });
    expect(valueOf(rows, '인프라 작업')?.value).toBe('2개 적용 완료');
    expect(valueOf(rows, '인프라 작업')?.sub).toContain('조회');
  });

  it('없는 시각은 「-」로 실리지 않는다 — 계약이 LOOSE 라 어느 시각이든 빠질 수 있다', () => {
    const rows = statusRows({
      ...idle,
      // 확정은 됐는데 확정 시각이 빠진 응답 — `.partial()` 이 허용하는 모양이다.
      terraform: ok({ has_confirmed_infra: true, cloud_provider: 'AWS', tasks: [] }),
      scan: ok({ scan_status: 'SUCCESS', resource_count_by_resource_type: { RDS: 2 } }),
    });
    expect(valueOf(rows, '확정 정보')).toMatchObject({ value: '확정됨', sub: null });
    expect(valueOf(rows, '스캔')?.sub).toBe('리소스 2개');
  });

  it('DRAFT 인 dag-status 의 모양이 어긋나도 던지지 않는다 — 그 행만 미확인이다', () => {
    // §10 은 파싱 없이 캐스팅되어 온다(raw). `agents` 없는 200 이 접기에서 터지면
    // 서버 렌더가 죽어 라우트 전체가 에러 화면이 된다.
    const rows = statusRows({
      ...idle,
      dag: ok({ healthStatus: 'HEALTHY' } as never),
    });
    expect(valueOf(rows, 'Airflow')).toMatchObject({ mark: 'unknown', value: '미확인' });
    expect(rows).toHaveLength(5);
  });

  it('IDC 는 스캔 행이 서지 않는다 — 탭 줄과 같은 술어', () => {
    const rows = statusRows({ ...idle, isIdc: true });
    expect(rows.map((row) => row.name)).toEqual(['연결 테스트', '인프라 작업', '확정 정보', 'Airflow']);
  });

  it('Airflow 는 단계와 무관하게 dag-status 가 돌려준 것만 말한다', () => {
    // 기록 없음(404) — 미도달이지 실패가 아니다.
    expect(valueOf(statusRows(idle), 'Airflow')).toMatchObject({
      mark: 'idle',
      value: '기록 없음',
      failed: false,
    });
    // 판정은 승인 조건 ③ · Airflow 확인 탭과 같은 낱말이다.
    expect(valueOf(statusRows({ ...idle, dag: ok(dagWith('HEALTHY', 4, 4)) }), 'Airflow')).toMatchObject({
      mark: 'ok',
      value: 'HEALTHY',
      sub: '논리 DB 4개 전부 성공',
    });
    expect(valueOf(statusRows({ ...idle, dag: ok(dagWith('UNHEALTHY', 3, 4)) }), 'Airflow')).toMatchObject({
      mark: 'err',
      value: 'UNHEALTHY',
      sub: '논리 DB 4개 · 1개 확인 필요',
    });
    // 계약 밖의 값은 정상으로도 비정상으로도 세지 않는다.
    expect(valueOf(statusRows({ ...idle, dag: ok(dagWith('DEGRADED', 4, 4)) }), 'Airflow')).toMatchObject({
      mark: 'unknown',
      value: '미확인',
    });
    // 거절은 그 행만 「조회 실패」다.
    expect(valueOf(statusRows({ ...idle, dag: rejected }), 'Airflow')).toMatchObject({
      value: '조회 실패',
      failed: true,
    });
  });
});
