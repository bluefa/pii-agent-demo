'use client';

/**
 * 연동 요청 정보 tab — mirrors the approved mockup
 * (design/pipeline/ops-target-source-tabs.html `tabRequest`), with 최근 승인 요청
 * folded into ONE card — the request's facts as a header row over the resource
 * list itself, the same shape the 승인 요청 상세 modal uses — and 확정 정보 below it.
 *
 * Reads are independent and best-effort so a failing card never blanks its
 * sibling:
 *   - 최근 승인 요청 / 요청 리소스 → …/approval-requests/latest
 *   - 확정 정보                    → …/confirmed-integration (현재 확정 상태)
 *   - 처리 (처리자 · 처리 일시)     → …/approval-history (latest page item)
 * A missing snapshot (404) is an empty state, not a failure.
 */
import { useCallback, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { AppError, isMissingConfirmedIntegrationError } from '@/lib/errors';
import { fmtDateTime } from '@/lib/pipeline/format';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import {
  getApprovalHistory,
  getConfirmedIntegration,
  type ConfirmedIntegrationResourceItem,
} from '@/app/lib/api';
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
import { ResourceSection } from '@/app/admin/pipelines/queue/requests/_components/ResourceSection';
import { NlbListenerModal } from '@/app/admin/pipelines/queue/requests/_components/NlbListenerModal';
import { ServiceAssignmentModal } from '@/app/admin/pipelines/queue/requests/_components/ServiceAssignmentModal';
import { useResourceListState } from '@/app/admin/pipelines/queue/requests/_resourceQuery';
import { MetaField } from '@/app/target-sources/[targetSourceId]/_components/shared/MetaField';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

/** `data: null` = the snapshot does not exist yet (404), not a failure. */
type Load<T> = { state: 'loading' } | { state: 'ready'; data: T | null } | { state: 'failed' };

/** 확정 정보 source — confirmed-integration rows (contract carries resources only,
 *  no 확정 일시/확정자, so the card scopes down to what the wire declares). */
type ConfirmedRows = ConfirmedIntegrationResourceItem[];

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

/** Database Type tag — mockup `.tag.blue` (opsStyles.tag in primary tones). */
const DB_TAG =
  'inline-flex items-center rounded px-2 py-0.5 text-[12px] font-semibold bg-[var(--pl-primary-bg)] text-[var(--pl-primary)] whitespace-nowrap';

const KV_GRID = 'grid grid-cols-[140px_1fr] items-center gap-x-4 gap-y-2.5 mt-3.5';

const NOTE_WARN =
  'flex gap-2.5 rounded-lg px-3.5 py-3 mt-4 text-[14px] leading-[1.5] bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]';

const dash = (): ReactElement => <span className={pipelineStyles.text.muted}>—</span>;

function KvRow({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <>
      <dt className={pipelineStyles.text.kvKey}>{label}</dt>
      <dd className={pipelineStyles.text.kvValue}>{children}</dd>
    </>
  );
}

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
 */
function ResourceList({
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
  const [nlbTable, setNlbTable] = useState<NlbTableRow[]>([]);
  // null = the fetch failed, which ServiceAssignmentModal says outright instead of
  // passing for "배정 없음".
  const [mappings, setMappings] = useState<ResourceNlbMappings[] | null>(null);

  // IDC only — both feed a lookup modal, so a failure leaves that modal empty rather
  // than breaking the tab around it.
  useEffect(() => {
    if (!isIdc) return;
    const controller = new AbortController();
    void getNlbTable({ signal: controller.signal })
      .then((loaded) => setNlbTable(loaded))
      .catch(() => {});
    void getNlbIndexMappings(targetSourceId, { signal: controller.signal })
      .then((loaded) => setMappings(loaded))
      .catch(() => setMappings(null));
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
  const [confirmed, setConfirmed] = useState<Load<ConfirmedRows>>({ state: 'loading' });
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

    // 확정 정보 — the confirmed-integration state (the current confirmed truth;
    // an absent snapshot 404s and an empty list both read as "not confirmed yet").
    void (async () => {
      setConfirmed({ state: 'loading' });
      try {
        const data = await getConfirmedIntegration(targetSourceId);
        if (cancelled) return;
        const rows = data.resource_infos ?? [];
        setConfirmed({ state: 'ready', data: rows.length > 0 ? rows : null });
      } catch (error) {
        if (cancelled) return;
        setConfirmed(
          isMissingConfirmedIntegrationError(error)
            ? { state: 'ready', data: null }
            : { state: 'failed' },
        );
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

  const isIdc = detail.cloud_provider === 'IDC';

  const confirmedDbTypes =
    confirmed.state === 'ready' && confirmed.data
      ? [
          ...new Set(
            confirmed.data
              .map((row) => row.database_type)
              .filter((type): type is string => !!type)
              .map(getDatabaseShortLabel),
          ),
        ]
      : [];

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
    <>
      <section className={pipelineStyles.card.base} aria-label="최근 승인 요청">
        <h2 className={opsStyles.cardTitle}>최근 승인 요청</h2>
        <p className={opsStyles.cardDesc}>
          {summary?.requestId != null
            ? `요청 ID #${summary.requestId}`
            : '서비스가 제출한 연동 요청의 승인 정보입니다.'}
        </p>

        {request.state === 'loading' ? (
          <p className={cn(pipelineStyles.empty.base, 'mt-2')} aria-busy>
            불러오는 중…
          </p>
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

      <section className={pipelineStyles.card.base} aria-label="확정 정보">
        <h2 className={opsStyles.cardTitle}>확정 정보</h2>
        <p className={opsStyles.cardDesc}>
          승인 후 확정된 연동 대상입니다. 설치 파이프라인의 입력이 됩니다.
        </p>

        {confirmed.state === 'loading' ? (
          <p className={cn(pipelineStyles.empty.base, 'mt-2')} aria-busy>
            불러오는 중…
          </p>
        ) : confirmed.state === 'failed' ? (
          <div className={cn(pipelineStyles.empty.base, 'mt-2')}>
            <p>확정 정보를 불러오지 못했습니다.</p>
            {retryButton}
          </div>
        ) : confirmed.data == null ? (
          <PlEmptyState icon="install" message="확정된 연동 정보가 없습니다." className="mt-2" />
        ) : (
          <>
            <dl className={KV_GRID}>
              <KvRow label="확정 리소스">{confirmed.data.length}개</KvRow>
              <KvRow label="Database Type">
                {confirmedDbTypes.length > 0 ? (
                  <span className="inline-flex flex-wrap gap-1.5">
                    {confirmedDbTypes.map((type) => (
                      <span key={type} className={DB_TAG}>
                        {type}
                      </span>
                    ))}
                  </span>
                ) : (
                  dash()
                )}
              </KvRow>
            </dl>
            <p className={NOTE_WARN}>
              확정 정보를 삭제하면 재승인 절차를 처음부터 다시 진행해야 합니다.
            </p>
          </>
        )}
      </section>
    </>
  );
}
