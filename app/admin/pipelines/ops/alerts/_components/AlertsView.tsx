'use client';

/**
 * 운영 알림 — the Target Sources across all services that are waiting on an
 * operator action, in the four buckets the BFF aggregates
 * (`GET /dashboard/summary` counts + `GET /dashboard/target-sources/{kind}`).
 *
 * The bucketing is the server's: it owns which targets land in which bucket and
 * the exact counts. This view must NOT re-derive membership from a row's
 * status, because the population is cross-service and one page of it is not the
 * whole truth.
 *
 * Layout (decision record: docs/ux/benchmark/ops-alerts-worklist.md, replacing
 * the 2×2 card grid of Figma ZL0Y0okL8lReCrbf7JaVAp): the summary tiles ARE the
 * filter — the pipelines dashboard `BucketTile` mechanism — and one worklist
 * below shows the selected bucket. Exactly one tile is always selected (default:
 * the first bucket with a count, in process order), so there is no toggle-off.
 * Counts appear once, on the tiles; the worklist header repeats the label and
 * description but never the number.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import type { OpsTargetTab } from '@/lib/routes';
import { useNavCountsRefresh } from '@/app/admin/pipelines/_components/NavCountsRefresh';
import { getDashboardSummary } from '@/app/lib/api/task-queue';
import type { AlertTargetKind, DashboardSummary } from '@/lib/types/task-queue';
import {
  AlertWorklist,
  type AlertStageIcon,
} from '@/app/admin/pipelines/ops/alerts/_components/AlertWorklist';

type AlertCounts = Pick<
  DashboardSummary,
  'confirmingCount' | 'needInstallCount' | 'needTestConnectionCount' | 'needPiiAgentConfirmCount'
>;

interface AlertBucketMeta {
  kind: AlertTargetKind;
  label: string;
  /** 필요한 작업 — what the operator has to do next. */
  need: string;
  /** Who has to act, and on what — the worklist header's subtitle. */
  description: string;
  icon: AlertStageIcon;
  /** The ops-screen tab that answers this bucket's need — rows deep-link to it. */
  tab: OpsTargetTab;
  count: (counts: AlertCounts) => number;
}

/** Tile order is the process order (설치 흐름), so the strip reads left→right
 *  as the pipeline does. Empty buckets stay clickable. */
const ALERT_BUCKETS: readonly AlertBucketMeta[] = [
  {
    kind: 'confirming',
    label: '리소스 확정 진행 중',
    need: '확정 완료 여부 확인',
    description:
      '설치 완료 후 리소스 반영 상태를 확인해야 하는 Target Source입니다. 담당자의 확정 완료 확인이 필요합니다.',
    icon: 'clipboard-check',
    tab: 'confirm',
    count: (s) => s.confirmingCount,
  },
  {
    kind: 'need-install',
    label: '설치 필요',
    need: 'Agent 설치 수행',
    description: 'Agent 설치가 대기 중인 Target Source입니다. 인프라 담당자가 설치를 수행해야 합니다.',
    icon: 'terraform',
    tab: 'infra',
    count: (s) => s.needInstallCount,
  },
  {
    kind: 'need-test-connection',
    label: '연결 테스트 필요',
    need: '연결 테스트 실행',
    description:
      '설치된 Agent의 연결 상태를 검증해야 하는 Target Source입니다. 테스트 실행 후 결과를 확인하세요.',
    icon: 'link',
    tab: 'tc',
    count: (s) => s.needTestConnectionCount,
  },
  {
    kind: 'need-pii-agent-confirm',
    label: 'PII Agent 확인 필요',
    need: '완료 승인',
    description:
      '모든 단계를 완료하고 최종 승인을 대기 중인 Target Source입니다. 관리자 확인 후 완료 처리하세요.',
    icon: 'shield-check',
    tab: 'approval',
    count: (s) => s.needPiiAgentConfirmCount,
  },
];

