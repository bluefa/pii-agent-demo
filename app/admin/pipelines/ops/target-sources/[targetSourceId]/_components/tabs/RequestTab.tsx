'use client';

/**
 * 연동 요청 정보 tab — mirrors the approved mockup
 * (design/pipeline/ops-target-source-tabs.html `tabRequest`), with 최근 승인 요청
 * folded into ONE card — the request's facts as a header row over the resource
 * list itself, the same shape the 승인 요청 상세 modal uses.
 *
 * ⛔ 확정 정보 카드는 여기 없다 (오너 2026-08-30). 확정 정보는 제 탭이 통째로 갖고 있고,
 * 진행 상태 탭의 연동 현황 행이 확정 여부와 그 탭으로 가는 문을 이미 진다 — 같은 사실이
 * 세 자리에 있을 이유가 없다.
 *
 * Reads are independent and best-effort so a failing card never blanks its
 * sibling:
 *   - 최근 승인 요청 / 요청 리소스 → …/approval-requests/latest
 *   - 처리 (처리자 · 처리 일시)     → …/approval-history (latest page item)
 * A missing snapshot (404) is an empty state, not a failure.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { cn, pipelineStyles, textColors } from '@/lib/theme';
import { AppError } from '@/lib/errors';
import { normalizeCloudProvider } from '@/lib/types';
import { passRoutes } from '@/lib/routes';
import { fmtDateTime } from '@/lib/pipeline/format';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { getApprovalHistory } from '@/app/lib/api';
import {
  getApprovalRequestLatest,
  getNlbIndexMappings,
  getNlbTable,
  type ApprovalRequestDetail,
  type NlbTableRow,
  type RequestResourceRow,
  type ResourceNlbMappings,
} from '@/app/lib/api/task-queue-requests';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import {
  ResourceSection,
  ResourceSectionSkeleton,
} from '@/app/admin/pipelines/queue/requests/_components/ResourceSection';
import { NlbListenerModal } from '@/app/admin/pipelines/queue/requests/_components/NlbListenerModal';
import { ServiceAssignmentModal } from '@/app/admin/pipelines/queue/requests/_components/ServiceAssignmentModal';
import { useResourceListState } from '@/app/admin/pipelines/queue/requests/_resourceQuery';
import { MetaField } from '@/app/target-sources/[targetSourceId]/_components/shared/MetaField';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

/** `data: null` = the snapshot does not exist yet (404), not a failure. */
type Load<T> = { state: 'loading' } | { state: 'ready'; data: T | null } | { state: 'failed' };

/** 처리 source — one …/approval-history content item. CONTRACT GAP: the swagger
 *  200 is the generic `Page`, so the item shape is off-contract (same local wire
 *  as the sibling ApprovalHistoryCard). */
interface ApprovalHistoryItemWire {
  request?: { id?: number };
  result?: { processed_by?: { user_id?: string }; processed_at?: string };
}

interface ProcessedInfo {
  requestId: number | null;
  by: string | null;
  at: string | null;
}

type Tone = 'ok' | 'err' | 'warn' | 'off';

/** Wire approval status → tone (unlisted statuses read neutral). */
const STATUS_TONE: Record<string, Tone> = {
  APPROVED: 'ok',
  AUTO_APPROVED: 'ok',
  REJECTED: 'err',
  PENDING: 'warn',
};

const TONE: Record<Tone, { fill: string; dot: string }> = {
  ok: { fill: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]', dot: 'bg-[var(--pl-ok)]' },
  err: { fill: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]', dot: 'bg-[var(--pl-err)]' },
  warn: { fill: 'bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]', dot: 'bg-[var(--pl-warn)]' },
  off: { fill: 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)]', dot: 'bg-[var(--pl-gray-300)]' },
};

const dash = (): ReactElement => <span className={pipelineStyles.text.muted}>—</span>;

function StatusTag({ status }: { status: string | null }): ReactElement {
  if (!status) return dash();
  const tone = TONE[STATUS_TONE[status] ?? 'off'];
  return <span className={cn(opsStyles.statusTag, tone.fill)}>{status}</span>;
}

/** `nlbLocked` hides the assign button, so this never fires — the prop is required. */
const NOOP = (): void => {};

/**
 * 요청 리소스 목록 — the queue's own 연동 대상 리소스 section (ResourceSection), rendered
 * here rather than restated: same stat tiles that ARE the filter, same toolbar, and the
 * provider's own table. The tab used to map every row into the cloud-shaped approval table,
 * which has a Resource Name and a Resource ID column — neither of which an IDC row has.
 * Its endpoint went into the name column and its Port, Oracle SID and Source IP had nowhere
 * to go at all. The queue table answers all of that, and one component means the two
 * surfaces cannot drift apart again.
 *
 * Read-only: 운영 화면은 요청을 읽기만 한다. NLB 배정은 PENDING 인 요청에서만 유효하고
 * 그 편집은 연동 요청 화면의 일이라 여기서는 잠근다(값은 그대로 읽힌다). 남는 두 진입점
 * (NLB 리스너 현황 · 사용 서비스)은 조회라 그대로 둔다.
 *
 * Owns the list's filter/search/page state, so mounting it under a per-request `key` is
 * what resets that state between requests.
 *
 * Exported for the 확정 정보 tab's 연동 요청 pane, which shows the same request: one
 * request, one presentation, wherever an operator opens it.
 */
