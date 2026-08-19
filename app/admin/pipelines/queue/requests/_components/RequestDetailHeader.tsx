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
 *
 * The header row (P2 wire) and the request facts (approval-requests/latest) arrive on
 * separate fetches, so the head has two waiting shapes: RequestDetailHeaderSkeleton
 * while the identity itself is in flight, and `pending` once the identity landed but
 * the request facts have not — the two detail-fed meta values wear pulse bars and the
 * CTA renders disabled (여기의 disabled 는 '아직'이 사실이다 — 결정이 끝나 CTA 가
 * 아예 사라지는 것과 다른 상태).
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
  /** null = the fact is still in flight — the value line wears a pulse bar. */
  value: string | null;
}

/** Sits INSIDE the real value span, so the 12px/1.3 line box (and the header's
 *  bottom border under it) never moves when the fact arrives. */
const VALUE_BAR = (
  <span
    aria-hidden="true"
    className="inline-block h-2.5 w-24 animate-pulse rounded-[6px] bg-[var(--pl-gray-100)] align-middle"
  />
);

/** Label over value, both 12px: only weight and colour separate the pair. */
function MetaRun({ items }: { items: readonly MetaItem[] }): ReactElement {
  return (
    <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2 mt-4">
      {items.map((item) => (
        <span key={item.key} className="flex min-w-0 flex-col gap-1">
          <span className="text-[12px] font-normal text-[var(--pl-text-weak)]">{item.key}</span>
          <span className="min-w-0 truncate text-[12px] font-semibold leading-[1.3] tabular-nums text-[var(--pl-text-medium)]">
            {item.value ?? VALUE_BAR}
          </span>
        </span>
      ))}
    </div>
  );
}

/* 결정이 끝난 요청에는 CTA 자체가 없다 — disabled 로 남겨두면 '지금은 못
   누른다(나중엔 될 수도)'로 읽히지만, 반려·승인된 요청은 다시 처리할 수
   없다. 상태는 위쪽 verdict 블록이 말한다. pending 은 정반대라서 disabled 가
   맞다: 정말로 '나중엔(곧) 된다'. */
function CtaPair({
  pending,
  onApprove,
  onReject,
}: {
  pending?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
}): ReactElement | null {
  if (!pending && !(onApprove && onReject)) return null;
  const title = pending ? '요청 정보를 불러오는 중이에요' : undefined;
  return (
    <div className="flex gap-2 flex-none">
      <PlButton variant="danger" disabled={pending} title={title} onClick={onReject}>
        반려
      </PlButton>
      <PlButton variant="primary" disabled={pending} title={title} onClick={onApprove}>
        승인
      </PlButton>
    </div>
  );
}

const HEAD_FRAME = 'flex items-start justify-between pb-5 mb-6 border-b border-[var(--pl-border)]';

export interface RequestDetailHeaderProps {
  /** null = the P2 header row was not found (or its fetch failed) — the h1 falls
   *  back to #id alone, so the id never prints twice. */
  serviceName: string | null;
  targetSourceId: number;
  /** TargetSourceInfo.description — omitted when the owner left it blank. */
  description?: string | null;
  provider: string;
  isSdu?: boolean;
  serviceCode: string | null;
  requestedBy: string | null;
  requestedAt: string | null;
  /** The request facts (approval-requests/latest) are still in flight — 요청
   *  시각/요청자 wear pulse bars and the CTA renders disabled. */
  pending?: boolean;
  /** Omitted once the request is decided — a settled request has no 승인/반려. */
  onApprove?: () => void;
  onReject?: () => void;
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
  pending,
  onApprove,
  onReject,
}: RequestDetailHeaderProps): ReactElement {
  // Provider joins the label-over-value run instead of standing above it as a dotted
  // tag. It is a fact about the target source, exactly like 요청 시각 and 요청자, and a
  // tag row of its own made a one-item tier out of it. The brand dot goes with it: the
  // label already says which field this is, so the dot only re-encoded the value.
  const meta: MetaItem[] = [
    { key: 'Provider', value: providerLabel(displayProvider(provider, isSdu)) },
    { key: '요청 시각', value: pending ? null : fmtDateTime(requestedAt) },
    { key: '요청자', value: pending ? null : (requestedBy ?? '—') },
  ];

  return (
    <div className={HEAD_FRAME}>
      <div>
        {/* The service code is an identifier, not a classification — it belongs beside
            the name it abbreviates, not down in the tag row with the provider. Baseline
            alignment keeps the chip and the id sitting on the h1's baseline.
            #id drops to 14: it is the same object as the title, so it stays in the h1,
            but at 24px it read as a second title rather than the title's id. */}
        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className={text.pageTitle}>{serviceName ?? `#${targetSourceId}`}</h1>
          {serviceCode != null && (
            <span className={cn(tag.base, tag.gray, '[font-family:var(--pl-font-mono)]')}>
              {serviceCode}
            </span>
          )}
          {/* 이름이 없어 h1 이 이미 #id 인 헤더에서는 세우지 않는다 — 같은 id 가
              두 번 찍힌다. */}
          {serviceName != null && (
            <span className="text-[14px] font-medium text-[var(--pl-text-weak)]">
              #{targetSourceId}
            </span>
          )}
        </div>
        {/* Between the h1 and the tag row, so the ramp reads 24 → 14 → 12: who the
            target source belongs to, what it holds, then how it is classified.
            Rendered only when the owner wrote one — an empty line would open a gap
            that says the field failed to load. */}
        {/* 14px 유지, 색만 medium → weak: 크기를 12로 내리면 아래 태그 행과 같은 단이 되어
            램프가 24 → 14 → 12 로 납작해진다. 한 단 낮추는 건 굵기(색 대비) 쪽이다. */}
        {description && (
          <p className="mt-1.5 max-w-[72ch] text-[14px] leading-[1.4] text-[var(--pl-text-weak)]">
            {description}
          </p>
        )}
        {/* Three tiers, and only three: the h1 line says which target source, the
            description says what it is, and this run says the facts about it. The 승인
            대기 pill and the provider tag each used to be a row of their own between
            them — 반려/승인 on the right already says the request is undecided. */}
        <MetaRun items={meta} />
      </div>
      <CtaPair pending={pending} onApprove={onApprove} onReject={onReject} />
    </div>
  );
}

/**
 * The head while the P2 header row itself is in flight. Same frame, the three meta
 * labels are static so they print for real over pulse bars, and the CTA renders
 * disabled — the buttons' place is real, only their enablement waits. Not drawn:
 * the description line and the code chip (whether either exists is what's loading).
 */
export function RequestDetailHeaderSkeleton(): ReactElement {
  return (
    <div className={HEAD_FRAME} aria-busy="true">
      <div>
        {/* h1 line box: text.pageTitle is 24px at leading-[1.2] ≈ 29px. */}
        <div className="flex h-[29px] items-center">
          <span className="h-4 w-44 animate-pulse rounded-[6px] bg-[var(--pl-gray-100)]" />
        </div>
        <MetaRun
          items={[
            { key: 'Provider', value: null },
            { key: '요청 시각', value: null },
            { key: '요청자', value: null },
          ]}
        />
      </div>
      <CtaPair pending />
    </div>
  );
}
