'use client';

/**
 * 관리자 승인 tab — the process branch this target's Step 6 exists for.
 *
 * 이 탭은 판정만 한다 — 캔버스 위 결정 머리(제목·상태·CTA) 아래 승인 조건 셋이 한 행
 * 세 열로 카드를 입고 선다. 조건마다
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
 * 아이콘 문법: ✓ 충족 · ✗ 미충족 · ⚠ 확인 못 함 · 도는 호 조회 중. 실제로 안 풀린 조건은
 * 이유(실패·미요청)와 무관하게 같은 ✗ 를 쓴다. 모름(조회 실패·판정할 수 없는 값)이 그 ✗ 를
 * 쓰지 못하는 이유는 머리의 `unmet`(approvalGate.ts) 과 같다 — 확인하지 못한 것을
 * "충족되지 않았다"고 단정하게 된다. 획도 같은 셋으로 갈린다: 초록은 충족, 빨강은 미충족,
 * 모름과 조회 중은 중립 획이다.
 * "완료·승인"은 사람의 행위(인수인계)에만, "성공·실패"는 테스트 결과에만 쓴다.
 *
 * 제목 문법: 카드 제목은 판정이 아니라 **요건**이다("…이어야 합니다"). 단정문
 * ("…성공입니다")은 옆에 선 ✗ 와 정면으로 부딪혀 — 문장은 성공이라 하고 아이콘은
 * 아니라 한다 — 읽는 사람이 매번 둘을 맞대 봐야 했다 (오너 2026-08-26). 요건은 참·거짓이
 * 아니라 충족·미충족이라 어느 판정 옆에 서도 말이 된다. 셋 다 상태와 무관하게 고정이고,
 * 무슨 일이 있었는지는 아이콘과 근거 행이 진다.
 */
import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTimeShort } from '@/lib/pipeline/format';
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
  type CountSegment,
  showsHandoffCaption,
  tcRunGate,
  type DagFetch,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/approvalGate';

const n = (value: number): string => value.toLocaleString('ko-KR');

/**
 * 판정 아이콘의 갈래.
 *
 * 지키는 성질(한 방향): 카드가 `warn` 을 입으면 머리는 **그 조건을** 미충족이라 부르지
 * 않는다. `warn` 은 미충족이 아니라 **모름**이다 — 조회에 실패했거나 판정할 수 없는
 * 값이라 알아내지 못한 것. 실제 미충족만 (`err` · `pending`) ✗ 를 입는다. 어긋나면 머리는
 * "확인하지 못했어요"라고 말하는데 카드는 미충족의 마크를 입고 서게 된다.
 *
 * ⛔ 머리의 `unmet`(approvalGate.ts) 과 양방향(⟺)으로 묶어 읽지 말 것. 머리는 한 번에 한
 * 조건만 말하고(먼저 걸리는 조건에서 멈춘다) 카드는 셋이 동시에 선다 — 그래서 어느
 * 방향으로도 전체가 성립하지 않는다:
 *   · 미요청 + 최신 실행 조회 거절 → 머리는 조건 ① 을 보고 `unmet: true` 인데 카드 ② 는
 *     `warn` 이다. 둘 다 각자 옳다.
 *   · 세 조건 다 충족 → `unmet: false` 지만 `warn` 인 카드는 하나도 없다.
 *
 * 오너의 초록/빨강 획 지시(2026-08-26)는 충족 vs 미충족을 가른 것이다. 모름은 둘 중
 * 어느 쪽도 아니라 중립 획으로 선다 — `loading` 과 같다.
 */
type GateRowState = 'ok' | 'err' | 'warn' | 'pending' | 'loading';

/** 카드 라벨의 번호 — 원문자(①)는 12px 에서 ⓘ 로 읽혀 못 쓴다(브라우저 실측). */
const GATE_ORDINALS = [1, 2, 3] as const;

