import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  aggregateDagStatus,
  classifyDb,
  foldApprovalHead,
  monitoringEvidenceHead,
  showsHandoffCaption,
  tcRunGate,
  type DagFetch,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/approvalGate';
import type { DagDatabaseStatus, DagStatusResponse } from '@/lib/types/dag-status';

const day = (status: string, successTime: string | null = null) => ({
  day: '2026-08-19',
  status,
  successTime,
});

const db = (over: Partial<DagDatabaseStatus>): DagDatabaseStatus => ({
  databaseUri: 'mysql://10.0.0.1:3306/db',
  databaseName: 'db',
  schemaName: 'db',
  dagName: 'pii_scan_db',
  namespace: 'composer-prod',
  succeededThisWeek: false,
  lastSuccessAt: null,
  days: [],
  ...over,
});

const response = (healthStatus: string, dbs: DagDatabaseStatus[] = []): DagStatusResponse => ({
  targetSourceId: 1,
  connectionStatus: 'SUCCESS',
  healthStatus,
  timezone: 'KST',
  agents: [
    {
      agentId: 'agent-1',
      resourceId: 'r-1',
      gcpRegion: null,
      connectionStatus: 'SUCCESS',
      databaseStatuses: dbs,
    },
  ],
});

/**
 * 주석을 걷어 낸 소스만 남긴다 — 같은 장치가 두 파일에 같은 텍스트로 산다
 * (health-copy-scope.test.ts · approvalGate.test.ts). 걷지 않으면 다음 라운드가 문장을
 * 화면에서 지우고 주석에 인용만 남겨도 소스를 읽는 검사가 초록으로 남는다 — **주석이
 * 화면인 척한다**. 가정이 아니라 관측이다: 첫 실행이 ⛔ 블록 안에 인용해 둔 옛 문구를
 * 잡고 빨갛게 떨어졌다.
 *
 * 줄 주석 패턴에 `^\s*` 앵커를 두지 않는 이유는 꼬리 주석이 더 흔한 갈래이기 때문이다 —
 * `value: '기록 없음' // 옛 문구 '…'` 는 줄 맨 앞에서 시작하지 않아 앵커 붙은 패턴을
 * 그대로 빠져나갔다. 대신 이 탐욕스러운 형태는 문자열 리터럴 안의 `//` (URL 같은) 까지
 * 함께 먹는다. 지금 이 helper 가 걷는 소스(ApprovalTab.tsx · AirflowTab.tsx)에는 `://` 가
 * 하나도 없어서 안전하지만, 하나라도 들어오면 이 패턴을 다시 봐야 한다.
 */
const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/**
 * 승인 탭의 소스(주석 제외). 머리 문장이 하나로 접히면서(오너 2026-08-26) "무엇이 왜
 * 막혔는지"는 조건 카드로 이사했는데, 그 문장들은 카드 fold 안의 리터럴이라 부를 손잡이가
 * 없다. 검사가 지키는 것은 렌더 결과가 아니라 **그 사실들이 화면 어딘가에 남아 있다는
 * 것**이다.
 */
const approvalTabSource = (): string =>
  code(
    readFileSync(
      path.join(
        process.cwd(),
        'app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/ApprovalTab.tsx',
      ),
      'utf8',
    ),
  );

const loaded = (healthStatus: string): DagFetch => ({
  phase: 'loaded',
  data: response(healthStatus),
  fetchedAt: '2026-08-19T09:12:04Z',
});

