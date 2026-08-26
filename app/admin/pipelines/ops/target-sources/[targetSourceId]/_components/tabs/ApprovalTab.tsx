'use client';

/**
 * 관리자 승인 tab — the process branch this target's Step 6 exists for.
 *
 * 이 탭은 판정만 한다 — 결정 카드(헤드+CTA) 아래 승인 조건 세 장이 각자 카드로 선다. 조건마다
 * "상세보기"가 그 조건을 판정한 근거의 탭으로 보낸다(② 연결 테스트, ③ Airflow 확인).
 * 근거를 여기서 다시 그리지 않는 이유는 표가 두 벌이 되기 때문만이 아니다: 저 탭들은
 * 읽기 말고 할 수 있는 일(제외 정책·Credential·재실행)도 갖고 있어서, 잠긴 조건을 풀러
 * 가는 곳과 근거를 보러 가는 곳이 같은 화면이 된다.
 *
 * Flow: 서비스가 5단계(연결 테스트)에서 완료 승인 요청(PUT
 * …/test-connection-acknowledgment)을 보내면 Step 5 → 6 으로 넘어오고, 관리자가 내리는
 * 결정은 여기서 하나뿐이다 —
 *   PII Agent 설치 완료 POST …/pii-agent-installation/confirm  (연동 확정)
 * 되돌림(재실행 요청)은 오너 지시로 이 탭에서 내렸다 (2026-08-25).
 *
 * THREE conditions gate the approve CTA (the 승인 조건 checklist states all three):
 *   ① 서비스 완료 승인 요청 (status = TEST_CONNECTION_COMPLETED)
 *   ② 최신 연결 테스트 결과 SUCCESS (allowlist — approvalGate.ts)
 *   ③ 모니터링 헬스 HEALTHY (assumed §10 dag-status, allowlist — approvalGate.ts)
 *
 * 아이콘 문법: 판정 아이콘(✓·✗·○)은 승인 조건 행의 것이고, 이제 세 조건이 전부 게이트라
 * 실패 행의 ✗ 는 실제로 "승인 불가"를 뜻한다. "완료·승인"은 사람의 행위(인수인계)에만,
 * "성공·실패"는 테스트 결과에만 쓴다.
 */
