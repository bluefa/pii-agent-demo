'use client';

/**
 * 연결 테스트 카드 — 이 탭의 카드 한 장. 집계는 밴드로, 사실은 표로.
 *
 * 카드는 하나다 (오너 2026-08-25). 밴드와 확정 정보 표는 같은 실행을 집계로 한 번,
 * 리소스별 사실로 한 번 말하는 것이라 제목·테두리·여백을 두 벌 두면 두 화면처럼 읽힌다.
 * 그래서 이 파일이 카드 껍데기(제목·설명·목록 링크)를 들고, 표는 `children` 으로 받아
 * 밴드 아래 같은 면 위에 선다.
 *
 * 이 밴드는 사용자 화면 Step 5 의 연결 테스트 카드(`TcSummaryCard`)를 이 콘솔의 팔레트로
 * 옮긴 것이다. 문장·버킷·경과는 판정 로직을 나누지 않고 `lib/test-connection-summary`
 * 한 벌을 그대로 쓴다 — 두 화면이 같은 실행을 다른 낱말로 부르면 운영자와 서비스가 같은
 * 실행을 보고 다른 말을 하게 된다. 색만 `opsStyles.tcBand` 로 갈아입는다.
 *
 * 밴드가 층으로 말하는 순서:
 *   면·글리프·문장   지금 어떤 국면인가
 *   시각 서브라인     언제의 실행인가 · 얼마나 걸렸나/기다렸나
 *   곁줄             실패 사유 · Credential 미설정 (다음 실행을 막는 것)
 *   트랙             진행 중에만
 *   카운트 · 슬롯     판정 분포 · 이 국면에서 할 수 있는 한 가지
 *   승인 요청 줄      서비스가 그 판정으로 무엇을 했는가
 *
 * 예전 이 카드는 헤더 우상단에 실행 버튼을 상시로 두고 그 아래에 진행/집계를 따로 그렸다.
 * 상태와 행동이 서로 다른 자리에 흩어져 있어 "지금 눌러도 되는 버튼인가"를 화면이 답하지
 * 못했다 — Step 5 가 시안 A 로 푼 그 문제라 같은 답(상태가 CTA 를 고르는 슬롯 하나)을 쓴다.
 *
 * 회차 번호(#N)는 여기 없다 — 회차는 그것을 세는 표(실행 기록 모달)가 가진다.
 *
 * Credential 목록은 조회다 — 상태가 아니라 가끔 묻는 질문이라 카드 머리의 텍스트 버튼이
 * 모달로 연다(오너 2026-08-25). 채운 버튼이던 것을 텍스트로 낮춘 이유도 같다: 이 카드에서
 * 채워도 되는 버튼은 실행 CTA 하나다.
 *
 * Source is `GET …/test-connection/latest_version` (TestConnectionVersionResult).
 * 404 는 오류가 아니라 "최신 연결 테스트 없음" 이라 `latest === null` 로 들어온다.
 * Pure view — polling, paging and the run trigger live in TcTab.
 */