/**
 * 카드 본문의 근거 한 줄. 라벨이 있으면 라벨–값 행, 없으면 산문 줄.
 *
 * 예전에는 근거 전부가 ` · ` 로 이어 붙인 한 줄이었다 — "3회차 2026-06-01 09:04:20 · 연동
 * 대상 논리 DB 35 · 제외 1" 은 좁은 열에서 두 줄로 접히면서 어디까지가 한 사실인지 경계를
 * 잃는다. 이제 사실 하나가 줄 하나를 갖고, 값의 이름은 왼쪽 열이 진다 (오너 2026-08-26:
 * "정보 정리 좀 잘 해봐").
 */
interface GateFact {
  /** 없으면 산문 줄 — 판정의 이유·안내처럼 이름 붙일 값이 아닌 것. */
  label?: string;
  value: ReactNode;
}

/**
 * 세는 값 한 줄 — "총 14개  14개 성공  0개 확인 필요".
 *
 * 수는 14px 굵게, 낱말은 12px (오너 2026-08-26). 한 줄 안에서 크기가 갈리므로 눈이 수부터
 * 집고 낱말은 그 수가 무엇인지 뒤따라 설명한다 — 같은 크기로 늘어놓으면 세 조각이 한
 * 문장으로 뭉쳐 읽힌다. 조각 사이는 쉼표가 아니라 간격이 가른다: 쉼표는 문장의 기호라
 * 세는 줄에 놓이면 조각을 이어 붙인다.
 */
function CountLine({ segments }: { segments: readonly CountSegment[] }): ReactElement {
  return (
    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12px] text-[var(--pl-text-medium)]">
      {segments.map((seg, i) => (
        <span key={i} className="whitespace-nowrap">
          {seg.prefix && `${seg.prefix} `}
          <b className="text-[14px] font-bold tabular-nums">{n(seg.count)}</b>
          {seg.suffix}
        </span>
      ))}
    </span>
  );
}

/**
 * One 승인 조건 — 카드 한 장.
 *
 * 세 조건이 한 상자 안에 `divide-y` 로 붙어 있던 동안에는 세 판정이 한 덩어리로 읽혔다
 * (오너 2026-08-26: "답답해"). 조건은 저마다 다른 화면이 판정하고 저마다 따로 풀리므로,
 * 각자 자기 카드에 서고, 세 카드는 한 행 세 열로 나란히 선다 — 감싸는 상자 없이
 * 콘텐츠 열 바닥에 그대로 깔린다.
 *
 * 카드 안 순서: 라벨(승인 조건 1) ▸ 판정문 ▸ 근거 행 ▸ (바닥) 상세보기.
 *
 * 판정문은 카드의 제목이라 이 화면의 제목 활자(`opsStyles.cardTitle`, 20px)를 그대로 입는다
 * (오너 2026-08-26). 근거 행은 12px 라벨 / 14px 값 두 열이고 행 사이를 8px 벌린다 — 좁은
 * 열에서 값이 두 줄로 접혀도 옆 행과 붙지 않을 만큼.
 *
 * 라벨의 잉크는 `--pl-gray-600` 이다. `--pl-text-weak` 은 흰 면에서 4.97:1 로 숫자는
 * 넘기지만, 이 줄은 12px 이라 같은 비율의 14px 값보다 훨씬 옅게 읽힌다 — 램프의 다음 칸이
 * 7.69:1 로, 값(`--pl-text-medium`, 10.46:1)보다는 여전히 한 칸 아래라 두 열의 순서가
 * 뒤집히지 않는다 (오너 2026-08-26: "4.7:1 이상"). `tcBand.meta` 가 같은 이유로 같은 칸을
 * 골랐다. 아이콘은 판정문 줄에 붙는다: 두 줄
 * 블록의 가운데로 내려오면 어느 줄을 판정하는 것인지 흐려진다.
 */
