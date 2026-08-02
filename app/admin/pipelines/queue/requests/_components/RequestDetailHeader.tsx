/**
 * RequestDetailHeader — P3 page head (design-spec §3, updated: NO "요청 정보"
 * card; the static request context lives in the header). Primer PageHeader +
 * Helios kv≤4 grammar: h1 + actions, head-sub (ProvTag · mono code · 상태),
 * head-meta (요청 시각 · 요청자), a bottom border separating it from the first
 * section.
 *
 * The meta pairs stack label over value and stand apart on a wide gap — the
 * step-2 request-summary grammar (MetaField), rather than a dot-separated run.
 * 리소스 선택 n/m is NOT here: the resource section below already leads with
 * "연동 대상 n개 · 제외 m개", and the count belongs to the list it describes.
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
  // 시각이 먼저 — 언제 들어온 요청인지가 대기열에서 먼저 읽혀야 한다.
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
        <div className="flex flex-wrap gap-8 mt-4">
          {meta.map((item) => (
            <div key={item.key} className="flex min-w-0 flex-col gap-1">
              <span className={text.kvKey}>{item.key}</span>
              <span className={cn(text.kvValue, 'min-w-0 truncate tabular-nums')}>{item.value}</span>
            </div>
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
