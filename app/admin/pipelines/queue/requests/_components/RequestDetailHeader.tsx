/**
 * RequestDetailHeader — P3 page head (design-spec §3, updated: NO "요청 정보"
 * card; the static request context lives in the header). h1 (name · code chip ·
 * #id) + actions, the owner's description, the provider tag, then the request facts
 * as label-over-value pairs (Step 2's MetaField grammar), and a bottom border
 * separating it from the first section.
 *
 * Request time leads: the queue is triaged by age (the list ranks by delay), so the
 * arrival time is the fact the admin already holds when they open this page — the
 * requester is the second question, not the first.
 *
 * Resource counts deliberately absent: the section below opens with the all / target /
 * excluded counts as 40px tiles that are also the list filter. Repeating "35 / 44" here
 * made the header state a number the reader cannot act on, two lines above the one they
 * can.
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { displayProvider, fmtDateTime, providerLabel } from '@/lib/pipeline/format';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';

const { text } = pipelineStyles;
const { tag } = tqStyles;

interface MetaItem {
  key: string;
  value: string;
}

export interface RequestDetailHeaderProps {
  serviceName: string;
  targetSourceId: number;
  /** TargetSourceInfo.description — omitted when the owner left it blank. */
  description?: string | null;
  provider: string;
  isSdu?: boolean;
  serviceCode: string | null;
  requestedBy: string | null;
  requestedAt: string | null;
  /** Omitted once the request is decided — a settled request has no 승인/반려. */
  onApprove?: () => void;
  onReject?: () => void;
  actionsDisabled?: boolean;
}

export function RequestDetailHeader({
  serviceName,
  targetSourceId,
  description,
  provider,
  isSdu,
  serviceCode,
  requestedBy,
  requestedAt,
  onApprove,
  onReject,
  actionsDisabled,
}: RequestDetailHeaderProps): ReactElement {
  // Provider joins the label-over-value run instead of standing above it as a dotted
  // tag. It is a fact about the target source, exactly like 요청 시각 and 요청자, and a
  // tag row of its own made a one-item tier out of it. The brand dot goes with it: the
  // label already says which field this is, so the dot only re-encoded the value.
  const meta: MetaItem[] = [
    { key: 'Provider', value: providerLabel(displayProvider(provider, isSdu)) },
    { key: '요청 시각', value: fmtDateTime(requestedAt) },
    { key: '요청자', value: requestedBy ?? '—' },
  ];

  return (
    <div className="flex items-start justify-between pb-5 mb-6 border-b border-[var(--pl-border)]">
      <div>
        {/* The service code is an identifier, not a classification — it belongs beside
            the name it abbreviates, not down in the tag row with the provider. Baseline
            alignment keeps the chip and the id sitting on the h1's baseline.
            #id drops to 14: it is the same object as the title, so it stays in the h1,
            but at 24px it read as a second title rather than the title's id. */}
        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className={text.pageTitle}>{serviceName}</h1>
          {serviceCode != null && (
            <span className={cn(tag.base, tag.gray, '[font-family:var(--pl-font-mono)]')}>
              {serviceCode}
            </span>
          )}
          <span className="text-[14px] font-medium text-[var(--pl-text-weak)]">
            #{targetSourceId}
          </span>
        </div>
        {/* Between the h1 and the tag row, so the ramp reads 24 → 14 → 12: who the
            target source belongs to, what it holds, then how it is classified.
            Rendered only when the owner wrote one — an empty line would open a gap
            that says the field failed to load. */}
        {/* 14px 유지, 색만 medium → weak: 크기를 12로 내리면 아래 태그 행과 같은 단이 되어
            램프가 24 → 12 → 12 로 납작해진다. 한 단 낮추는 건 굵기(색 대비) 쪽이다. */}
        {description && (
          <p className="mt-1.5 max-w-[72ch] text-[14px] leading-[1.4] text-[var(--pl-text-weak)]">
            {description}
          </p>
        )}
        {/* Three tiers, and only three: the h1 line says which target source, the
            description says what it is, and this run says the facts about it. The 승인
            대기 pill and the provider tag each used to be a row of their own between
            them — 반려/승인 on the right already says the request is undecided.
            Label over value, both 12px: only weight and colour separate the pair. */}
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
      {/* 결정이 끝난 요청에는 CTA 자체가 없다 — disabled 로 남겨두면 '지금은 못
          누른다(나중엔 될 수도)'로 읽히지만, 반려·승인된 요청은 다시 처리할 수
          없다. 상태는 위쪽 verdict 블록이 말한다. */}
      {onApprove && onReject && (
        <div className="flex gap-2 flex-none">
          <PlButton variant="danger" onClick={onReject} disabled={actionsDisabled}>
            반려
          </PlButton>
          <PlButton variant="primary" onClick={onApprove} disabled={actionsDisabled}>
            승인
          </PlButton>
        </div>
      )}
    </div>
  );
}
