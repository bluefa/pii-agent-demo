/**
 * RequestDetailHeader — P3 page head (design-spec §3, updated: NO "요청 정보"
 * card; the static request context lives in the header). h1 + actions, head-sub
 * (ProvTag · mono code · 상태), then the request facts as label-over-value pairs
 * (Step 2's MetaField grammar), and a bottom border separating it from the first
 * section.
 *
 * 요청 시각 leads: the meta answers "이 요청이 언제 들어왔나" before "누가" — the
 * queue is triaged by age (the list ranks by 지연), so time is the fact the admin
 * arrives already holding.
 *
 * Resource counts deliberately absent: the section below opens with 전체 / 대상 /
 * 제외 as 40px tiles that are also the list filter. Repeating "35 / 44" here made
 * the header state a number the reader cannot act on, two lines above the one
 * they can.
 */
import type { ReactElement } from 'react';
import { pipelineStyles } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { ConfirmStatusPill } from '@/app/admin/pipelines/queue/requests/_components/ConfirmStatusPill';

const { text } = pipelineStyles;

interface MetaItem {
  key: string;
  value: string;
}

export interface RequestDetailHeaderProps {
  serviceName: string;
  targetSourceId: number;
  provider: string;
  isSdu?: boolean;
  serviceCode: string | null;
  confirmStatus: string | null;
  requestedBy: string | null;
  requestedAt: string | null;
  onApprove: () => void;
  onReject: () => void;
  actionsDisabled?: boolean;
}

export function RequestDetailHeader({
  serviceName,
  targetSourceId,
  provider,
  isSdu,
  serviceCode,
  confirmStatus,
  requestedBy,
  requestedAt,
  onApprove,
  onReject,
  actionsDisabled,
}: RequestDetailHeaderProps): ReactElement {
  const meta: MetaItem[] = [
    { key: '요청 시각', value: fmtDateTime(requestedAt) },
    { key: '요청자', value: requestedBy ?? '—' },
  ];

  return (
    <div className="flex items-start justify-between pb-5 mb-6 border-b border-[var(--pl-border)]">
      <div>
        <h1 className={text.pageTitle}>
          {serviceName} <span className="font-medium text-[var(--pl-text-weak)]">#{targetSourceId}</span>
        </h1>
        <div className="flex items-center gap-2 mt-2">
          <ProvTag provider={provider} isSdu={isSdu} />
          {serviceCode != null && <span className={text.mono}>{serviceCode}</span>}
          <ConfirmStatusPill status={confirmStatus} />
        </div>
        {/* Label over value, both 12px — only weight and color separate the tiers
            (Step 2's MetaField). The dot-separated inline run it replaces read as one
            sentence; stacked pairs let the eye land on a single fact. */}
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2 mt-4">
          {meta.map((item) => (
            <span key={item.key} className="flex min-w-0 flex-col gap-1">
              <span className="text-[12px] font-normal text-[var(--pl-text-weak)]">{item.key}</span>
              <span className="min-w-0 truncate text-[12px] font-semibold leading-[1.3] tabular-nums text-[var(--pl-text-medium)]">
                {item.value}
              </span>
            </span>
          ))}
        </div>
      </div>
      <div className="flex gap-2 flex-none">
        <PlButton variant="danger" onClick={onReject} disabled={actionsDisabled}>
          반려
        </PlButton>
        <PlButton variant="primary" onClick={onApprove} disabled={actionsDisabled}>
          승인
        </PlButton>
      </div>
    </div>
  );
}