export function ResourceList({
  targetSourceId,
  rows,
  isIdc,
}: {
  targetSourceId: number;
  rows: readonly RequestResourceRow[];
  isIdc: boolean;
}): ReactElement {
  const list = useResourceListState();
  const [showingServices, setShowingServices] = useState<RequestResourceRow | null>(null);
  const [listenersOpen, setListenersOpen] = useState(false);
  /**
   * Three outcomes, three values — the queue request screen's own grammar
   * (`queue/requests/[targetSourceId]/page.tsx`): `undefined` = 아직 조회 중,
   * `null` = 조회 실패, 배열 = 정착. Folding the first two into `[]`/`null` made the
   * modals state something false: 사용 서비스 said 「조합을 불러오지 못했어요」 about a
   * request still in flight, and NLB 리스너 현황 drew the same empty table for loading
   * and for failure. Both modals read all three values now.
   *
   * Non-IDC targets never settle these — both entry points are IDC-only
   * (`ResourceSection` gates them on `isIdc`), so no modal can open to read them.
   */
  const [nlbTable, setNlbTable] = useState<NlbTableRow[] | null | undefined>(undefined);
  const [mappings, setMappings] = useState<ResourceNlbMappings[] | null | undefined>(undefined);

  // IDC only — both feed a lookup modal, so a failure leaves that modal saying so
  // rather than breaking the tab around it.
  useEffect(() => {
    if (!isIdc) return;
    const controller = new AbortController();
    void getNlbTable({ signal: controller.signal })
      .then((loaded) => setNlbTable(loaded))
      // An abort is not a failure — the remount that caused it is already fetching.
      .catch(() => {
        if (!controller.signal.aborted) setNlbTable(null);
      });
    void getNlbIndexMappings(targetSourceId, { signal: controller.signal })
      .then((loaded) => setMappings(loaded))
      .catch(() => {
        if (!controller.signal.aborted) setMappings(null);
      });
    return () => controller.abort();
  }, [isIdc, targetSourceId]);

  return (
    <div className="mt-6">
      <ResourceSection
        resources={rows}
        isIdc={isIdc}
        list={list}
        nlbLocked
        onAssignNlb={NOOP}
        onShowServices={setShowingServices}
        onOpenNlbListeners={() => setListenersOpen(true)}
      />
      <NlbListenerModal
        open={listenersOpen}
        onClose={() => setListenersOpen(false)}
        rows={nlbTable}
      />
      {showingServices != null && (
        <ServiceAssignmentModal
          key={showingServices.resourceId ?? 'services'}
          open
          onClose={() => setShowingServices(null)}
          resource={showingServices}
          mappings={mappings}
        />
      )}
    </div>
  );
}

export interface RequestTabProps {
  targetSourceId: number;
  detail: RawTargetSourceDetail;
}