function GateCard({
  ordinal,
  state,
  text,
  facts,
  titleHint,
  onNavigate,
}: {
  /** 조건 번호 — 카드가 셋으로 흩어져도 순서(1·2·3)는 카드 자신이 진다. */
  ordinal: (typeof GATE_ORDINALS)[number];
  state: GateRowState;
  text: string;
  facts: readonly GateFact[];
  /** Debug-tier raw value (wire vocabulary) — tooltip only, never in the copy. */
  titleHint?: string;
  /** "상세보기" — 이 조건을 판정한 근거가 사는 탭으로 보낸다. */
  onNavigate?: () => void;
}): ReactElement {
  // ✓ 충족 · ✗ 미충족 · ⚠ 확인 못 함 · 도는 호 조회 중. 예전의 빈 동그라미는 "미충족"이
  // 아니라 "해당 없음"으로 읽혔고, 이유마다 잉크를 갈랐던 그 다음 판은 카드 획(아래)이
  // 둘로만 갈리면서 안팎이 어긋났다. 미충족의 이유(실패·미요청)는 여전히 가르지 않는다 —
  // 셋 다 CTA 하나를 잠그는 게이트라 관리자가 할 일이 같다.
  //
  // 모름만은 ✗ 를 쓰지 못한다 (머리의 `unmet` 과 같은 이유) — 확인하지 못한 것을
  // "충족되지 않았다"고 단정하게 되고, 머리가 "…확인하지 못했어요"라고 말하는 동안
  // 카드만 미충족의 마크를 입는다.
  //
  // 마크에는 말도 붙인다: `Icon` 은 `title` 이 없으면 `aria-hidden` 이라(icons.tsx),
  // 제목이 요건문 하나로 고정된 뒤로 충족·미충족 카드가 스크린리더에게 똑같이 들렸다.
  const icon =
    state === 'ok' ? (
      <Icon name="check-circle" size={20} className="text-[var(--pl-ok-text)]" title="충족" />
    ) : state === 'loading' ? (
      // 조회 중의 말은 아래 래퍼(`role="status"`)가 이미 진다 — 여기에 title 을 또 달면
      // 같은 사실이 두 번 읽힌다.
      <Icon
        name="loader"
        size={20}
        className="animate-spin text-[var(--pl-text-weak)] motion-reduce:animate-none"
      />
    ) : state === 'warn' ? (
      // 이 마크의 이름은 '확인 필요'가 아니라 '미확인'이다 — 같은 카드의 본문이 이미
      // '확인 필요'를 다른 뜻으로 쓴다(`N개 확인 필요` = 성공하지 못한 논리 DB·리소스의
      // 수). 한 카드 안에서 낱말 하나가 마크의 이름이자 세는 값의 이름이면 스크린리더가
      // 같은 말을 두 뜻으로 읽는다. '미확인'은 이 상태의 알약이 이미 쓰는 낱말이다
      // (approvalGate.ts) — 머리도 "판정할 수 없어요"라고 말한다.
      <Icon name="warn-tri" size={20} className="text-[var(--pl-warn-text)]" title="미확인" />
    ) : (
      <Icon name="x-circle" size={20} className="text-[var(--pl-err-text)]" title="미충족" />
    );
  return (
    <section
      className={cn(
        // 이 줄은 `pipelineStyles.card.base` 를 덮어쓰는 게 아니라 벗어난다. base 는
        // `border border-[var(--pl-border)]` 를 이미 달고 오는데 `cn` 은 단순 join 이라
        // (lib/theme.ts) 같은 속성을 두 벌 얹으면 둘 다 살아남고 승자는 CSS 소스 순서가
        // 정한다 — 지금 override 가 이기는 것은 arbitrary value 의 알파벳 순서 덕이라
        // 토큰 이름 하나만 바뀌어도 뒤집힌다. 그래서 base 의 값을 테두리 색만 빼고 그대로
        // 옮겨 적고, 색은 아래에서 딱 한 벌 얹는다. base 가 바뀌면 이 줄도 같이 바꾼다.
        // (같은 이유로 이 파일의 머리 desc 줄도 `opsStyles.cardDesc` 를 벗어나 있다.)
        'rounded-[10px] bg-[var(--pl-bg-card)] px-6 pb-6 pt-5 shadow-[var(--pl-shadow-xs)]',
        'flex h-full flex-col border',
        // 판정을 카드 둘레까지 끌고 나온다 (오너 2026-08-26). 아이콘 하나는 20px 이라
        // 세 카드를 훑을 때 눈이 먼저 세는 것은 획이다. 잉크는 알약이 쓰는 옅은 칸
        // (#A6F4C5 / #FDA29B) 이라 면을 물들이지 않고 테두리에서 멎는다 — 미충족이
        // 정상 흐름의 대부분인 화면에서 진한 빨강은 매번 사고를 알리게 된다.
        // 오너 지시는 충족 vs 미충족을 가른 것이라, 모름(`warn`)과 조회 중은 어느 색도
        // 갖지 않고 중립 획으로 선다.
        state === 'ok'
          ? 'border-[var(--pl-ok-border)]'
          : state === 'err' || state === 'pending'
            ? 'border-[var(--pl-err-border)]'
            : 'border-[var(--pl-border)]',
      )}
      aria-label={`승인 조건 ${ordinal}`}
    >
      <p className="text-[12px] font-semibold text-[var(--pl-text-weak)]">승인 조건 {ordinal}</p>
      <div className="mt-2.5 flex items-start gap-2.5">
        <span
          className="mt-0.5 flex-none"
          {...(state === 'loading' ? { role: 'status', 'aria-label': '확인 중' } : {})}
        >
          {icon}
        </span>
        <p
          className={cn(opsStyles.cardTitle, 'min-w-0 flex-1 break-keep leading-[1.4]')}
          title={titleHint}
        >
          {text}
        </p>
      </div>
      {state === 'loading' ? (
        // 근거가 앉을 자리를 미리 잡아 둔다 — 도착하면서 카드가 자라면 세 카드가 함께
        // 들썩인다(한 행 `items-stretch` 라 높이가 묶여 있다). 문장 대신 뛰는 막대를
        // 두는 이유는 "확인 중…" 이 근거 한 줄과 같은 활자라 사실처럼 읽혀서다.
        <div
          aria-hidden
          className={cn(pipelineStyles.skeletonBar, 'mt-3.5 h-[21px] w-2/3 rounded')}
        />
      ) : (
        facts.length > 0 && (
          <dl className="mt-3.5 flex flex-col gap-2">
            {facts.map((fact, i) =>
              fact.label ? (
                <div key={i} className="flex items-baseline gap-2">
                  <dt className="w-[68px] flex-none text-[12px] leading-[1.5] text-[var(--pl-gray-600)]">
                    {fact.label}
                  </dt>
                  <dd className="min-w-0 flex-1 text-[14px] leading-[1.5] tabular-nums text-[var(--pl-text-medium)]">
                    {fact.value}
                  </dd>
                </div>
              ) : (
                <dd key={i} className="text-[14px] leading-[1.6] text-[var(--pl-text-weak)]">
                  {fact.value}
                </dd>
              ),
            )}
          </dl>
        )
      )}
      {onNavigate && (
        // 세 열이 되면서 제목 옆을 떠났다 — 360px 열에서 판정문과 CTA 가 한 줄을 나눠 쓰면
        // 문장이 두세 줄로 접힌다. 카드 바닥은 셋이 같은 자리라 열끼리도 줄이 맞는다.
        <button
          type="button"
          onClick={onNavigate}
          className="mt-auto flex cursor-pointer items-center gap-0.5 self-start pt-4 text-[14px] font-semibold text-[var(--pl-primary)] hover:underline"
        >
          상세보기
          <Icon name="chev-r" size={14} />
        </button>
      )}
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

  // 조건 ② 의 근거 행 — 시각, 그리고 성공분이 있을 때만 논리 DB 합계. 합계는 연결
  // 테스트 탭의 셀과 같은 fold(ldbCount 게이트)라 두 화면이 갈라지지 않는다. 한 줄에 ` · `
  // 로 잇던 것을 사실마다 한 행으로 나눈다 (오너 2026-08-26).
  const tcFacts = ((): readonly GateFact[] => {
    if (!latest) return [];
    // 회차는 빠졌다 (오너 2026-08-26). 이 카드가 판정하는 것은 "최신 실행이 성공인가"라
    // 하나뿐이고 최신은 늘 최신이라, 몇 번째였는지는 이 조건을 좌우하지 않는다 — 회차별
    // 이력은 연결 테스트 탭이 갖는다.
    const facts: GateFact[] = [];
    // 끝난 실행이면 완료 시각, 아직이면 요청 시각 — 라벨이 어느 쪽인지 말한다.
    const done = latest.completed_at;
    const at = done ?? latest.requested_at;
    if (at) facts.push({ label: done ? '완료' : '요청', value: fmtDateTimeShort(at) });
    if (stats.successCount > 0) {
      facts.push({
        label: '논리 DB',
        // 조건 ③ 과 같은 세는 줄 문법 — 수는 14px 굵게, 낱말은 12px (오너 2026-08-26).
        // 두 조각을 가르는 것도 ` · ` 가 아니라 간격이다: 구분자는 세는 줄에 놓이면
        // 조각을 한 문장으로 이어 붙인다. 나란한 두 카드가 같은 것을 세면서 서로 다른
        // 문법으로 말하고 있었다.
        value: (
          <CountLine
            segments={[
              { prefix: '연동 대상', count: stats.includedTotal, suffix: '개' },
              { prefix: '제외', count: stats.excludedTotal, suffix: '개' },
            ]}
          />
        ),
      });
    }
    return facts;
  })();

  // 도착 전에는 아무 사실도 말하지 않는다 — 로딩 중의 null 을 '이력 없음'으로 읽으면
  // 체크리스트가 한 프레임 동안 거짓을 단정한다.
  const gate = tcLoaded ? tcRunGate(run, latest !== null, latestFailed) : 'loading';
  const head = foldApprovalHead(status?.status, statusFailed, gate, dag);

  // 승인 조건 ① — 도착 전 · 조회 실패 · 미요청 · 요청됨. 제목은 나머지 둘과 같은 요건문
  // 하나로 고정이라 이 fold 는 판정과 근거만 진다: 요청이 도착했다는 소식은 제목이 아니라
  // '요청' 시각이 나른다.
  const ackRow = ((): {
    state: GateRowState;
    facts: readonly GateFact[];
  } => {
    if (!tcLoaded) return { state: 'loading', facts: [] };
    if (statusFailed)
      // 모름 — 조회가 거절됐을 뿐 "요청이 없었다"는 사실을 관측한 게 아니다
      // (머리도 여기서 `unmet: false` 다).
      return {
        state: 'warn',
        facts: [{ value: '완료 승인 상태를 불러오지 못했습니다' }],
      };
    if (tcCompleted)
      return {
        state: 'ok',
        facts: [{ label: '요청', value: fmtDateTimeShort(status?.completedAt) }],
      };
    return {
      state: 'pending',
      // C-1 조건부 캡션 — "테스트 성공 + 미요청" 상태에서만. 강조는 굵기와 색으로
      // 지고, 문장은 짧게 둘로 나눈다 (오너 08-20).
      facts: showsHandoffCaption(status?.status, run)
        ? [
            {
              value: (
                <>
                  연결 테스트가 성공해도 이 조건은 자동으로 충족되지 않습니다. 서비스 담당자가{' '}
                  <b className="font-semibold text-[var(--pl-text-strong)]">
                    5단계 연결 테스트에서 승인 요청
                  </b>
                  을 눌러야 합니다.
                </>
              ),
            },
          ]
        : [],
    };
  })();

  // 승인 조건 ③ — the checklist carries the "why", the CTA stays locked.
  // 근거 행은 모니터링 근거의 fold 그대로 빌린다 — 이 화면과 Airflow 확인 탭이 같은
  // 응답을 다른 낱말로 부르면 안 된다. 조건 ② 와 같은 라벨–값 문법이다.
  const healthRow = ((): {
    state: GateRowState;
    facts: readonly GateFact[];
    titleHint?: string;
  } => {
    const prose = (line: string | null): readonly GateFact[] => (line ? [{ value: line }] : []);
    if (!tcLoaded) return { state: 'loading', facts: [] };
    // 모름 — §10 dag-status 는 읽는 사람이 생겼을 때만 가져오므로 이 상태에서는 헬스를
    // 아직 보지도 않았다. 미요청·기록 없음·진행 중이 `pending`(✗)을 입는 것은 그것들이
    // 관측된 사실이기 때문이다(요청이 없었다, 실행이 없었다). 이 줄은 DAG 에 대한 사실이
    // 아니라 우리가 아직 안 봤다는 말이라, ✗ 를 달면 마크는 "미충족"이라 하고 바로 옆
    // 문장은 "아직 점검 전"이라 하며 서로를 부정한다.
    if (!tcCompleted) return { state: 'warn', facts: [{ value: '완료 승인 후 점검합니다' }] };
    switch (dag.phase) {
      case 'loading':
        return { state: 'loading', facts: [] };
      case 'failed':
        // 모름 — 헬스를 확인하지 못한 것이지 UNHEALTHY 라고 관측한 게 아니다.
        return { state: 'warn', facts: prose(monHead.subtitle) };
      case 'loaded': {
        const verdict = healthVerdict(dag.data.healthStatus);
        const state: GateRowState =
          verdict.kind === 'healthy' ? 'ok' : verdict.kind === 'unhealthy' ? 'err' : 'warn';
        return {
          state,
          facts: [
            ...prose(monHead.subtitle),
            ...monHead.facts.map(
              (fact): GateFact => ({ label: fact.label, value: <CountLine segments={fact.segments} /> }),
            ),
            { label: '조회', value: fmtDateTimeShort(dag.fetchedAt) },
          ],
          titleHint: monHead.titleHint,
        };
      }
    }
  })();

  // 승인 조건 ② — 최신 실행의 판정. 잠그는 이유는 갈라 말한다(이력 없음 ≠ 조회 실패).
  const runRow = ((): { state: GateRowState; facts: readonly GateFact[]; titleHint?: string } => {
    switch (gate) {
      case 'success':
        return { state: 'ok', facts: tcFacts };
      case 'failed':
        return {
          state: 'err',
          facts: [
            ...(stats.failedCount > 0
              ? [{ label: '연결 실패', value: `${n(stats.failedCount)}건` }]
              : []),
            ...tcFacts,
          ],
        };
      case 'open':
        return { state: 'pending', facts: [{ value: '진행 중' }, ...tcFacts] };
      case 'loading':
        return { state: 'loading', facts: [] };
      case 'none':
        return { state: 'pending', facts: [{ value: '연결 테스트 실행 기록이 없습니다' }] };
      case 'error':
        // 모름 — 조회 실패는 빈 결과도, 실패한 실행도 아니다 ('none' · 'failed' 와 갈라 둔다).
        return { state: 'warn', facts: [{ value: '실행 정보를 불러오지 못했습니다' }] };
      case 'unknown':
        // Raw enum value stays in the tooltip channel — not in the copy.
        return {
          state: 'warn',
          facts: [{ value: '판정할 수 없는 값' }],
          titleHint: `connection_status: ${latest?.connection_status ?? ''}`,
        };
    }
  })();

  return (
    <>
      {/* 결정 머리 — 카드가 아니라 캔버스 위 맨몸 (오너 2026-08-26). 흰 면은 판정 카드 셋의
          것이고, 이 줄이 카드를 입으면 "무엇을 결정하는가"와 "무엇이 판정됐는가"가 같은
          종이 두 장으로 겹쳐 읽힌다. */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <h2 className={cn(opsStyles.cardTitle, 'flex items-center gap-2')}>
            <Icon name="check" size={18} className="text-[var(--pl-primary)]" />
            관리자 승인
            <TcPill tone={head.pill.tone} label={head.pill.label} />
          </h2>
          {/* 미충족은 경고 아이콘을 달고 선다 (오너 2026-08-26) — 조회 중·확인 실패는
              달지 않는다: 그건 충족되지 않았다는 판정이 아니라 아직 모른다는 말이다. */}
          {/* 이 줄은 opsStyles.cardDesc 를 떠났다 (오너 2026-08-26) — `cn` 은 단순 join 이라
              `text-[14px]` 위에 `text-[16px]` 를 얹으면 둘 다 남고 어느 쪽이 이기는지는 CSS
              순서가 정한다. 토큰을 덮어쓰는 게 아니라 벗어나야 한다. cardDesc 자체는 건드리지
              않는다: ops 탭 10곳이 그 토큰을 쓴다. 잉크가 `--pl-gray-600`(#475467)인 이유는
              캔버스(#F4F4FB) 위에서 7.02:1 로 5:1 을 넘기면서도 제목(`--pl-text-strong`,
              16.21:1)보다 한 칸 아래라 두 줄의 순서가 뒤집히지 않기 때문 — 기존
              `--pl-text-weak` 는 4.54:1 로 미달이었다. */}
          <p className="mt-3 flex items-center gap-1.5 text-[16px] text-[var(--pl-gray-600)]">
            {head.unmet && (
              <Icon
                name="warn-tri"
                size={16}
                className="flex-none text-[var(--pl-warn-text)]"
              />
            )}
            {head.desc}
          </p>
        </div>
        {/* CTA 는 늘 서 있고, 세 조건이 다 충족될 때까지 눌리지 않는다 (오너 2026-08-26).
            언마운트하던 이전 문법은 "이 화면에서 무엇을 하게 되는가"를 조건이 풀리기
            전까지 감췄다 — 비활성 버튼은 죽은 버튼이 아니라 아래 세 카드가 무엇을 여는
            열쇠인지 말해 주는 목적지다. 조회 중(head.canApprove=false)과 제출 중에도
            잠긴다. */}
        <div className="flex-none">
          <PlButton
            variant="primary"
            disabled={!head.canApprove || approve.loading}
            // 잠긴 CTA 는 캔버스 위에 선다 — primary 의 disabled 면(gray-100)은 이 라벤더
            // 바탕에서 거의 사라져 버튼이 아니라 흐린 글자로 읽힌다(브라우저 실측). 획을
            // 하나 두면 눌리지 않는 동안에도 버튼의 모양이 남는다. 카드 위에 서는 다른
            // disabled primary 들은 흰 면에서 이미 보이므로 전역 토큰은 건드리지 않는다.
            className="disabled:border-[var(--pl-border-strong)]"
            onClick={() => setApproveOpen(true)}
          >
            연동 완료
          </PlButton>
        </div>
      </div>

      {isRejected && (
        <div className="rounded-lg bg-[var(--pl-gray-50)] px-3.5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-[var(--pl-text-weak)]">재실행 요청</span>
            <span className="text-[12px] tabular-nums text-[var(--pl-text-weak)]">
              {fmtDateTimeShort(status?.rejectedAt)}
            </span>
          </div>
          {status?.rejectReason && (
            <p className={cn(pipelineStyles.text.body, 'mt-2')}>{status.rejectReason}</p>
          )}
        </div>
      )}

      {/* 왜 CTA 가 잠겨 있는지는 이 세 카드가 말한다.

          근거는 어느 조건도 이 자리에서 펼치지 않는다 — 판정을 만든 화면이 이미 따로 있고,
          그 화면은 읽기 말고 할 수 있는 일(제외 정책·Credential·재실행)도 갖고 있다.
          여기서 한 번 더 그리면 같은 표가 두 벌이 된다.

          한 행 세 열 (오너 2026-08-26: "응집도가 더 높을 듯"). 세 조건은 CTA 하나를 함께
          여는 한 벌이라, 세로로 쌓으면 스크롤 순서가 되고 가로로 서면 한 눈에 든다. */}
      <div className="grid grid-cols-3 items-stretch gap-4">
        <GateCard
          ordinal={GATE_ORDINALS[0]}
          state={ackRow.state}
          text="연결 테스트 완료 승인을 요청해야 합니다"
          facts={ackRow.facts}
        />
        <GateCard
          ordinal={GATE_ORDINALS[1]}
          state={runRow.state}
          text="최신 연결 테스트 결과가 성공이어야 합니다"
          facts={runRow.facts}
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
          text="최근 7일 DAG 실행이 정상이어야 합니다"
          facts={healthRow.facts}
          titleHint={healthRow.titleHint}
          onNavigate={onOpenAirflowTab}
        />
      </div>

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
