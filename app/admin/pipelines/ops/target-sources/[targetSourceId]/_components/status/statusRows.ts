/**
 * 연동 현황 다섯 행 — wire 응답을 화면이 그릴 사실로 접는다. React 도 I/O 도 없어서
 * 판정만 따로 단위 테스트한다 (`statusRows.test.ts`).
 *
 * 행 순서는 오너 지시다 (2026-08-30): 스캔 · 연결 테스트 · 인프라 작업 · 확정 정보 ·
 * Airflow. 파이프라인 의존 순서(스캔 → 확정 → 인프라 → 연결 테스트)와 다르고,
 * 그 순서로 바꾸자는 제안은 이미 한 번 거절됐다 — ⛔ 재제안 금지.
 *
 * 세 규칙이 이 파일 전체를 지배한다.
 *
 * 1. **조회 실패는 실패가 아니다.** 요청이 거절된 행은 `unknown` + `failed` 이고,
 *    「실행 없음」이나 ✕ 로 접히지 않는다. 못 읽은 것을 읽은 척하면 멀쩡한 대상이
 *    고장 난 것으로 읽힌다 — `tcRunGate` 가 NOT_FOUND(미실행)와 그 밖의 거절을
 *    가르는 것과 같은 이유다.
 * 2. **미도달은 실패가 아니다.** 아무것도 실행된 적 없는 대상은 다섯 행이 전부 「없음」이다.
 *    그 자리에 빨간 ✕ 다섯 개가 서면 안 된다 — `idle` 이 그 자리의 마크다.
 * 3. **다섯 행 어디에도 단계(`processStatus`)가 없다** (오너 2026-08-30 "단계 상관없어").
 *    각 행은 제 조회가 돌려준 것만 말한다 — 대상이 몇 단계인지는 마스트헤드의 단계 태그가
 *    이미 말하고 있고, 행이 그것을 한 번 더 적으면 이 카드가 지우려던 중복이 돌아온다.
 *    그래서 이 카드는 process-status 를 **부르지도 않는다**.
 *
 *    Airflow 도 같은 규칙이다. 앞선 라운드는
 *    §10 응답이 MB 단위(논리 DB 1만 행)라는 이유로 6단계 게이트 뒤에서만 판정을 실었는데,
 *    오너가 그 게이트를 걷어냈다. 그래서 이 행도 나머지와 같은 모양이다 — 단계와 무관하게
 *    묻고, 답이 없으면(404) 「기록 없음」, 거절되면 「조회 실패」다.
 *    ⚠️ 대가는 카드의 도착 시각이다: 다섯 조회가 병렬이라도 이 한 건이 가장 느리면
 *    카드 전체가 그만큼 기다린다. 판정의 **근거**는 여전히 Airflow 확인 탭의 것이다.
 */
import type { z } from 'zod';