export function RequestTab({ targetSourceId, detail }: RequestTabProps): ReactElement {
  const [request, setRequest] = useState<Load<ApprovalRequestDetail>>({ state: 'loading' });
  const [processed, setProcessed] = useState<ProcessedInfo | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;

    // 최근 승인 요청 + 요청 리소스.
    void (async () => {
      setRequest({ state: 'loading' });
      try {
        const loaded = await getApprovalRequestLatest(targetSourceId);
        if (!cancelled) setRequest({ state: 'ready', data: loaded });
      } catch (error) {
        if (cancelled) return;
        const absent = error instanceof AppError && error.code === 'NOT_FOUND';
        setRequest(absent ? { state: 'ready', data: null } : { state: 'failed' });
      }
    })();


    // 처리자 · 처리 일시 — the latest approval-history record. Best-effort
    // decoration of the 최근 승인 요청 card: a failure just hides the row.
    void (async () => {
      setProcessed(null);
      try {
        const page = await getApprovalHistory(targetSourceId, 0, 1);
        const item = ((page.content ?? []) as ApprovalHistoryItemWire[])[0];
        if (cancelled || !item?.result) return;
        setProcessed({
          requestId: item.request?.id ?? null,
          by: item.result.processed_by?.user_id ?? null,
          at: item.result.processed_at ?? null,
        });
      } catch {
        if (!cancelled) setProcessed(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [targetSourceId, reloadKey]);

  // Normalized, like every other read of this field: a raw compare flips on one casing
  // and would hand IDC rows to the cloud table — the exact defect this tab just fixed.
  const isIdc = normalizeCloudProvider(detail.cloud_provider) === 'IDC';


  const summary = request.state === 'ready' ? request.data?.request ?? null : null;
  const rows = request.state === 'ready' ? request.data?.resources ?? [] : [];

  // The 처리 row belongs to the latest request only — drop a stale history record.
  const processedRow =
    processed &&
    (processed.requestId == null || summary?.requestId == null || processed.requestId === summary.requestId)
      ? processed
      : null;

  const retryButton = (
    <PlButton variant="secondary" size="sm" className="mt-3" onClick={retry}>
      다시 시도
    </PlButton>
  );

  return (
    <section className={pipelineStyles.card.base} aria-label="최근 승인 요청">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className={opsStyles.cardTitle}>최근 승인 요청</h2>
          <p className={opsStyles.cardDesc}>
            {summary?.requestId != null
              ? `요청 ID #${summary.requestId}`
              : '서비스가 제출한 연동 요청의 승인 정보입니다.'}
          </p>
        </div>
        {/* The queue's request detail page is keyed by target source and opens the latest
            request — the same one this card shows. Only a request that exists has a page
            to open, so loading, failed and empty states draw no door. PlButton renders a
            <button>, so the link wears its classes (PipelineDetailView's pattern). */}
        {summary != null && (
          <Link
            href={passRoutes.pipelines.queue.request(targetSourceId)}
            className={cn(
              pipelineStyles.button.base,
              pipelineStyles.button.sm,
              pipelineStyles.button.secondary,
              'flex-none',
            )}
          >
            요청 상세 보기
          </Link>
        )}
      </div>

      {request.state === 'loading' ? (
        /* The settled card's own frame: the meta row over the resource list. Field labels
           are fixed strings, so they are drawn for real (`StatusCardSkeleton`'s rule) and
           the heights come from the same classes — StatusTag = py-0.5(4) + a 12px line
           box(16.8, the admin shell sets leading-1.4) ≈ 25px, and a MetaField = an 18px
           label line + gap-1(4) + a 12px/leading-1.3 value line(15.6) ≈ 37.6px, which the
           16px value bar rounds to 38.
           Not drawn: 처리자 · 처리일시 (whether this request was processed at all is what is
           loading), and the empty state a request with no resources settles into — the
           common case is a list, and `ResourceSectionSkeleton` is that list's own footprint,
           so the two surfaces cannot drift apart. */
        <div aria-busy>
          <span className="sr-only">불러오는 중</span>
          <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3">
            <span
              className={cn(opsStyles.skeletonBar, 'block h-[25px] w-[92px] rounded')}
              aria-hidden
            />
            {[
              { label: '요청자', width: 'w-[88px]' },
              { label: '요청일시', width: 'w-[124px]' },
            ].map((field) => (
              <div key={field.label} className="flex min-w-0 flex-col gap-1">
                {/* `MetaField` 의 라벨 그대로 (12 / 400 / tertiary) — 라벨은 지금 오는
                    값이 아니라 이 카드가 이미 아는 이름이라 실물로 선다. */}
                <span className={cn('text-[12px] font-normal', textColors.tertiary)}>
                  {field.label}
                </span>
                <span className={cn(opsStyles.skeletonBar, 'block h-4', field.width)} aria-hidden />
              </div>
            ))}
          </div>
          {/* `ResourceList` 가 세우는 그 여백 그대로 — 목록이 도착해도 y 가 움직이지 않는다. */}
          <div className="mt-6">
            <ResourceSectionSkeleton />
          </div>
        </div>
      ) : request.state === 'failed' ? (
        <div className={cn(pipelineStyles.empty.base, 'mt-2')}>
          <p>승인 요청 정보를 불러오지 못했습니다.</p>
          {retryButton}
        </div>
      ) : summary == null ? (
        <PlEmptyState icon="inbox" message="승인 요청 이력이 없습니다." className="mt-2" />
      ) : (
        <>
          {/* One card, one request. The KV table that used to state these same facts
              in its own card above meant the operator read a summary and then
              scrolled to the thing it summarised. Same header row as the 승인 요청
              상세 modal: the verdict once as a tag, the rest as label-over-value. */}
          <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3">
            <StatusTag status={summary.status} />
            <MetaField label="요청자" value={summary.requestedBy ?? '—'} />
            <MetaField label="요청일시" value={fmtDateTime(summary.requestedAt)} />
            {processedRow?.by && <MetaField label="처리자" value={processedRow.by} />}
            {processedRow?.at && <MetaField label="처리일시" value={fmtDateTime(processedRow.at)} />}
          </div>

          {rows.length === 0 ? (
            <PlEmptyState icon="inbox" message="요청 리소스가 없습니다." className="mt-4" />
          ) : (
            /* Keyed per request so the filter/search/page state below belongs to ONE
               request — this tab is not guaranteed to remount when the route's target
               source changes under a soft navigation. requestId is contractually
               nullable, so the target id joins the key: two id-less requests on
               different targets would otherwise share a key and inherit each other's
               query. */
            <ResourceList
              key={`${targetSourceId}:${summary.requestId ?? 'latest'}`}
              targetSourceId={targetSourceId}
              rows={rows}
              isIdc={isIdc}
            />
          )}
        </>
      )}
    </section>
  );
}
