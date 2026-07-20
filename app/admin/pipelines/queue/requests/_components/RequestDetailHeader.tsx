/**
 * RequestDetailHeader — P3 page head (design-spec §3, updated: NO "요청 정보"
 * card; the static request context lives in the header). Primer PageHeader +
 * Helios kv≤4 grammar: h1 + actions, head-sub (ProvTag · mono code · 상태),
 * head-meta (요청자 · 요청 시각 · 리소스 선택 n/m), a bottom border separating it
 * from the first section.
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { ConfirmStatusPill } from '@/app/admin/pipelines/queue/requests/_components/ConfirmStatusPill';

const { text } = pipelineStyles;

interface MetaItem {
  key: string;
  value: ReactElement | string;
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
  selectedCount: number | null;
  totalCount: number | null;
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
  selectedCount,
  totalCount,
  onApprove,
  onReject,
  actionsDisabled,
}: RequestDetailHeaderProps): ReactElement {
  const meta: MetaItem[] = [
    { key: '요청자', value: requestedBy ?? '—' },
    { key: '요청 시각', value: fmtDateTime(requestedAt) },
    {
      key: '리소스 선택',
      value: (
        <>
          {selectedCount ?? '—'}
          <span className={text.muted}> / {totalCount ?? '—'}</span>
        </>
      ),
    },
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
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {meta.map((item, index) => (
            <span key={item.key} className="inline-flex items-center gap-2">
              {index > 0 && <span className="text-[var(--pl-text-faint)]">·</span>}
              <span className={text.kvKey}>{item.key}</span>
              <span className={cn(text.kvValue, 'tabular-nums')}>{item.value}</span>
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
