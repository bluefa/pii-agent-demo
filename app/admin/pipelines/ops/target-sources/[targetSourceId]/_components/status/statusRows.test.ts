/**
 * 연동 현황 다섯 행의 판정 — 이 파일이 지키는 것은 세 규칙이다.
 *   1. 조회 실패는 실패가 아니다 (거절 ≠ ✕)
 *   2. 미도달은 실패가 아니다 (1단계 대상에 ✕ 다섯 개가 서면 안 된다)
 *   3. Airflow 는 §10 을 부르지 않는다 (입력이 processStatus 뿐이다)
 */
import { describe, expect, it } from 'vitest';

import { statusRows, type StatusInputs } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/status/statusRows';

const ok = <T,>(value: T) => ({ ok: true, value }) as const;
const rejected = { ok: false } as const;

/** 아무것도 실행된 적 없는 1단계 대상 — 다섯 행이 전부 「아직」인 자리. */
const idle: StatusInputs = {
  scan: ok(null),
  tc: ok(null),
  terraform: ok({ has_confirmed_infra: false, tasks: [], cloud_provider: 'AWS' }),
  processStatus: 'IDLE',
  isIdc: false,
};

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

  it('1단계 대상에는 실패 마크가 하나도 없다', () => {
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

  it('아는 false 만 미확정이고, 그때 어디까지 왔는지를 적는다', () => {
    expect(valueOf(statusRows(idle), '확정 정보')).toMatchObject({
      mark: 'warn',
      value: '미확정',
      sub: '1단계 · 연동 대상 DB 선택',
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

  it('IDC 는 스캔 행이 서지 않는다 — 탭 줄과 같은 술어', () => {
    const rows = statusRows({ ...idle, isIdc: true });
    expect(rows.map((row) => row.name)).toEqual(['연결 테스트', '인프라 작업', '확정 정보', 'Airflow']);
  });

  it('Airflow 는 processStatus 만 읽는다 — 6단계에 닿기 전에는 위치만 말한다', () => {
    expect(valueOf(statusRows(idle), 'Airflow')).toMatchObject({
      value: '아직 도달하지 않음',
      sub: '6단계 완료 확인 후',
    });
    expect(valueOf(statusRows({ ...idle, processStatus: 'CONNECTED' }), 'Airflow')).toMatchObject({
      value: '확인 가능',
    });
  });
});