// The 승인 가능 truth table (docs/api/ops-assumed-contracts.md §10) — one case
// per row. The approve CTA mounts on exactly one of them: ① 완료 승인 ∧ ② 최신 실행
// 성공 ∧ ③ HEALTHY.
describe('foldApprovalHead', () => {
  it('row 1 — TC 미완료: CTA 잠김, 머리는 미충족만 말한다', () => {
    const head = foldApprovalHead(null, false, 'success', { phase: 'loading' });
    expect(head.canApprove).toBe(false);
    expect(head.unmet).toBe(true);
    expect(head.pill).toEqual({ tone: 'off', label: '완료 승인 대기' });
    // 머리는 결정만 진다 — 어느 단계에서 무엇을 눌러야 하는지는 조건 ① 카드의 것이다.
    expect(head.desc).not.toContain('5단계');
  });

  it('서비스 쪽 버튼 이름(5단계 · 승인 요청)은 조건 ① 카드가 계속 안내한다', () => {
    // Step 5 CTA 의 실제 라벨은 "승인 요청" — 화면에 없는 이름을 안내하지 않는다.
    // 머리에서 걷어 낸 안내가 카드에도 없으면 관리자는 서비스에 전달할 말을 잃는다.
    const src = approvalTabSource();
    expect(src).toContain('5단계 연결 테스트에서 승인 요청');
    // 문장이 소스에 있다는 것과 화면에 설 수 있다는 것은 다르다 — 이 캡션은
    // `showsHandoffCaption` 이 참일 때만 나온다. 술어 자체를 여기서 한 번 못 박고,
    // 그 술어가 캡션의 렌더 게이트에 아직 걸려 있는지도 본다.
    expect(showsHandoffCaption(null, 'SUCCESS')).toBe(true);
    // 잡는 것: 게이트를 지우거나 `facts: false && showsHandoffCaption(...)` 처럼 상수로
    // 무력화해 캡션이 어느 상태에서도 못 서게 만드는 변형.
    // 못 잡는 것: 호출은 그대로 두고 뜻만 뒤집는 변형(`facts: !showsHandoffCaption(...)`)
    // 이나, 캡션 JSX 를 렌더하지 않는 다른 경로로 옮기는 변형. 렌더 검사가 아니다.
    expect(src).toMatch(/facts:\s*showsHandoffCaption\(/);
  });

  it('row 2 — REJECTED: both CTAs unmounted regardless of dag state', () => {
    const head = foldApprovalHead('TEST_CONNECTION_REJECTED', false, 'success', loaded('HEALTHY'));
    expect(head.canApprove).toBe(false);
    expect(head.pill).toEqual({ tone: 'warn', label: '재실행 요청됨' });
  });

  it('row 3 — COMPLETED + loading: approve locked', () => {
    const head = foldApprovalHead('TEST_CONNECTION_COMPLETED', false, 'success', { phase: 'loading' });
    expect(head.canApprove).toBe(false);
    expect(head.pill).toEqual({ tone: 'off', label: '헬스 확인 중' });
  });

  it('row 4 — COMPLETED + fetch failure: locked (failure is not an empty result)', () => {
    const head = foldApprovalHead('TEST_CONNECTION_COMPLETED', false, 'success', { phase: 'failed' });
    expect(head.canApprove).toBe(false);
    expect(head.pill).toEqual({ tone: 'err', label: '확인 실패' });
  });

  it('row 5 — COMPLETED + HEALTHY: the one approvable state', () => {
    const head = foldApprovalHead('TEST_CONNECTION_COMPLETED', false, 'success', loaded('HEALTHY'));
    expect(head.canApprove).toBe(true);
    expect(head.pill).toEqual({ tone: 'ok', label: '처리 대기' });
  });

  it('row 6 — COMPLETED + UNHEALTHY: approve locked', () => {
    const head = foldApprovalHead('TEST_CONNECTION_COMPLETED', false, 'success', loaded('UNHEALTHY'));
    expect(head.canApprove).toBe(false);
    expect(head.pill).toEqual({ tone: 'err', label: '승인 불가' });
  });

  it('row 7 — COMPLETED + unknown enum: locked, raw value kept OUT of the copy', () => {
    const head = foldApprovalHead('TEST_CONNECTION_COMPLETED', false, 'success', loaded('DEGRADED'));
    expect(head.canApprove).toBe(false);
    expect(head.pill).toEqual({ tone: 'off', label: '미확인' });
    // Wire vocabulary never rides in sentence-tier copy — tooltip channel only.
    expect(head.desc).not.toContain('DEGRADED');
    expect(head.desc).not.toContain('healthStatus');
  });

  // 조건 ② — HEALTHY 라도 최신 실행이 성공이라고 말하지 않으면 승인은 잠긴다.
  it('COMPLETED + 실행 실패: approve locked even when health is HEALTHY', () => {
    const head = foldApprovalHead('TEST_CONNECTION_COMPLETED', false, 'failed', loaded('HEALTHY'));
    expect(head.canApprove).toBe(false);
    expect(head.pill).toEqual({ tone: 'err', label: '승인 불가' });
  });

  it('COMPLETED + 도착 전 / 진행 중 / 이력 없음 / 조회 실패 / 미지 enum: 전부 잠긴다', () => {
    for (const run of ['loading', 'open', 'none', 'error', 'unknown'] as const) {
      const head = foldApprovalHead('TEST_CONNECTION_COMPLETED', false, run, loaded('HEALTHY'));
      expect(head.canApprove).toBe(false);
    }
  });

  it('머리는 모름과 미충족을 가른다 — 확인 못 한 것을 "충족되지 않았다"고 하지 않는다', () => {
    const head = (run: Parameters<typeof foldApprovalHead>[2]) =>
      foldApprovalHead('TEST_CONNECTION_COMPLETED', false, run, loaded('HEALTHY'));
    // 판정: 조건이 실제로 안 풀린 상태 — 경고 아이콘이 서는 자리다.
    for (const run of ['failed', 'none', 'open'] as const) expect(head(run).unmet).toBe(true);
    // 모름: 아직 답이 없거나 조회가 거절됐다. 문장도 따로 서야 한다.
    for (const run of ['loading', 'error', 'unknown'] as const) {
      expect(head(run).unmet).toBe(false);
      expect(head(run).desc).not.toBe(head('failed').desc);
    }
    // 셋끼리도 갈라야 한다 — 미충족과만 견주면 '조회 실패'와 '판정할 수 없음'을 같은
    // 문장으로 접어도 초록으로 남는다.
    expect(new Set((['loading', 'error', 'unknown'] as const).map((r) => head(r).desc)).size).toBe(
      3,
    );
  });

  it('실패 ≠ 빈 결과 ≠ 모름 — 갈라 말하는 자리가 머리에서 조건 ② 카드로 옮겨졌다', () => {
    const src = approvalTabSource();
    const evidence = [
      '연결 실패',
      '연결 테스트 실행 기록이 없습니다',
      '실행 정보를 불러오지 못했습니다',
    ];
    for (const line of evidence) expect(src).toContain(line);
  });

  it('status 조회 실패는 미요청과 다른 문장이다 — 404 가 아닌 거절은 모름이다', () => {
    const failed = foldApprovalHead(null, true, 'success', loaded('HEALTHY'));
    const pending = foldApprovalHead(null, false, 'success', loaded('HEALTHY'));
    expect(failed.canApprove).toBe(false);
    expect(failed.pill).toEqual({ tone: 'err', label: '확인 실패' });
    expect(failed.desc).not.toBe(pending.desc);
  });

  it('완료 승인된 대상이라도 status 조회 실패가 서 있으면 잠근다', () => {
    const head = foldApprovalHead('TEST_CONNECTION_COMPLETED', true, 'success', loaded('HEALTHY'));
    expect(head.canApprove).toBe(false);
  });
});

// 조건 ② 의 판정 — 통과는 SUCCESS 하나뿐(ALLOWLIST)이고, 잠그는 이유는 갈라 둔다.
describe('tcRunGate', () => {
  it('SUCCESS 만 통과한다', () => {
    expect(tcRunGate('SUCCESS', true, false)).toBe('success');
    expect(tcRunGate('FAIL', true, false)).toBe('failed');
    expect(tcRunGate('RUNNING', true, false)).toBe('open');
    expect(tcRunGate('PENDING', true, false)).toBe('open');
    expect(tcRunGate('UNKNOWN', true, false)).toBe('unknown');
  });

  it('이력 없음과 조회 실패는 다른 사실이다', () => {
    expect(tcRunGate('UNKNOWN', false, false)).toBe('none');
    expect(tcRunGate('UNKNOWN', false, true)).toBe('error');
  });
});

// C-1 조건부 캡션 — 혼동은 "테스트 성공 + 완료 승인 미요청" 한 상태에서만 생긴다.
describe('showsHandoffCaption', () => {
  it('성공한 실행 + 미요청에서만 선다', () => {
    expect(showsHandoffCaption(null, 'SUCCESS')).toBe(true);
    expect(showsHandoffCaption('WAITING', 'SUCCESS')).toBe(true);
  });

  it('완료 승인 뒤·재실행 요청 뒤·실패한 실행에는 서지 않는다', () => {
    expect(showsHandoffCaption('TEST_CONNECTION_COMPLETED', 'SUCCESS')).toBe(false);
    expect(showsHandoffCaption('TEST_CONNECTION_REJECTED', 'SUCCESS')).toBe(false);
    expect(showsHandoffCaption(null, 'FAIL')).toBe(false);
    expect(showsHandoffCaption(null, 'RUNNING')).toBe(false);
  });
});

describe('monitoringEvidenceHead', () => {
  it('HEALTHY 전수 성공 — 논리 DB 는 세어서 말한다 (총계 중 성공, 나머지는 확인 필요)', () => {
    const data = response('HEALTHY', [
      db({ succeededThisWeek: true, days: [day('SUCCESS', '2026-08-18T07:00:00+09:00')] }),
    ]);
    const head = monitoringEvidenceHead(
      { phase: 'loaded', data, fetchedAt: '2026-08-19T09:12:04Z' },
      aggregateDagStatus(data),
    );
    expect(head.pill).toEqual({ tone: 'ok', label: 'HEALTHY' });
    // 사실마다 한 행 — 값의 이름은 라벨 열이 진다 (오너 2026-08-26).
    expect(head.subtitle).toBeNull();
    expect(head.facts).toEqual([
      {
        label: '논리 DB',
        segments: [
          { prefix: '총', count: 1, suffix: '개' },
          { count: 1, suffix: '개 성공' },
          { count: 0, suffix: '개 확인 필요' },
        ],
      },
      {
        label: '리소스',
        segments: [
          { prefix: '총', count: 1, suffix: '개' },
          { count: 1, suffix: '개 성공' },
          { count: 0, suffix: '개 확인 필요' },
        ],
      },
    ]);
  });

  it('UNHEALTHY 는 succeededThisWeek=false 만 센다', () => {
    const data = response('UNHEALTHY', [db({}), db({ succeededThisWeek: true })]);
    const head = monitoringEvidenceHead(
      { phase: 'loaded', data, fetchedAt: '2026-08-19T09:12:04Z' },
      aggregateDagStatus(data),
    );
    expect(head.pill).toEqual({ tone: 'err', label: 'UNHEALTHY' });
    // 판정이 갈려도 행은 같다 — 정상 여부는 알약이 말하고 이 행은 센다.
    expect(head.facts[0]).toEqual({
      label: '논리 DB',
      segments: [
        { prefix: '총', count: 2, suffix: '개' },
        { count: 1, suffix: '개 성공' },
        { count: 1, suffix: '개 확인 필요' },
      ],
    });
  });

  it('미지 enum — raw 는 툴팁 채널에만', () => {
    const head = monitoringEvidenceHead(loaded('DEGRADED'), aggregateDagStatus(response('DEGRADED')));
    expect(head.pill).toEqual({ tone: 'off', label: '미확인' });
    expect(head.subtitle).not.toContain('DEGRADED');
    expect(head.facts).toEqual([]);
    expect(head.titleHint).toBe('healthStatus: DEGRADED');
  });

  it('loading·failed 는 사실 그대로 — 실패는 빈 결과가 아니다', () => {
    expect(monitoringEvidenceHead({ phase: 'loading' }, null).pill.label).toBe('확인 중');
    expect(monitoringEvidenceHead({ phase: 'failed' }, null).pill).toEqual({
      tone: 'err',
      label: '확인 실패',
    });
  });
});

describe('classifyDb', () => {
  it('succeededThisWeek wins first — even with FAILED days present', () => {
    expect(
      classifyDb(db({ succeededThisWeek: true, days: [day('FAILED'), day('SUCCESS', '2026-08-18T07:00:00+09:00')] })),
    ).toBe('succeeded');
  });

  it('splits the no-success rest by day evidence', () => {
    expect(classifyDb(db({ days: [day('FAILED'), day('NOT_SCHEDULED')] }))).toBe('failed');
    expect(classifyDb(db({ days: [day('RUNNING'), day('NOT_SCHEDULED')] }))).toBe('running');
    expect(classifyDb(db({ days: [day('NOT_SCHEDULED'), day('NOT_SCHEDULED')] }))).toBe('unscheduled');
  });

  it('an unseen day status lands in other, not in 미스케줄', () => {
    expect(classifyDb(db({ days: [day('NOT_SCHEDULED'), day('QUEUED')] }))).toBe('other');
    expect(classifyDb(db({ days: [] }))).toBe('other');
  });
});

describe('aggregateDagStatus', () => {
  it('counts agents by SUCCESS allowlist and buckets every db exactly once', () => {
    const data = response('UNHEALTHY', [
      db({ succeededThisWeek: true, days: [day('SUCCESS', '2026-08-18T07:00:00+09:00')] }),
      db({ days: [day('FAILED')] }),
      db({ days: [day('NOT_SCHEDULED')] }),
    ]);
    data.agents.push({ ...data.agents[0], agentId: 'agent-2', connectionStatus: 'FAIL', databaseStatuses: [] });

    const agg = aggregateDagStatus(data);
    expect(agg).toMatchObject({
      agentTotal: 2,
      agentConnected: 1,
      dbTotal: 3,
      succeeded: 1,
      failed: 1,
      unscheduled: 1,
      running: 0,
      other: 0,
      noSuccess: 2,
    });
    expect(agg.succeeded + agg.failed + agg.running + agg.unscheduled + agg.other).toBe(agg.dbTotal);
  });
});