import type { schemas } from '@/lib/generated/install-v1';
import { OPS_TAB_SLUGS, type OpsTargetTabLabel } from '@/lib/routes';
import { fmtDateTime } from '@/lib/pipeline/format';
import { runStatus } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';
import { metaOf } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/terraformState';
import { SCAN_STATE } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/scanState';
import {
  aggregateDagStatus,
  healthVerdict,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/approvalGate';
import type { DagStatusResponse } from '@/lib/types/dag-status';

type ScanJob = z.infer<typeof schemas.ScanJobResponse>;
type TcLatest = z.infer<typeof schemas.TestConnectionVersionResult>;
type TerraformStatus = z.infer<typeof schemas.TerraformStatusResponse>;

/**
 * 한 조회의 결말. `ok:false` 는 **거절**이고, `ok:true` + `value:null` 은 **없음**이다
 * (404). 이 둘을 하나로 접으면 규칙 1이 무너진다.
 */
export type Settled<T> = { ok: true; value: T } | { ok: false };

/** 행 왼쪽 마크 — 색과 글리프는 카드가 고른다. */
export type RowMark = 'ok' | 'err' | 'warn' | 'run' | 'idle' | 'unknown';

export interface StatusRow {
  /** 행 이름이자 목적지 탭 — 링크의 접근명이 이걸 쓴다. */
  name: string;
  tab: OpsTargetTabLabel;
  mark: RowMark;
  /** 한 낱말짜리 판정. */
  value: string;
  /** 값을 한정하는 회색 한 줄 — 시각·수. 없으면 null. */
  sub: string | null;
  /** 조회가 거절됐다 — 「다시 시도」가 붙는 행. */
  failed: boolean;
}

export interface StatusInputs {
  scan: Settled<ScanJob | null>;
  tc: Settled<TcLatest | null>;
  terraform: Settled<TerraformStatus>;
  /** §10 dag-status — 없음(404)은 `value: null`, 거절은 `ok:false`. */
  dag: Settled<DagStatusResponse | null>;
  /** IDC 는 스캔 탭이 없다 (`OpsTargetView` 의 `isIdc`) — 행도 서지 않는다. */
  isIdc: boolean;
}

/**
 * `fmtDateTime` 은 없거나 못 읽은 시각에 `'-'` 를 돌려준다 — 그건 값이 아니라 자리표시라,
 * 보조 줄에 그대로 실으면 「확정됨  -」 이나 「- · 리소스 41개」 가 된다. 계약이 LOOSE
 * (`.partial()`) 라 어느 시각이든 통째로 빠질 수 있으므로, 없는 것은 없는 것으로 접는다.
 */
const at = (iso: string | null | undefined): string | null => {
  const text = fmtDateTime(iso);
  return text === '-' ? null : text;
};

/** 규칙 1의 모양 — 거절된 조회는 어느 행에서나 같은 문장을 쓴다. */
const rejected = (name: string, tab: OpsTargetTabLabel): StatusRow => ({
  name,
  tab,
  mark: 'unknown',
  value: '조회 실패',
  sub: null,
  failed: true,
});

/**
 * SUCCESS 인데 건수 맵이 아직 없으면 마무리 중이다 — `useScanPolling.isScanFinalizing`
 * 과 같은 판정. 계약 상태가 아니라 UI 의 이름이라 wire 값 대신 여기서 만든다.
 */
const scanStateKey = (job: ScanJob): string =>
  job.scan_status === 'SUCCESS' && job.resource_count_by_resource_type == null
    ? 'FINALIZING'
    : (job.scan_status ?? '');

const SCAN_MARK: Record<string, RowMark> = { ok: 'ok', info: 'run', err: 'err', off: 'idle' };

/** 카드 밖에서도 읽는다 — BDC 완료 모달이 「Scan & 확정」 옆에 세우는 문장이 이 판정이다.
 *  같은 사실을 두 화면이 다른 낱말로 부르지 않게 하려면 판정도 하나여야 한다. */
export const scanRow = (scan: Settled<ScanJob | null>): StatusRow => {
  if (!scan.ok) return rejected(OPS_TAB_SLUGS.scan, OPS_TAB_SLUGS.scan);
  const job = scan.value;
  if (!job) {
    return { name: OPS_TAB_SLUGS.scan, tab: OPS_TAB_SLUGS.scan, mark: 'idle', value: '실행 없음', sub: null, failed: false };
  }
  const key = scanStateKey(job);
  const state = SCAN_STATE[key];
  // 리소스 합계는 성공한 스캔에만 있다 — 없으면 그 조각이 빠질 뿐 시각은 남는다.
  const counts = job.resource_count_by_resource_type;
  const total = counts ? Object.values(counts).reduce<number>((sum, n) => sum + (n ?? 0), 0) : null;
  return {
    name: OPS_TAB_SLUGS.scan,
    tab: OPS_TAB_SLUGS.scan,
    // enum 밖의 값은 성공으로도 실패로도 세지 않는다.
    mark: state ? SCAN_MARK[state.tone] : 'unknown',
    value: state?.label ?? '알 수 없음',
    sub: [at(job.updated_at ?? job.created_at), total === null ? null : `리소스 ${total}개`]
      .filter(Boolean)
      .join(' · ') || null,
    failed: false,
  };
};

const tcRow = (tc: Settled<TcLatest | null>): StatusRow => {
  if (!tc.ok) return rejected(OPS_TAB_SLUGS.tc, OPS_TAB_SLUGS.tc);
  const latest = tc.value;
  if (!latest) {
    return { name: OPS_TAB_SLUGS.tc, tab: OPS_TAB_SLUGS.tc, mark: 'idle', value: '실행 없음', sub: null, failed: false };
  }
  // 실행 한 건의 상태 — 어휘는 실행 기록 표와 한 벌이다 (`runStatus`).
  const status = runStatus(latest);
  const spec: Record<ReturnType<typeof runStatus>, { mark: RowMark; value: string }> = {
    SUCCESS: { mark: 'ok', value: '성공' },
    FAIL: { mark: 'err', value: '실패' },
    RUNNING: { mark: 'run', value: '진행 중' },
    PENDING: { mark: 'run', value: '대기 중' },
    UNKNOWN: { mark: 'unknown', value: '알 수 없음' },
  };
  const version = latest.test_connection_version;
  return {
    name: OPS_TAB_SLUGS.tc,
    tab: OPS_TAB_SLUGS.tc,
    ...spec[status],
    sub: [at(latest.completed_at ?? latest.requested_at), version == null ? null : `${version}회차`]
      .filter(Boolean)
      .join(' · ') || null,
    failed: false,
  };
};

const infraRow = (terraform: Settled<TerraformStatus>): StatusRow => {
  if (!terraform.ok) return rejected(OPS_TAB_SLUGS.infra, OPS_TAB_SLUGS.infra);
  const tasks = terraform.value.tasks ?? [];
  const base = { name: OPS_TAB_SLUGS.infra, tab: OPS_TAB_SLUGS.infra, failed: false };
  /** 조회 시각은 **읽을 값이 있을 때만** 붙는다 — 아무것도 안 돈 행에서 「언제 봤는지」는
   *  그 자리에 답이 없다는 사실에 아무것도 더하지 않는다 (오너 2026-08-30). */
  const checked = at(terraform.value.checked_at);
  const sub = checked ? `조회 ${checked}` : null;
  // 조합 상태(`overall_state`)는 쓰지 않는다 — 어느 작업이 걸렸는지 못 말하기 때문에
  // 인프라 작업 탭이 이미 그것을 버렸다 (InfraStatusHead). 여기서는 세기만 한다.
  const tones = tasks.map((task) => metaOf(task.state).tone);
  const failed = tones.filter((tone) => tone === 'err').length;
  const running = tones.filter((tone) => tone === 'info').length;
  const applied = tones.filter((tone) => tone === 'ok').length;
  if (failed > 0) return { ...base, sub, mark: 'err', value: `${failed}개 실패` };
  if (running > 0) return { ...base, sub, mark: 'run', value: `${running}개 작업 중` };
  if (applied > 0) return { ...base, sub, mark: 'ok', value: `${applied}개 적용 완료` };
  // 작업 목록이 비었든(계약이 0건) 전부 NEVER_APPLIED 든 운영자에게는 같은 사실이다 —
  // 이 대상에서 Terraform 이 아직 한 번도 돌지 않았다. 「작업 없음」과 「미적용」을 갈라
  // 두면 아무도 행동을 달리할 수 없는 구분에 낱말 둘을 쓰게 된다 (오너 2026-08-30).
  return { ...base, sub: null, mark: 'idle', value: '인프라 작업 기록 없음' };
};

/** 같은 이유로 밖에서도 읽는다 (`scanRow` 주석 참고). */
export const confirmRow = (terraform: Settled<TerraformStatus>): StatusRow => {
  if (!terraform.ok) return rejected(OPS_TAB_SLUGS.confirm, OPS_TAB_SLUGS.confirm);
  const base = { name: OPS_TAB_SLUGS.confirm, tab: OPS_TAB_SLUGS.confirm, failed: false };
  const confirmed = terraform.value.has_confirmed_infra;
  if (confirmed === true) {
    return { ...base, mark: 'ok', value: '확정됨', sub: at(terraform.value.latest_confirmed_at) };
  }
  // 계약은 LOOSE 라 필드가 통째로 빠질 수 있다. **아는 false 만** 미확정이다 —
  // 없는 값을 false 로 접으면 모르는 것을 사실로 바꿔 말하게 된다.
  if (confirmed !== false) return { ...base, mark: 'unknown', value: '알 수 없음', sub: null };
  // 미확정은 정상 흐름의 한 자리다 — 그래서 색은 값에만 실리고 면을 물들이지 않는다.
  // ⛔ 「N단계 · 이름」을 여기 붙이지 않는다 (오너 2026-08-30): 마스트헤드 단계 태그가
  // 이미 말하는 것이고, 이 카드가 지우려던 중복이 그대로 돌아온다.
  return { ...base, mark: 'warn', value: '미확정', sub: null };
};

const AIRFLOW = 'Airflow';

const airflowRow = (dag: Settled<DagStatusResponse | null>): StatusRow => {
  if (!dag.ok) return rejected(AIRFLOW, OPS_TAB_SLUGS.airflow);
  const base = { name: AIRFLOW, tab: OPS_TAB_SLUGS.airflow, failed: false };
  // 아직 도는 DAG 가 없는 대상은 응답 자체가 없다 — 미도달이지 실패가 아니다.
  if (!dag.value) return { ...base, mark: 'idle', value: '기록 없음', sub: null };

  const verdict = healthVerdict(dag.value.healthStatus);
  // HEALTHY/UNHEALTHY 는 승인 조건 ③ 과 Airflow 확인 탭이 이미 화면 어휘로 굳힌 표기다.
  // 한 대상을 두 화면이 다른 낱말로 부르면 안 되므로 그대로 쓰고, 그 밖의 값만 미확인이다.
  if (verdict.kind === 'unknown') {
    return { ...base, mark: 'unknown', value: '미확인', sub: '판정할 수 없는 값' };
  }
  // 세는 줄도 같은 한 벌 — 확인 필요는 성공의 여집합이라 조건 카드와 수가 어긋나지 않는다.
  //
  // ⛔ 접기를 감싸는 이유: §10 은 DRAFT 라 `http.ts` 가 `raw: true` 로 **파싱 없이** 캐스팅해
  // 넘긴다. `agents` 나 `databaseStatuses` 가 빠진 200 이 오면 `aggregateDagStatus` 가
  // TypeError 를 던지는데, 여기는 Server Component 렌더 안이고 셸은 이미 나간 뒤라 그
  // throw 는 이 행이 아니라 **라우트 전체**를 에러로 만든다 (`app/admin/**` 에 error.tsx 도
  // 없다). 조회는 `settle` 이 감쌌지만 접기는 그 밖에 있었다.
  let agg;
  try {
    agg = aggregateDagStatus(dag.value);
  } catch (err) {
    console.warn('[ops/status] dag-status 응답의 모양이 계약과 다르다 — 판정하지 않는다', err);
    return { ...base, mark: 'unknown', value: '미확인', sub: '판정할 수 없는 값' };
  }
  const attention = agg.dbTotal - agg.succeeded;
  return {
    ...base,
    mark: verdict.kind === 'healthy' ? 'ok' : 'err',
    value: verdict.kind === 'healthy' ? 'HEALTHY' : 'UNHEALTHY',
    sub:
      agg.dbTotal === 0
        ? null
        : attention === 0
          ? `논리 DB ${agg.dbTotal}개 전부 성공`
          : `논리 DB ${agg.dbTotal}개 · ${attention}개 확인 필요`,
  };
};

export function statusRows(input: StatusInputs): StatusRow[] {
  const rows = [
    scanRow(input.scan),
    tcRow(input.tc),
    infraRow(input.terraform),
    confirmRow(input.terraform),
    airflowRow(input.dag),
  ];
  // IDC 는 손으로 등록하는 대상이라 훑을 계정이 없다 — 탭 줄이 「스캔」을 빼는 것과
  // 같은 술어로 행도 뺀다. 남기면 영영 「실행 없음」인 행이 하나 선다.
  return input.isIdc ? rows.filter((row) => row.tab !== OPS_TAB_SLUGS.scan) : rows;
}
