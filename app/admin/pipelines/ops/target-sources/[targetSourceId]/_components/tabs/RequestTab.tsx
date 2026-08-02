'use client';

/**
 * 연동 요청 정보 tab — mirrors the approved mockup
 * (design/pipeline/ops-target-source-tabs.html `tabRequest`): 최근 승인 요청 +
 * 확정 정보 side by side, then the requested-resource table (cloud and IDC
 * column sets).
 *
 * Reads are independent and best-effort so a failing card never blanks its
 * sibling:
 *   - 최근 승인 요청 / 요청 리소스 → …/approval-requests/latest
 *   - 확정 정보                    → …/confirmed-integration (현재 확정 상태)
 *   - 처리 (처리자 · 처리 일시)     → …/approval-history (latest page item)
 * A missing snapshot (404) is an empty state, not a failure.
 */
import { useCallback, useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
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
  type ApprovalRequestDetail,
  type RequestResourceRow,
} from '@/app/lib/api/task-queue-requests';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import { Pagination } from '@/app/components/ui/Pagination';
import { WaitingApprovalStats } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStats';
import { WaitingApprovalToolbar } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar';
import {
  WaitingApprovalTable,
  type WaitingApprovalResource,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import { useApprovalTableState } from '@/app/target-sources/[targetSourceId]/_components/layout/useApprovalTableState';
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
  'inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold bg-[var(--pl-primary-bg)] text-[var(--pl-primary)] whitespace-nowrap';

const KV_GRID = 'grid grid-cols-[140px_1fr] items-center gap-x-4 gap-y-2.5 mt-3.5';

const NOTE_WARN =
  'flex gap-2.5 rounded-lg px-3.5 py-3 mt-4 text-[13px] leading-[1.5] bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]';

/**
 * 요청 리소스 → the same list the 승인 요청 상세 modal renders: stat tiles that ARE
 * the filter, search + condition popover, the shared approval table, pager footer.
 * One request, one presentation, wherever an operator opens it — this tab had its
 * own hand-rolled table with a different column order and no filtering at all.
 *
 * IDC carries no scan-assigned name, so its host/IP takes that seat. The wider IDC
 * column set (구분 · Port · Oracle SID · Source IP) is the same gap this list has in
 * the modal, tracked separately.
 */
const toApprovalRow = (row: RequestResourceRow, isIdc: boolean): WaitingApprovalResource => ({
  resourceId: row.resourceId ?? '',
  resourceType: row.databaseType ?? '',
  region: row.region ?? '',
  resourceName: isIdc ? row.connectTargets.join(' · ') : row.resourceName ?? '',
  selected: row.selected,
  displayDbType: row.databaseType ?? undefined,
  exclusionReason: row.exclusionReason ?? undefined,
});

const FILTER_EMPTY_MESSAGE = '조건에 맞는 결과가 없어요.';

const dash = (): ReactElement => <span className={pipelineStyles.text.muted}>—</span>;

const orDash = (value: string | number | null | undefined): ReactNode =>
  value == null || value === '' ? dash() : value;

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
  // Memoized off the loaded array itself — a fresh `[]` literal per render would make
  // the row mapping below (and the table state keyed on it) churn on every render.
  const loadedResources = request.state === 'ready' ? request.data?.resources : undefined;
  const rows = useMemo(() => loadedResources ?? [], [loadedResources]);

  const approvalRows = useMemo<readonly WaitingApprovalResource[]>(
    () => rows.map((row) => toApprovalRow(row, isIdc)),
    [rows, isIdc],
  );
  const table = useApprovalTableState(approvalRows);
  const showFilterEmpty = approvalRows.length > 0 && table.filteredCount === 0;

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
      <div className={opsStyles.cardsRow}>
        <section className={pipelineStyles.card.base} aria-label="최근 승인 요청">
          <h2 className={opsStyles.cardTitle}>최근 승인 요청</h2>
          <p className={opsStyles.cardDesc}>서비스가 제출한 연동 요청의 승인 정보입니다.</p>

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
            <dl className={KV_GRID}>
              <KvRow label="요청 ID">
                <span className={pipelineStyles.text.kvValueMono}>
                  {summary.requestId != null ? `#${summary.requestId}` : '—'}
                </span>
              </KvRow>
              <KvRow label="상태">
                <StatusTag status={summary.status} />
              </KvRow>
              <KvRow label="요청자">{orDash(summary.requestedBy)}</KvRow>
              {/* 리소스 선택 n/m is deliberately absent: the 요청 리소스 card directly
                  below opens with those counts as 40px tiles that are also its filter,
                  so stating them here put an unactionable number above an actionable one. */}
              <KvRow label="요청 일시">{fmtDateTime(summary.requestedAt)}</KvRow>
              {processedRow && (
                <KvRow label="처리">
                  {[processedRow.by, processedRow.at ? fmtDateTime(processedRow.at) : null]
                    .filter((part): part is string => part != null)
                    .join(' · ') || '—'}
                </KvRow>
              )}
            </dl>
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
      </div>

      <section className={pipelineStyles.card.base} aria-label="요청 리소스">
        <h2 className={opsStyles.cardTitle}>요청 리소스</h2>

        {request.state === 'loading' ? (
          <p className={cn(pipelineStyles.empty.base, 'mt-2')} aria-busy>
            불러오는 중…
          </p>
        ) : request.state === 'failed' ? (
          <div className={cn(pipelineStyles.empty.base, 'mt-2')}>
            <p>요청 리소스를 불러오지 못했습니다.</p>
            {retryButton}
          </div>
        ) : rows.length === 0 ? (
          <PlEmptyState icon="inbox" message="요청 리소스가 없습니다." className="mt-2" />
        ) : (
          <div className="mt-3">
            {/* The counts ARE the 전체/대상/제외 filter — the read-only
                "연동 대상 n개 · 제외 m개" line they replace could not be acted on. */}
            <WaitingApprovalStats
              totalCount={table.countsByFilter.all}
              selectedCount={table.countsByFilter.target}
              excludedCount={table.countsByFilter.excluded}
              filter={table.filter}
              onFilterChange={table.onFilterChange}
            />
            <WaitingApprovalToolbar
              searchValue={table.searchValue}
              onSearchChange={table.onSearchChange}
              dbType={table.dbType}
              onDbTypeChange={table.onDbTypeChange}
              region={table.region}
              onRegionChange={table.onRegionChange}
              dbTypeOptions={table.dbTypeOptions}
              regionOptions={table.regionOptions}
            />
            <WaitingApprovalTable
              resources={table.visibleResources}
              connected
              emptyMessage={showFilterEmpty ? FILTER_EMPTY_MESSAGE : undefined}
            />
            {table.filteredCount > 0 && (
              <Pagination
                page={table.safePage}
                pageSize={table.pageSize}
                totalCount={table.filteredCount}
                onPageChange={table.onPageChange}
                onPageSizeChange={table.onPageSizeChange}
              />
            )}
          </div>
        )}
      </section>
    </>
  );
}