import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTimeSec } from '@/lib/pipeline/format';
import { useApiAction } from '@/app/hooks/useApiMutation';
import { confirmInstallation, type TcResultRow } from '@/app/lib/api/task-queue-tc';
import type { TestConnectionVersionResult } from '@/app/lib/api';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import type { TestConnectionStatusRow } from '@/lib/types/task-queue';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { TcApproveModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcActionModals';
import { TcPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import {
  runStatus,
  tcResultStats,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';
import {
  TC_COMPLETED,
  TC_REJECTED,
  aggregateDagStatus,
  foldApprovalHead,
  healthVerdict,
  monitoringEvidenceHead,
  showsHandoffCaption,
  tcRunGate,
  type DagFetch,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/approvalGate';

const n = (value: number): string => value.toLocaleString('ko-KR');

type GateRowState = 'ok' | 'err' | 'warn' | 'pending';

/** 카드 라벨의 번호 — 원문자(①)는 12px 에서 ⓘ 로 읽혀 못 쓴다(브라우저 실측). */
const GATE_ORDINALS = [1, 2, 3] as const;

/**
 * One 승인 조건 — 카드 한 장.
 *
 * 세 조건이 한 상자 안에 `divide-y` 로 붙어 있던 동안에는 세 판정이 한 덩어리로 읽혔다
 * (오너 2026-08-26: "답답해"). 조건은 저마다 다른 화면이 판정하고 저마다 따로 풀리므로,
 * 각자 자기 카드에 서고 카드 사이는 페이지의 간격(`opsStyles.content` 의 gap-4)이 벌린다.
 * 카드 넷은 감싸는 상자 없이 콘텐츠 열 바닥에 그대로 깔린다.
 *
 * 카드 안 순서: 라벨(승인 조건 1) ▸ 판정문 ▸ 근거·조회 시각. 판정문은 이제 카드의 제목
 * 자리라 한 단 올라가고(14 → 16), 근거 줄도 따라 한 단 오른다(12 → 14) — 상자 안 행이
 * 아니라 카드 본문이 됐으므로. 아이콘은 판정문 줄에 붙는다: 두 줄 블록의 가운데로 내려오면
 * 어느 줄을 판정하는 것인지 흐려진다.
 */
function GateCard({
  ordinal,
  state,
  text,
  suffix,
  titleHint,
  meta,
  onNavigate,
}: {
  /** 조건 번호 — 카드가 셋으로 흩어져도 순서(①②③)는 카드 자신이 진다. */
  ordinal: (typeof GATE_ORDINALS)[number];
  state: GateRowState;
  text: string;
  suffix?: ReactNode;
  /** Debug-tier raw value (wire vocabulary) — tooltip only, never in the copy. */
  titleHint?: string;
  meta?: string;
  /** "상세보기" — 이 조건을 판정한 근거가 사는 탭으로 보낸다. */
  onNavigate?: () => void;
}): ReactElement {
  const icon =
    state === 'ok' ? (
      <Icon name="check-circle" size={18} className="text-[var(--pl-ok-text)]" />
    ) : state === 'err' ? (
      <Icon name="x-circle" size={18} className="text-[var(--pl-err-text)]" />
    ) : state === 'warn' ? (
      <Icon name="warn-tri" size={18} className="text-[var(--pl-warn-text)]" />
    ) : (
      <span aria-hidden className="block h-[18px] w-[18px] rounded-full border-2 border-[var(--pl-border-strong)]" />
    );
  return (
    <section className={pipelineStyles.card.base} aria-label={`승인 조건 ${ordinal}`}>
      <p className="text-[12px] font-semibold text-[var(--pl-text-weak)]">승인 조건 {ordinal}</p>
      <div className="mt-2 flex items-start gap-2.5">
        <span className="mt-px flex-none">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold text-[var(--pl-text-strong)]" title={titleHint}>
            {text}
          </p>
          {(suffix || meta) && (
            <p className="mt-1.5 text-[14px] leading-[1.5] text-[var(--pl-text-weak)]">
              {suffix}
              {suffix && meta && ' · '}
              {meta && <span className="tabular-nums">{meta}</span>}
            </p>
          )}
        </div>
        {onNavigate && (
          <button
            type="button"
            onClick={onNavigate}
            className="mt-0.5 flex flex-none cursor-pointer items-center gap-0.5 text-[14px] font-semibold text-[var(--pl-primary)] hover:underline"
          >
            상세보기
            <Icon name="chev-r" size={14} />
          </button>
        )}
      </div>
    </section>
  );
}

export interface ApprovalTabProps {
  targetSourceId: number;
  detail: RawTargetSourceDetail;
  /** Service acknowledgment row — gate ① (fetched by the page). */
  status: TestConnectionStatusRow | null;
  /** 최신 실행 — 회차·상태·시각 + 리소스별 판정 (fetched by the page; 404 → null). */
  latest: TestConnectionVersionResult | null;
  /** latest fetch 실패 (404 는 실패가 아니다) — null 이 '이력 없음'인지 '모름'인지 가른다. */
  latestFailed: boolean;
  /** TC 세 응답이 도착했는가 — 도착 전의 null 을 '이력 없음'으로 읽지 않기 위해. */
  tcLoaded: boolean;
  /** status 조회가 404 아닌 이유로 거절됐는가 — 조회 실패 ≠ 미요청. */
  statusFailed: boolean;
  /** 리소스별 논리 DB 건수 (latest-results; fetched by the page). */
  results: readonly TcResultRow[];
  /** §10 dag-status — fetched once by the page and shared with Airflow 확인. */
  dag: DagFetch;
  /** Both outcomes change the target's step, so the whole page reloads. */
  onDecided: () => void;
  /** "연결 테스트 탭에서 관리" — 쓰기(제외 정책·Credential·재실행)는 그 탭의 것. */
  onOpenTcTab: () => void;
  /** 조건 ③ 의 "상세보기" — 모니터링 근거 전부는 Airflow 확인 탭이 갖는다. */
  onOpenAirflowTab: () => void;
}

export function ApprovalTab({
  targetSourceId,
  detail,
  status,
  latest,
  latestFailed,
  tcLoaded,
  statusFailed,
  results,
  dag,
  onDecided,
  onOpenTcTab,
  onOpenAirflowTab,
}: ApprovalTabProps): ReactElement {
  const toast = usePlToast();
  const [approveOpen, setApproveOpen] = useState(false);

  const tcCompleted = status?.status === TC_COMPLETED;
  const isRejected = status?.status === TC_REJECTED;

  // 조건 ② 줄이 읽는 판정 — 페이지가 내려준 두 응답을 여기서 접는다 (연결 테스트
  // 탭과 같은 fold 라 합계가 두 탭에서 갈라지지 않는다).
  const stats = useMemo(() => tcResultStats(results, latest), [results, latest]);
  const run = runStatus(latest);

  // 모니터링 판정의 집계 — 조건 ③ 줄이 읽는 한 벌(본문은 Airflow 확인 탭의 것).
  const agg = useMemo(
    () => (dag.phase === 'loaded' ? aggregateDagStatus(dag.data) : null),
    [dag],
  );
  const monHead = monitoringEvidenceHead(dag, agg);

  const approve = useApiAction(() => confirmInstallation(targetSourceId), {
    onSuccess: () => {
      setApproveOpen(false);
      toast.show('PII Agent 설치를 완료 처리했습니다.');
      onDecided();
    },
    onError: () => toast.show('설치 완료 처리에 실패했습니다.'),
  });

  // 조건 ② 의 보조 줄 — 회차·시각과, 성공분이 있을 때만 논리 DB 합계. 합계는 연결
  // 테스트 탭의 셀과 같은 fold(ldbCount 게이트)라 두 화면이 갈라지지 않는다.
  const tcSubtitle = ((): string | null => {
    if (!latest) return null;
    const parts: string[] = [];
    const round = latest.test_connection_version != null ? `${latest.test_connection_version}회차` : '';
    const at = latest.completed_at ?? latest.requested_at;
    const identity = [round, at ? fmtDateTimeSec(at) : ''].filter(Boolean).join(' ');
    if (identity) parts.push(identity);
    if (stats.successCount > 0) {
      parts.push(`연동 대상 논리 DB ${n(stats.includedTotal)}`);
      parts.push(`제외 ${n(stats.excludedTotal)}`);
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  })();

  // 도착 전에는 아무 사실도 말하지 않는다 — 로딩 중의 null 을 '이력 없음'으로 읽으면
  // 체크리스트가 한 프레임 동안 거짓을 단정한다.
  const gate = tcLoaded ? tcRunGate(run, latest !== null, latestFailed) : 'loading';
  const head = foldApprovalHead(status?.status, statusFailed, gate, dag);

  // 승인 조건 row ① — 도착 전 · 조회 실패 · 미요청 · 요청됨. 문장은 조건이 충족됐을
  // 때만 완료형이 되고, 나머지 셋은 같은 미충족 문장에 이유만 갈아 끼운다.
  const PENDING_ACK = '서비스가 연결 테스트 완료 승인을 요청하면 충족됩니다';
  const ackRow = ((): {
    state: GateRowState;
    text: string;
    suffix?: ReactNode;
    meta?: string;
  } => {
    if (!tcLoaded) return { state: 'pending', text: PENDING_ACK, suffix: '확인 중…' };
    if (statusFailed)
      return { state: 'err', text: PENDING_ACK, suffix: '완료 승인 상태를 불러오지 못했습니다' };
    if (tcCompleted)
      return {
        state: 'ok',
        text: '서비스가 연결 테스트 완료 승인을 요청했습니다',
        meta: fmtDateTimeSec(status?.completedAt),
      };
    return {
      state: 'pending',
      text: PENDING_ACK,
      // C-1 조건부 캡션 — "테스트 성공 + 미요청" 상태에서만. 강조는 굵기와 색으로
      // 지고, 문장은 짧게 둘로 나눈다 (오너 08-20).
      suffix: showsHandoffCaption(status?.status, run) ? (
        <>
          연결 테스트가 성공해도 이 조건은 자동으로 충족되지 않습니다. 서비스 담당자가{' '}
          <b className="font-semibold text-[var(--pl-text-strong)]">
            5단계 연결 테스트에서 승인 요청
          </b>
          을 눌러야 합니다.
        </>
      ) : undefined,
    };
  })();

  // 승인 조건 row ③ — the checklist carries the "why", the CTA stays unmounted.
  // 근거 문장은 모니터링 근거의 fold 그대로 빌린다 — 조건 줄과 Airflow 확인 탭이
  // 같은 응답을 다른 낱말로 부르면 안 된다.
  const healthRow = ((): {
    state: GateRowState;
    suffix: string | null;
    titleHint?: string;
    meta?: string;
  } => {
    if (!tcLoaded) return { state: 'pending', suffix: '확인 중…' };
    if (!tcCompleted) return { state: 'pending', suffix: '완료 승인 후 점검합니다' };
    switch (dag.phase) {
      case 'loading':
        return { state: 'pending', suffix: monHead.subtitle };
      case 'failed':
        return { state: 'err', suffix: monHead.subtitle };
      case 'loaded': {
        const verdict = healthVerdict(dag.data.healthStatus);
        const meta = `조회 ${fmtDateTimeSec(dag.fetchedAt)}`;
        const state: GateRowState =
          verdict.kind === 'healthy' ? 'ok' : verdict.kind === 'unhealthy' ? 'err' : 'warn';
        return { state, suffix: monHead.subtitle, titleHint: monHead.titleHint, meta };
      }
    }
  })();

  // 승인 조건 row ② — 최신 실행의 판정. 잠그는 이유는 갈라 말한다(이력 없음 ≠ 조회 실패).
  const runRow = ((): { state: GateRowState; suffix: string | null; titleHint?: string } => {
    switch (gate) {
      case 'success':
        return { state: 'ok', suffix: tcSubtitle };
      case 'failed':
        return {
          state: 'err',
          suffix: [stats.failedCount > 0 ? `연결 실패 ${n(stats.failedCount)}` : '', tcSubtitle]
            .filter(Boolean)
            .join(' · '),
        };
      case 'open':
        return { state: 'pending', suffix: ['진행 중', tcSubtitle].filter(Boolean).join(' · ') };
      case 'loading':
        return { state: 'pending', suffix: '확인 중…' };
      case 'none':
        return { state: 'pending', suffix: '연결 테스트 실행 기록이 없습니다' };
      case 'error':
        return { state: 'err', suffix: '실행 정보를 불러오지 못했습니다' };
      case 'unknown':
        // Raw enum value stays in the tooltip channel — not in the copy.
        return {
          state: 'warn',
          suffix: '판정할 수 없는 값',
          titleHint: `connection_status: ${latest?.connection_status ?? ''}`,
        };
    }
  })();

  return (
    <>
      <section className={pipelineStyles.card.base} aria-label="관리자 승인">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className={cn(opsStyles.cardTitle, 'flex items-center gap-2')}>
              <Icon name="check" size={18} className="text-[var(--pl-primary)]" />
              관리자 승인
              <TcPill tone={head.pill.tone} label={head.pill.label} />
            </h2>
            <p className={opsStyles.cardDesc}>{head.desc}</p>
          </div>
          {head.canApprove && (
            <div className="flex-none">
              <PlButton variant="primary" onClick={() => setApproveOpen(true)}>
                PII Agent 설치 완료
              </PlButton>
            </div>
          )}
        </div>

        {isRejected && (
          <div className="mt-4 rounded-lg bg-[var(--pl-gray-50)] px-3.5 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-[var(--pl-text-weak)]">
                재실행 요청
              </span>
              <span className="text-[12px] tabular-nums text-[var(--pl-text-weak)]">
                {fmtDateTimeSec(status?.rejectedAt)}
              </span>
            </div>
            {status?.rejectReason && (
              <p className={cn(pipelineStyles.text.body, 'mt-2')}>{status.rejectReason}</p>
            )}
          </div>
        )}
      </section>

      {/* 왜 CTA 가 없는지는 이 세 카드가 말한다 — 버튼은 전 조건 충족 시에만 마운트하는
          현행 문법 유지 ("죽은 버튼 금지").

          근거는 어느 조건도 이 자리에서 펼치지 않는다 — 판정을 만든 화면이 이미 따로 있고,
          그 화면은 읽기 말고 할 수 있는 일(제외 정책·Credential·재실행)도 갖고 있다.
          여기서 한 번 더 그리면 같은 표가 두 벌이 된다. */}
      <GateCard
        ordinal={GATE_ORDINALS[0]}
        state={ackRow.state}
        text={ackRow.text}
        suffix={ackRow.suffix}
        meta={ackRow.meta}
      />
      <GateCard
        ordinal={GATE_ORDINALS[1]}
        state={runRow.state}
        text="최신 연결 테스트 결과가 성공입니다"
        suffix={runRow.suffix}
        titleHint={runRow.titleHint}
        onNavigate={onOpenTcTab}
      />
      <GateCard
        ordinal={GATE_ORDINALS[2]}
        state={healthRow.state}
        // 조건은 계약이 쓰는 말이 아니라 이 조건이 지키는 사실로 부른다 (오너 2026-08-25):
        // `모니터링 헬스가 HEALTHY 상태입니다` 는 관리자에게 healthStatus 라는 필드를 먼저
        // 배우게 했다. 판정의 출처(enum)는 suffix 의 툴팁 채널에 그대로 남는다.
        //
        // ⛔ 스코프('최근 7일 DAG 실행')를 떼지 말 것. §10 은 healthStatus 의 산식을 BE 미회신
        // 열린 질문으로 두면서 "UI copy stops at 최근 7일 DAG 실행 기준" 이라고 못박는다. 이
        // 줄은 설치 완료 승인 CTA 를 여는 세 조건 중 하나라, 스코프를 떼면 우리가 모르는
        // 산식 위에서 "DAG 가 정상 동작한다"고 단언하게 된다. 산식이 회신되면 그때 넓힌다.
        text="최근 7일 DAG 실행이 정상입니다"
        suffix={healthRow.suffix}
        titleHint={healthRow.titleHint}
        meta={healthRow.meta}
        onNavigate={onOpenAirflowTab}
      />

      <TcApproveModal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        targetSourceId={targetSourceId}
        serviceName={detail.service_name ?? '이 서비스'}
        stats={stats}
        onSubmit={() => void approve.execute()}
        submitting={approve.loading}
      />
    </>
  );
}