const alertsView = {
  head: 'flex items-start justify-between gap-6',
  context: 'mt-1 text-[14px] leading-[1.4] text-[var(--pl-text-weak)]',
  contextTotal: 'mx-0.5 align-baseline text-[32px] font-bold leading-none text-[var(--pl-primary)]',
  summaryRow: 'mt-6 grid grid-cols-4 gap-4',
  /**
   * border 는 비활성일 때도 자리를 차지해야 선택 시 타일 크기가 흔들리지 않는다.
   * border 색과 배경은 idle/active 가 배타적으로 소유한다 — cn 은 단순 join 이라
   * 같은 속성을 두 번 실으면 Tailwind 출력 순서가 승자를 정해버린다.
   */
  summary:
    'flex h-[120px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[8px] border transition-colors',
  /** hover 는 idle 에만 — active 위에 얹으면 hover 가 브랜드 스트로크를 덮는다. */
  summaryIdle:
    'border-transparent bg-[var(--pl-gray-100)] hover:border-[var(--pl-gray-300)] hover:bg-[var(--pl-gray-200)]',
  /** Selected = white face + brand stroke + sm shadow — the pipelines dashboard
   *  `bucketTileActive` levers, so "this tile filters the list" reads the same
   *  way in both screens. */
  summaryActive: 'border-[var(--pl-primary)] bg-[var(--pl-bg-card)] shadow-[var(--pl-shadow-sm)]',
  summaryLabel: 'text-[14px] leading-[1.4] text-[var(--pl-text-weak)]',
  summaryValue: 'text-[40px] font-bold leading-[1.2] tracking-[-0.02em] tabular-nums text-[var(--pl-text-strong)]',
  summaryNeed: 'text-[12px] leading-[1.4] text-[var(--pl-text-weak)]',
  worklist: 'mt-6',
  /** Worklist footprint while the summary decides the default bucket. */
  worklistGate:
    'mt-6 h-[320px] animate-pulse rounded-[12px] border border-[var(--pl-border-strong)] bg-[var(--pl-bg-card)]',
} as const;

const EMPTY_SUMMARY_COUNTS: AlertCounts = {
  confirmingCount: 0,
  needInstallCount: 0,
  needTestConnectionCount: 0,
  needPiiAgentConfirmCount: 0,
};

export function AlertsView(): ReactElement {
  const [counts, setCounts] = useState(EMPTY_SUMMARY_COUNTS);
  const [selected, setSelected] = useState<AlertTargetKind | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // 사이드바 운영 알림 뱃지는 이 타일들과 같은 summary 를 읽는다. 함께 갱신하지
  // 않으면 새로고침 직후 한 화면에 서로 다른 두 숫자가 남는다.
  const refreshNavCounts = useNavCountsRefresh();
  const reload = useCallback(() => {
    setReloadKey((key) => key + 1);
    refreshNavCounts();
  }, [refreshNavCounts]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      let summary = EMPTY_SUMMARY_COUNTS;
      try {
        summary = await getDashboardSummary({ signal: controller.signal });
      } catch {
        // Tiles fall back to 0 — the worklist below reports its own failure.
      }
      if (controller.signal.aborted) return;
      setCounts(summary);
      // Default selection, decided once the counts are known: the first bucket
      // with work, else the first bucket. A refresh keeps the user's choice.
      setSelected(
        (prev) =>
          prev ??
          (ALERT_BUCKETS.find((bucket) => bucket.count(summary) > 0)?.kind ??
            ALERT_BUCKETS[0].kind),
      );
    })();
    return () => controller.abort();
  }, [reloadKey]);

  const total = ALERT_BUCKETS.reduce((sum, bucket) => sum + (bucket.count(counts) ?? 0), 0);
  const selectedBucket = ALERT_BUCKETS.find((bucket) => bucket.kind === selected) ?? null;

  return (
    <div>
      <div className={alertsView.head}>
        <div>
          <h1 className={pipelineStyles.text.pageTitle}>운영 알림</h1>
          <p className={alertsView.context}>
            PII Agent 설치 운영 인력이 확인해야 될 사항이 총
            <strong className={alertsView.contextTotal}>{total}</strong>개 있어요
          </p>
        </div>
      </div>

      <div className={alertsView.summaryRow} role="group" aria-label="운영 알림 버킷 필터">
        {ALERT_BUCKETS.map((bucket) => (
          <button
            key={bucket.kind}
            type="button"
            aria-pressed={selected === bucket.kind}
            onClick={() => setSelected(bucket.kind)}
            className={cn(
              alertsView.summary,
              selected === bucket.kind ? alertsView.summaryActive : alertsView.summaryIdle,
            )}
          >
            <span className={alertsView.summaryLabel}>{bucket.label}</span>
            <span className={alertsView.summaryValue}>{bucket.count(counts) ?? 0}</span>
            <span className={alertsView.summaryNeed}>{bucket.need}</span>
          </button>
        ))}
      </div>

      {selectedBucket ? (
        <div className={alertsView.worklist}>
          <AlertWorklist
            // Remount on bucket change so the page index and rows reset with it.
            key={selectedBucket.kind}
            kind={selectedBucket.kind}
            label={selectedBucket.label}
            description={selectedBucket.description}
            icon={selectedBucket.icon}
            tab={selectedBucket.tab}
            count={selectedBucket.count(counts) ?? 0}
            reloadKey={reloadKey}
            onRefresh={reload}
          />
        </div>
      ) : (
        <div className={alertsView.worklistGate} aria-busy="true" aria-label="운영 알림 목록 준비 중" />
      )}
    </div>
  );
}
