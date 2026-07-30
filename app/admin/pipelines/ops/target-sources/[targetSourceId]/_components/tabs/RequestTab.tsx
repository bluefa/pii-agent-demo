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
  type ApprovalRequestDetail,
  type RequestResourceRow,
} from '@/app/lib/api/task-queue-requests';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
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

const CLOUD_COLUMNS = [
  'Database Type',
  'Resource ID',
  'Region',
  'Resource Name',
  '연동 대상',
  '제외 사유',
] as const;

const IDC_COLUMNS = [
  '구분',
  'Database Type',
  '호스트 · IP',
  'Port',
  'Oracle SID',
  'Source IP',
  '연동 대상',
  '제외 사유',
] as const;

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

/** 연동 대상 / 제외 dot pill. */
function TargetPill({ selected }: { selected: boolean }): ReactElement {
  const tone = TONE[selected ? 'ok' : 'off'];
  const { pill } = pipelineStyles;
  return (
    <span className={cn(pill.base, pill.md, tone.fill)}>
      <span className={cn('h-1.5 w-1.5 rounded-full flex-none', tone.dot)} aria-hidden />
      {selected ? '대상' : '제외'}
    </span>
  );
}

function ResourceCells({ row, isIdc }: { row: RequestResourceRow; isIdc: boolean }): ReactElement {
  const { cell } = opsStyles.table;
  const mono = pipelineStyles.text.mono;
  // wire 는 소문자 원문(mysql·athena)이라 사용자 화면과 같은 표기로 맞춘다.
  const dbTag = (
    <span className={DB_TAG}>
      {row.databaseType ? getDatabaseShortLabel(row.databaseType) : '—'}
    </span>
  );
  const target = (
    <>
      <td className={cell}>
        <TargetPill selected={row.selected} />
      </td>
      <td className={cell}>{orDash(row.selected ? null : row.exclusionReason)}</td>
    </>
  );

  if (isIdc) {
    return (
      <>
        <td className={cell}>{orDash(row.idcKind === 'HOST' ? 'Host' : row.idcKind)}</td>
        <td className={cell}>{dbTag}</td>
        <td className={cell}>
          <span className={mono}>{row.connectTargets.join(' · ') || '—'}</span>
        </td>
        <td className={cell}>
          <span className={mono}>{row.port ?? '—'}</span>
        </td>
        <td className={cell}>{orDash(row.oracleSid)}</td>
        <td className={cell}>
          <span className={mono}>{row.sourceIps.join(' · ') || '—'}</span>
        </td>
        {target}
      </>
    );
  }

  return (
    <>
      <td className={cell}>{dbTag}</td>
      <td className={cell}>
        <span className={mono}>{row.resourceId ?? '—'}</span>
      </td>
      <td className={cell}>{orDash(row.region)}</td>
      <td className={cell}>{orDash(row.resourceName)}</td>
      {target}
    </>
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
  const columns = isIdc ? IDC_COLUMNS : CLOUD_COLUMNS;

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
  const selectedCount = summary?.resourceSelectedCount ?? rows.filter((row) => row.selected).length;
  const totalCount = summary?.resourceTotalCount ?? rows.length;
  const excludedCount = Math.max(0, totalCount - selectedCount);

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
              <KvRow label="요청 일시">{fmtDateTime(summary.requestedAt)}</KvRow>
              <KvRow label="리소스 선택">
                {selectedCount} / {totalCount}
              </KvRow>
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
        {/* Counts are only meaningful once the request loaded. */}
        {request.state === 'ready' && (
          <p className={opsStyles.cardDesc}>
            연동 대상 {selectedCount}개 · 제외 {excludedCount}개
          </p>
        )}

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
          <div className={cn(pipelineStyles.card.tableWrap, 'mt-3')}>
            <table className={opsStyles.table.base}>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column} className={opsStyles.table.headCell}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {rows.map((row, index) => (
                  <tr key={row.resourceId ?? index} className={opsStyles.table.rowHover}>
                    <ResourceCells row={row} isIdc={isIdc} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
