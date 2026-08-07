'use client';

/**
 * 운영 알림 — the Target Sources across all services that are waiting on an
 * operator action, in the four buckets the BFF aggregates
 * (`GET /dashboard/summary` counts + `GET /dashboard/target-sources/{kind}`).
 *
 * The bucketing is the server's: it owns which targets land in which bucket and
 * the exact counts. This view renders one card per bucket — it must NOT
 * re-derive membership from a row's status, because the population is
 * cross-service and one page of it is not the whole truth.
 *
 * Layout: Figma ZL0Y0okL8lReCrbf7JaVAp 1:123 — summary counts on top, then all
 * four buckets side by side (2×2), each with its own page of rows. The summary
 * tiles are selectable one at a time — 강조 표시일 뿐, 카드 목록은 걸러내지
 * 않는다(네 버킷이 이미 모두 화면에 있다).
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { getDashboardSummary } from '@/app/lib/api/task-queue';
import type { AlertTargetKind, DashboardSummary } from '@/lib/types/task-queue';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import {
  AlertStageCard,
  type AlertStageIcon,
} from '@/app/admin/pipelines/ops/alerts/_components/AlertStageCard';

type AlertCounts = Pick<
  DashboardSummary,
  'confirmingCount' | 'needInstallCount' | 'needTestConnectionCount' | 'needPiiAgentConfirmCount'
>;

interface AlertCardMeta {
  kind: AlertTargetKind;
  label: string;
  /** 필요한 작업 — what the operator has to do next. */
  need: string;
  /** Who has to act, and on what — the card's own subtitle. */
  description: string;
  icon: AlertStageIcon;
  count: (counts: AlertCounts) => number;
}

const ALERT_CARDS: readonly AlertCardMeta[] = [
  {
    kind: 'confirming',
    label: '리소스 확정 진행 중',
    need: '확정 완료 여부 확인',
    description:
      '설치 완료 후 리소스 반영 상태를 확인해야 하는 Target Source입니다. 담당자의 확정 완료 확인이 필요합니다.',
    icon: 'clipboard-check',
    count: (s) => s.confirmingCount,
  },
  {
    kind: 'need-install',
    label: '설치 필요',
    need: 'Agent 설치 수행',
    description: 'Agent 설치가 대기 중인 Target Source입니다. 인프라 담당자가 설치를 수행해야 합니다.',
    icon: 'terraform',
    count: (s) => s.needInstallCount,
  },
  {
    kind: 'need-test-connection',
    label: '연결 테스트 필요',
    need: '연결 테스트 실행',
    description:
      '설치된 Agent의 연결 상태를 검증해야 하는 Target Source입니다. 테스트 실행 후 결과를 확인하세요.',
    icon: 'link',
    count: (s) => s.needTestConnectionCount,
  },
  {
    kind: 'need-pii-agent-confirm',
    label: 'PII Agent 확인 필요',
    need: '완료 승인',
    description:
      '모든 단계를 완료하고 최종 승인을 대기 중인 Target Source입니다. 관리자 확인 후 완료 처리하세요.',
    icon: 'shield-check',
    count: (s) => s.needPiiAgentConfirmCount,
  },
];

const alertsView = {
  head: 'flex items-start justify-between gap-6',
  context: 'mt-1 text-[14px] leading-[1.4] text-[var(--pl-text-weak)]',
  contextTotal: 'mx-0.5 align-baseline text-[32px] font-bold leading-none text-[var(--pl-primary)]',
  summaryRow: 'mt-6 grid grid-cols-4 gap-4',
  /** border 는 비활성일 때도 자리를 차지해야 선택 시 타일 크기가 흔들리지 않는다. */
  summary:
    'flex h-[120px] flex-col items-center justify-center gap-1.5 rounded-[8px] border border-transparent bg-[var(--pl-gray-100)] transition-colors',
  summaryActive: 'border-[var(--pl-primary)]',
  summaryLabel: 'text-[14px] leading-[1.4] text-[var(--pl-text-weak)]',
  summaryValue: 'text-[40px] font-bold leading-[1.2] tracking-[-0.02em] tabular-nums text-[var(--pl-text-strong)]',
  summaryNeed: 'text-[12px] leading-[1.4] text-[var(--pl-text-faint)]',
  grid: 'mt-6 grid grid-cols-2 gap-6',
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
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const summary = await getDashboardSummary({ signal: controller.signal });
        if (!controller.signal.aborted) setCounts(summary);
      } catch {
        if (!controller.signal.aborted) setCounts(EMPTY_SUMMARY_COUNTS);
      }
    })();
    return () => controller.abort();
  }, [reloadKey]);

  const total = ALERT_CARDS.reduce((sum, card) => sum + (card.count(counts) ?? 0), 0);

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
        {/* 새로고침은 상시 노출 도구 CTA — 회색 chrome 대신 브랜드 스트로크(outline)로 낮춘다. */}
        <PlButton variant="outline" onClick={reload} className="gap-2">
          <Icon name="refresh" size="md" />
          새로고침
        </PlButton>
      </div>

      <div className={alertsView.summaryRow}>
        {ALERT_CARDS.map((card) => (
          <button
            key={card.kind}
            type="button"
            aria-pressed={selected === card.kind}
            onClick={() => setSelected((prev) => (prev === card.kind ? null : card.kind))}
            className={cn(alertsView.summary, selected === card.kind && alertsView.summaryActive)}
          >
            <span className={alertsView.summaryLabel}>{card.label}</span>
            <span className={alertsView.summaryValue}>{card.count(counts) ?? 0}</span>
            <span className={alertsView.summaryNeed}>{card.need}</span>
          </button>
        ))}
      </div>

      <div className={alertsView.grid}>
        {ALERT_CARDS.map((card) => (
          <AlertStageCard
            key={card.kind}
            kind={card.kind}
            label={card.label}
            description={card.description}
            icon={card.icon}
            reloadKey={reloadKey}
          />
        ))}
      </div>
    </div>
  );
}