import type { ReactElement, ReactNode } from 'react';
import { cn, idcStyles, pipelineStyles } from '@/lib/theme';
import { fmtDateTimeSec } from '@/lib/pipeline/format';
import { tcElapsedLabel, type TcBuckets } from '@/lib/test-connection-summary';
import { useNowTick } from '@/app/hooks/useNowTick';
import {
  ActivityIcon,
  CheckIcon,
  CircleXIcon,
  ClockIcon,
  HourglassIcon,
  StatusWarningIcon,
} from '@/app/components/ui/icons';
import type { TestConnectionVersionResult } from '@/app/lib/api';
import type { TestConnectionStatusRow } from '@/lib/types/task-queue';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { TcPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import { failReasonView } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/failReason';
import {
  ackIsStale,
  bandSentence,
  runBandPhase,
  runFailReason,
  type TcBandPhase,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

/**
 * 시각 옆 이력 링크 — countLink 규칙을 meta 크기로: 밑줄이 affordance 를 지고 색은
 * 중립이다. 이 밴드에서 색을 쓸 수 있는 것은 판정(면·제목·글리프)과 실행 CTA 뿐이다.
 */
const META_LINK =
  'cursor-pointer border-b border-current pb-px text-[12px] font-medium text-[var(--pl-text-weak)] transition-colors hover:text-[var(--pl-text-strong)]';

const COMPLETED = 'TEST_CONNECTION_COMPLETED';
const REJECTED = 'TEST_CONNECTION_REJECTED';

/** queued 는 running 과 같은 면·잉크를 쓴다 — 경고가 아니라 정상 단계라, 둘은 글리프와 문장이 가른다. */
const surfaceOf = (phase: TcBandPhase): Exclude<TcBandPhase, 'queued'> =>
  phase === 'queued' ? 'running' : phase;

export interface TcLatestRunCardProps {
  /** 최신 실행 — 404(연결 테스트 이력 없음)면 null. */
  latest: TestConnectionVersionResult | null;
  /** Service acknowledgment row — null when the service has not requested approval. */
  status: TestConnectionStatusRow | null;
  /** 확정 단위 기준 판정 분포 (Step 5 와 같은 접기·버킷 규칙). */
  buckets: TcBuckets;
  /**
   * Credential 이 필요한데 배정되지 않은 단위 수 — 0 이면 곁줄이 서지 않는다.
   * 0 이 아니면 실행 CTA 가 잠긴다(오너 2026-08-25). IAM 으로 붙는 엔진(Athena·
   * DynamoDB·CosmosDB·BigQuery)은 애초에 이 수에 들지 않으므로 잠금의 사유가 되지 않는다.
   */
  credentialMissing: number;
  /** 확정 정보 표가 지금 미설정 단위만 보고 있는가 (곁줄의 토글이 소유). */
  credFilterOn: boolean;
  onToggleCredFilter: () => void;
  /** latest_version fetch still in flight. */
  loading: boolean;
  /** latest_version fetch failed (404 는 실패가 아니다). */
  failed: boolean;
  /**
   * 승인 요청 상태(status) 조회가 실패했다. 미요청과 같은 픽셀이면 안 된다 —
   * 침묵은 "아직 안 눌렀다"로 읽히는데 그건 우리가 확인하지 못한 사실이다.
   */
  statusFailed: boolean;
  /** Page-level TC fetch has settled at least once. */
  statusLoaded: boolean;
  running: boolean;
  triggering: boolean;
  triggerFailed: boolean;
  onRunTest: () => void;
  /** status·latest 재조회 — 승인 요청 줄의 조회 실패에서 유일한 출구. */
  onReloadStatus: () => void;
  /** 실행 기록 modal — 회차 목록. */
  onOpenRunHistory: () => void;
  /** 승인·반려 이력 modal — 서비스 측 승인 요청·재실행 요청 trail. */
  onOpenDecisionHistory: () => void;
  /** Credential 목록 modal — 카드 머리의 텍스트 버튼이 연다. */
  onOpenCredentials: () => void;
  /** 확정 정보 표 — 밴드·승인 요청 줄 아래, 같은 카드 안. */
  children: ReactNode;
}

/** 곁줄 하나 — 글리프 · 본문 · (우측 액션). 상자가 아니라 맨 줄이다. */
function BandNote({ tone, children }: { tone: 'warn' | 'weak'; children: ReactNode }): ReactElement {
  const b = opsStyles.tcBand;
  return (
    <span className={cn(b.note, tone === 'warn' ? b.noteWarn : b.noteWeak)}>
      {/* 경고를 색만으로 말하지 않는다(WCAG 1.4.1) — 마크가 색 없이도 같은 뜻을 진다. */}
      <StatusWarningIcon className="mt-0.5 h-4 w-4 flex-none" />
      {children}
    </span>
  );
}

/**
 * TargetSource 사유 줄 — "사유 · 라벨 · 원문 enum". 목록 밖의 값은 라벨 없이 원문만
 * 중립으로(허용 목록 규칙). 판정의 적색은 면과 제목이 이미 말했으므로 여기선 중립이다.
 */
function RunReasonNote({ raw }: { raw: string }): ReactElement | null {
  const view = failReasonView(raw);
  if (!view) return null;
  const b = opsStyles.tcBand;
  return (
    <BandNote tone="weak">
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-semibold">사유</span>
        {view.label ? (
          <>
            <span title={view.desc ?? undefined}>{view.label}</span>
            <span className={cn(pipelineStyles.text.mono, b.noteRaw)}>{view.raw}</span>
          </>
        ) : (
          <span className={pipelineStyles.text.mono}>{view.raw}</span>
        )}
      </span>
    </BandNote>
  );
}

/** 국면 글리프. `unknown` 은 판정을 보류하는 자리라 경고 삼각형이 아니라 시계로 둔다. */
function PhaseGlyph({ phase }: { phase: TcBandPhase }): ReactElement {
  switch (phase) {
    case 'success':
      return <CheckIcon className="h-[18px] w-[18px]" />;
    case 'fail':
      return <CircleXIcon className="h-[18px] w-[18px]" />;
    case 'queued':
      // 모래시계 — 모션은 글리프에 내장이라 여기선 크기만 준다. 시계는 `idle`(실행 자체가
      // 없음)의 글리프라, 대기가 같은 시계를 쓰면 두 사실이 한 그림이 된다.
      return <HourglassIcon className="h-[18px] w-[18px]" />;
    case 'running':
      // 파형 — 도는 시계와 달리 형태부터 다르고, 모션이 꺼져도 트랙이 남는다.
      return <ActivityIcon className="h-[18px] w-[18px]" />;
    default:
      return <ClockIcon className="h-[18px] w-[18px]" />;
  }
}

/** 밴드 자리의 스켈레톤 — 최종 레이아웃(문장·서브라인·카운트·슬롯)을 그대로 그린다. */
function BandSkeleton(): ReactElement {
  const b = opsStyles.tcBand;
  return (
    <div className={cn(b.base, b.surface.idle)} aria-busy="true" aria-live="polite">
      <div className={cn(b.head, 'flex-col items-start')}>
        <span className={cn(opsStyles.skeletonBar, 'block h-[17px] w-[210px]')} aria-hidden="true" />
        <span className={cn(opsStyles.skeletonBar, 'block h-[13px] w-[130px]')} aria-hidden="true" />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className={cn(opsStyles.skeletonBar, 'block h-[13px] w-[150px]')} aria-hidden="true" />
        <span className={cn(opsStyles.skeleton, 'block h-8 w-[112px]')} aria-hidden="true" />
      </div>
    </div>
  );
}

export function TcLatestRunCard({
  latest,
  status,
  buckets,
  credentialMissing,
  credFilterOn,
  onToggleCredFilter,
  loading,
  failed,
  statusFailed,
  statusLoaded,
  running,
  triggering,
  triggerFailed,
  onRunTest,
  onReloadStatus,
  onOpenRunHistory,
  onOpenDecisionHistory,
  onOpenCredentials,
  children,
}: TcLatestRunCardProps): ReactElement {
  const b = opsStyles.tcBand;
  // 조회에 실패했으면 국면을 아는 척하지 않는다 — idle 표면은 "아직 실행한 적 없다"는
  // 판정이고, 그건 우리가 확인하지 못한 사실이다.
  const fetchLost = failed && !latest;
  const phase: TcBandPhase = fetchLost ? 'unknown' : runBandPhase(latest);
  const surface = surfaceOf(phase);
  const sentence = fetchLost ? '실행 정보를 불러오지 못했습니다' : bandSentence(phase, buckets);
  const settled = phase === 'success' || phase === 'fail';
  const inFlight = phase === 'queued' || phase === 'running';
  const reason = runFailReason(latest);

  // 아직 끝나지 않은 실행의 경과는 브라우저의 지금으로 잰다 — 계약에 진행률도 예상 소요도
  // 없으므로(requested_at / completed_at 뿐) 이 밴드가 정직하게 셀 수 있는 유일한 수다.
  // 폴이 4초라, 이 숫자가 없으면 폴 사이에 스스로 변하는 픽셀이 글리프 하나뿐이다.
  const now = useNowTick(inFlight && !!latest?.requested_at);

  const metaParts: string[] = [];
  if (settled && latest?.completed_at) {
    metaParts.push(`${fmtDateTimeSec(latest.completed_at)} 완료`);
    const elapsed = tcElapsedLabel(latest.requested_at, latest.completed_at);
    if (elapsed) metaParts.push(`소요 ${elapsed}`);
  } else if (inFlight && latest?.requested_at) {
    metaParts.push(`${fmtDateTimeSec(latest.requested_at)} 요청`);
    const waited = tcElapsedLabel(latest.requested_at, now);
    if (waited) metaParts.push(`${waited} 경과`);
  }

  // 판정이 하나도 없는 국면(미실행·시작 대기·조회 실패, 그리고 보고 0건 정착)은 세지 않는다 —
  // "성공 0 · 실패 0 · 미보고 N" 은 판정이 없다는 사실만 세 번 반복한다.
  const noVerdict =
    phase === 'idle' || phase === 'queued' || fetchLost || (settled && buckets.reported === 0);
  const counts: { label: string; value: number; dot: string; ink?: string }[] = [];
  if (noVerdict) {
    // 조회에 실패했으면 셀 대상조차 확인하지 못한 것이라 수를 말하지 않는다.
    if (!fetchLost) counts.push({ label: '대상 리소스', value: buckets.total, dot: b.countDotRest });
  } else {
    counts.push(
      { label: '성공', value: buckets.ok, dot: b.countDotOk, ink: b.okValue },
      { label: '실패', value: buckets.fail, dot: b.countDotFail, ink: b.failValue },
    );
    if (phase === 'running') {
      // 진행 중·대기·미보고는 이 국면의 독자에게 같은 한 사실이다 — 아직 답이 없다.
      // 정착한 실행에서는 접지 않는다: 그때 미보고는 실제 이상신호다.
      const rest = buckets.running + buckets.waiting + buckets.unreported;
      if (rest > 0) counts.push({ label: '남음', value: rest, dot: b.countDotRest });
    } else {
      if (buckets.running > 0)
        counts.push({ label: '진행 중', value: buckets.running, dot: b.countDotRest });
      if (buckets.waiting > 0)
        counts.push({ label: '대기', value: buckets.waiting, dot: b.countDotRest });
      if (buckets.unreported > 0)
        counts.push({ label: '미보고', value: buckets.unreported, dot: b.countDotMissing });
    }
    // 계약 밖 값은 어느 국면에서도 접지 않는다 — 보고는 됐는데 읽을 수 없다는 뜻이다.
    if (buckets.unknown > 0)
      counts.push({ label: '미확인', value: buckets.unknown, dot: b.countDotMissing });
  }

  // 바는 진행이지 결과가 아니다 — 진행 중에만 긋는다. 정착하면 그릴 진행이 남지 않고,
  // 100% 로 꽉 찬 두 색 띠는 바로 아래 카운트 줄이 이미 수로 말한 것을 형태로 반복한다.
  const showTrack = phase === 'running';
  const okPct = buckets.total > 0 ? (buckets.ok / buckets.total) * 100 : 0;
  const failPct = buckets.total > 0 ? (buckets.fail / buckets.total) * 100 : 0;

  // Credential 이 빠진 채로 도는 실행은 그 리소스에서 SECRET_NOT_FOUND 로 끝난다 — 결과가
  // 정해진 실행을 시작할 수 있게 두지 않는다(오너 2026-08-25). 서비스 화면 Step 5 도 같은
  // 게이트를 걸고 있어(`runDisabled = !canRunTest || !allCredsSet`) 두 화면이 같은 조건에서
  // 같은 답을 한다.
  //
  // ⛔ 이유 없이 잠긴 버튼은 만들지 않는다. 잠금의 사유는 카드 첫 줄의 경고가 이미 말하고
  //   있고(건수 + 도달 링크), 버튼 자신도 title 로 그 말을 진다.
  const credBlocked = credentialMissing > 0;
  const blockedHint = credBlocked
    ? `Credential 미설정 ${credentialMissing}건 — 지정해야 연결 테스트를 실행할 수 있습니다`
    : undefined;

  // 슬롯 — 한 시점에 primary 하나. 관리자에게 이 밴드의 행동은 늘 "돌린다" 하나이고,
  // 승인·반려 결정은 탭 레일(TcDecisionActions)의 몫이라 여기 서지 않는다.
  const slot = ((): ReactElement => {
    if (triggering)
      return (
        <PlButton variant="secondary" size="sm" disabled>
          시작 중…
        </PlButton>
      );
    if (inFlight)
      return (
        <PlButton variant="secondary" size="sm" disabled>
          {phase === 'queued' ? '시작 대기…' : '진행 중…'}
        </PlButton>
      );
    // 성공한 실행에 남은 일은 서비스의 승인 요청이라, 여기서 다시 돌리는 것은 선택지지
    // 다음 행동이 아니다 — 그 하나만 한 단 낮춘다.
    return (
      <PlButton
        variant={phase === 'success' ? 'secondary' : 'primary'}
        size="sm"
        disabled={running || credBlocked}
        title={blockedHint}
        onClick={onRunTest}
      >
        {phase === 'idle' ? '연결 테스트 실행' : '다시 실행'}
      </PlButton>
    );
  })();

  return (
    <section className={pipelineStyles.card.base} aria-label="연결 테스트">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className={cn(opsStyles.cardTitle, 'flex items-center gap-2')}>
            {/* 사슬 — 이 카드가 검사하는 것이 곧 연결이다. */}
            <Icon name="link" size={18} className="text-[var(--pl-primary)]" />
            연결 테스트
          </h2>
          <p className={opsStyles.cardDesc}>
            확정된 리소스에 실제로 접속해 연동 가능 여부를 검증합니다. 리소스별 결과는 아래 표의
            연결 상태·실패 사유·Pod 로그 열에서 확인하고,{' '}
            <b className="font-semibold text-[var(--pl-primary)]">Credential 값을 클릭하면 배정을 수정</b>
            할 수 있습니다.
          </p>
        </div>
        {/* 텍스트 버튼 — 조회지 행동이 아니다. 밑줄이 affordance 를 지고 색은 중립이다. */}
        <button
          type="button"
          onClick={onOpenCredentials}
          className={cn(opsStyles.countLink, 'mt-1 flex-none whitespace-nowrap text-[14px]')}
        >
          Credential 목록
        </button>
      </div>

      {triggerFailed && (
        <p className="mt-4 rounded-lg bg-[var(--pl-err-bg)] px-3 py-2.5 text-[14px] text-[var(--pl-err-text)]">
          연결 테스트를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      )}

      {/* Credential 미설정 — 밴드 **위**, 카드의 첫 줄이다 (오너 2026-08-25).
          이것은 실행의 판정이 아니라 다음 실행의 전제라, 밴드 안에서 국면 문장 아래에 두면
          "모든 리소스가 연결에 성공했어요" 라는 초록 헤드라인에 딸린 각주처럼 읽힌다 —
          정작 그 성공은 배정된 리소스들만의 것이다. 밖으로 꺼내면 어느 국면에서도 같은
          자리에 서고, 카드를 연 사람이 판정보다 먼저 읽는다.
          0 건이면 줄 자체가 없다: 할 일이 없다는 말이 상시로 자리를 차지하지 않는다.
          줄의 링크가 곧 아래 표의 필터라 요약과 도달 수단이 한 물건이고, 실행을 잠그지는
          않는다 — 관리자 화면은 서비스가 막혔을 때의 우회로다. */}
      {credentialMissing > 0 && (
        <div className={b.cardNote}>
          <StatusWarningIcon className="mt-0.5 h-4 w-4 flex-none" />
          {/* 문안은 잠금의 사유다 — 예고("실패합니다")가 아니라 지금 무엇이 막혀 있고 무엇을
              하면 풀리는지. 어휘는 서비스 화면 Step 5 의 같은 줄 그대로다. */}
          <span className="break-keep">
            Credential 미설정 <b className="font-bold tabular-nums">{credentialMissing}건</b> —
            지정해야 연결 테스트를 실행할 수 있어요
          </span>
          <button
            type="button"
            onClick={onToggleCredFilter}
            aria-pressed={credFilterOn}
            className={b.noteAction}
          >
            {credFilterOn ? '전체 보기' : '미설정만 보기'}
          </button>
        </div>
      )}

      {loading && !latest ? (
        <BandSkeleton />
      ) : (
        <div className={cn(b.base, b.surface[surface])}>
          <div className={b.head}>
            <div className="flex min-w-0 flex-col gap-1">
              <div className={cn(b.title, b.titleColor[surface])}>
                <span className={cn(b.icon, b.accent[surface])}>
                  <PhaseGlyph phase={phase} />
                </span>
                {sentence}
              </div>
              {/* 서브라인은 제목의 18px 글리프 열을 그대로 써서 두 줄의 글 열이 맞는다. */}
              {metaParts.length > 0 && (
                <span className={b.meta}>
                  <span className={b.icon}>
                    <ClockIcon className="h-3 w-3" />
                  </span>
                  {metaParts.join(' · ')}
                </span>
              )}
              {/* 사유는 실패의 속성이다 — 값이 없으면 줄 자체가 없다. */}
              {(phase === 'fail' || phase === 'unknown') && reason && <RunReasonNote raw={reason} />}
            </div>
            {/* 실행이 한 번도 없으면 열어 볼 회차도 결정도 없다 — 빈 모달로 가는 입구는
                세우지 않는다(Step 5 의 `run ? historyAction : null` 과 같은 게이트). */}
            {latest && (
              <span className="flex flex-none items-center gap-3">
                <button type="button" onClick={onOpenRunHistory} className={META_LINK}>
                  실행 기록
                </button>
                <button type="button" onClick={onOpenDecisionHistory} className={META_LINK}>
                  승인·반려 이력
                </button>
              </span>
            )}
          </div>

          {showTrack && (
            <div className={b.track}>
              {/* 채움 아래 깔리는 행진 무늬 — 아직 답이 오지 않은 만큼만 드러나 흐른다.
                  채움이 저절로 덮어 주기를 기대하지 않고 `reported < total` 로 잠근다:
                  채움은 ok·fail 뿐인데 `reported` 에는 `unknown` 도 든다. */}
              {buckets.reported < buckets.total && (
                <div className={idcStyles.connProgress.trackMarch} aria-hidden="true" />
              )}
              <div className="absolute inset-y-0 left-0 flex w-full">
                <div className={b.fillOk} style={{ width: `${okPct}%` }} />
                <div className={b.fillFail} style={{ width: `${failPct}%` }} />
              </div>
            </div>
          )}

          <div className={cn('flex items-center justify-between gap-3', showTrack && 'mt-[9px]')}>
            <span className={b.counts}>
              {counts.map((part) => (
                <span key={part.label} className={b.countSeg}>
                  <span className={cn(b.countDot, part.dot)} />
                  {part.label}
                  <b className={cn(b.countValue, part.ink)}>{part.value}</b>
                </span>
              ))}
            </span>
            {slot}
          </div>
        </div>
      )}

      <AckRow
        status={status}
        latest={latest}
        loaded={statusLoaded}
        failedFetch={statusFailed}
        onReload={onReloadStatus}
      />

      {children}
    </section>
  );
}

/**
 * 서비스 승인 요청 줄 — 서비스 화면 5단계의 `승인 요청` 버튼이 눌렸는가.
 *
 * ⚠️ 이 줄은 **항상** 선다. 예전에는 완료/반려일 때만 그려서, 아무것도 없는 화면이
 * "아직 안 눌렀다"인지 "조회가 실패했다"인지 구분되지 않았다 — 침묵은 사실이 아니다.
 *
 * 어휘는 서비스 쪽 버튼 이름을 그대로 인용한다(`승인 요청`, Step 5 카드의 슬롯 CTA).
 * 관리자가 서비스에 안내할 때 화면에 없는 이름을 부르면 서로 다른 버튼을 찾게 된다.
 *
 * 실행의 판정이 아니라 **서비스가 그 판정으로 무엇을 했는가**라, 밴드 안이 아니라 그 밑에
 * 자기 등급으로 선다 — 틴트도 상자도 없이 헤어라인 하나로 갈린다.
 */
function AckRow({
  status,
  latest,
  loaded,
  failedFetch,
  onReload,
}: {
  status: TestConnectionStatusRow | null;
  latest: TestConnectionVersionResult | null;
  loaded: boolean;
  failedFetch: boolean;
  onReload: () => void;
}): ReactElement {
  const b = opsStyles.tcBand;
  const isCompleted = status?.status === COMPLETED;
  const isRejected = status?.status === REJECTED;
  const stampedAt = isCompleted ? status?.completedAt : isRejected ? status?.rejectedAt : null;
  // 승인 요청은 TargetSource 단위 한 건이라 새 실행이 시작돼도 남는다 — 지난 회차의
  // 도장을 이번 실행의 것처럼 그리지 않도록, 실행보다 오래됐으면 그렇게 말한다.
  const stale = ackIsStale(stampedAt, latest?.requested_at);
  const settledRow = loaded && !failedFetch;

  return (
    <div className={b.ack}>
      <span className={b.ackKey}>승인 요청</span>
      {!loaded ? (
        <TcPill tone="off" label="확인 중" />
      ) : failedFetch ? (
        <>
          <TcPill tone="off" label="조회 실패" />
          <button type="button" onClick={onReload} className={META_LINK}>
            다시 시도
          </button>
        </>
      ) : isCompleted ? (
        <TcPill tone="ok" label="요청됨" />
      ) : isRejected ? (
        <TcPill tone="warn" label="재실행 요청됨" />
      ) : (
        <TcPill tone="off" label="아직 요청 안 함" />
      )}
      {settledRow && stampedAt && (
        <span className={b.ackTime}>
          {fmtDateTimeSec(stampedAt)}
          {stale && ' · 이전 실행 기준'}
        </span>
      )}
      {settledRow && isRejected && status?.rejectReason && (
        <p className={b.ackReason}>{status.rejectReason}</p>
      )}
    </div>
  );
}
