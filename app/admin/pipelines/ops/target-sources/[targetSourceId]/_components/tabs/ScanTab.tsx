'use client';

/**
 * 스캔 tab — 스캔 권한(자격 검증) + 최근 스캔 카드를 한 행에, 그 아래 paged 스캔
 * 이력 table (docs 정의: 운영자 질문 순서 — 돌고 있나 / 언제·성공했나 / 실패 왜 /
 * 자격 유효한가 / 뭘 발견했나 / 과거 패턴).
 * Latest job comes from useScanPolling, so a running scan animates and a 404
 * (never scanned) surfaces as the empty state rather than an error.
 * 표시 규칙: 진행 바는 SCANNING에서만(끝난 스캔이 0%를 말하는 착시 제거), 발견
 * 리소스는 개수 내림차순 태그(프로바이더 접두어 트림), 이력의 발견 셀은 총계
 * 언더라인 → 클릭 시 모달로 전량.
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import { getScanHistory, startScan } from '@/app/lib/api/scan';
import { useScanPolling } from '@/app/hooks/useScanPolling';
import { normalizeCloudProvider, type CloudProvider } from '@/lib/types';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { ScanCredentialCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/ScanCredentialCard';

type ScanJob = z.infer<typeof schemas.ScanJobResponse>;

const PAGE_SIZE = 5;

type Tone = 'ok' | 'info' | 'err' | 'off';

const TONE_CLASS: Record<Tone, { pill: string; dot: string }> = {
  ok: { pill: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]', dot: 'bg-[var(--pl-ok)]' },
  info: { pill: 'bg-[var(--pl-info-bg)] text-[var(--pl-info-text)]', dot: 'bg-[var(--pl-info)]' },
  err: { pill: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]', dot: 'bg-[var(--pl-err)]' },
  off: { pill: 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)]', dot: 'bg-[var(--pl-gray-300)]' },
};

/** ScanStatus (app/api/_lib/v1-types.ts) → tone + Korean label. */
const SCAN_STATUS: Record<string, { tone: Tone; label: string }> = {
  SUCCESS: { tone: 'ok', label: '성공' },
  SCANNING: { tone: 'info', label: '스캔 중' },
  FAIL: { tone: 'err', label: '실패' },
  TIMEOUT: { tone: 'err', label: '타임아웃' },
  CANCELED: { tone: 'off', label: '취소' },
};

const SCAN_ERROR_LABEL: Record<string, string> = {
  AUTH_PERMISSION_ERROR: '권한 오류입니다. 스캔 권한 카드에서 자격을 검증해 주세요.',
  RATE_LIMIT: '요청 한도 초과',
  NETWORK_ERROR: '네트워크 오류',
  SERVICE_ERROR: '클라우드 서비스 오류',
  UNKNOWN: '알 수 없는 오류',
};

const errorLabel = (code: string): string => SCAN_ERROR_LABEL[code] ?? SCAN_ERROR_LABEL.UNKNOWN;

const CAPTION = 'text-[12px] text-[var(--pl-text-weak)]';
const CAPTION_VALUE = 'font-semibold text-[var(--pl-text-strong)]';

/** 214.6s → '3분 34초', 44s → '44초'; unknown → '—'. */
const fmtDuration = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—';
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return minutes > 0 ? `${minutes}분 ${String(rest).padStart(2, '0')}초` : `${rest}초`;
};

const fmtPercent = (progress: number | null | undefined): number => {
  if (progress === null || progress === undefined || !Number.isFinite(progress)) return 0;
  return Math.min(100, Math.max(0, Math.round(progress)));
};

/** 카운트 맵 → [type, count] 배열, 개수 내림차순·동률은 이름순. */
export const sortResourceCounts = (
  counts: Record<string, number | null | undefined> | null | undefined,
): Array<[string, number]> =>
  Object.entries(counts ?? {})
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

/**
 * 한 타깃 안에선 프로바이더가 상수라 AWS_/AZURE_/GCP_ 접두어는 중복 정보 —
 * 표시는 트림하고 전체 키는 title로 남긴다. 모르는 접두어는 그대로(열린 집합).
 */
export const trimProviderPrefix = (type: string, provider: CloudProvider): string => {
  const prefix = `${provider.toUpperCase()}_`;
  return type.startsWith(prefix) ? type.slice(prefix.length) : type;
};

const totalOf = (entries: Array<[string, number]>): number =>
  entries.reduce((sum, [, count]) => sum + count, 0);

function ScanStatusPill({ status }: { status: string | null | undefined }): ReactElement {
  const spec = (status && SCAN_STATUS[status]) || { tone: 'off' as Tone, label: status ?? '-' };
  const tone = TONE_CLASS[spec.tone];
  return (
    <span className={cn(pipelineStyles.pill.base, pipelineStyles.pill.md, tone.pill)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} aria-hidden />
      {spec.label}
    </span>
  );
}

/** 발견 리소스 태그 — 저채도(흰 배경) + 스트로크 + 섀도, wire 키는 mono 그대로. */
function ResourceTypeTag({
  type,
  count,
  provider,
}: {
  type: string;
  count: number;
  provider: CloudProvider;
}): ReactElement {
  return (
    <span
      title={type}
      className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--pl-border)] bg-white px-2.5 py-[5px] text-[11px] font-semibold text-[var(--pl-text-medium)] shadow-[var(--pl-shadow-xs)] [font-family:var(--pl-font-mono)]"
    >
      {trimProviderPrefix(type, provider)}
      <b className="text-[12px] font-bold tabular-nums text-[var(--pl-text-strong)]">{count}</b>
    </span>
  );
}

export interface ScanTabProps {
  targetSourceId: number;
  detail: RawTargetSourceDetail;
}

export function ScanTab({ targetSourceId, detail }: ScanTabProps): ReactElement {
  const provider = normalizeCloudProvider(detail.cloud_provider);
  const { latestJob: rawLatestJob, loading, error, refresh } = useScanPolling(targetSourceId);
  // The mock latest endpoint answers a NO_SCAN placeholder instead of 404 for a
  // never-scanned target — normalize it to "no scan yet" so the empty state wins.
  const latestJob = rawLatestJob?.scan_status === 'NO_SCAN' ? null : rawLatestJob;
  const [starting, setStarting] = useState(false);
  const [startFailed, setStartFailed] = useState(false);

  const [rows, setRows] = useState<ScanJob[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyFailed, setHistoryFailed] = useState(false);
  /** 이력 셀 클릭으로 여는 발견 리소스 전량 모달의 대상 잡. */
  const [breakdownJob, setBreakdownJob] = useState<ScanJob | null>(null);

  // Latest-request-wins: rapid pagination can resolve out of order, and a stale
  // response must not commit page/rows over a newer one.
  const historySeq = useRef(0);
  const loadHistory = useCallback(async (nextPage: number): Promise<void> => {
    const seq = ++historySeq.current;
    setHistoryLoading(true);
    setHistoryFailed(false);
    try {
      const data = await getScanHistory(targetSourceId, nextPage, PAGE_SIZE);
      if (seq !== historySeq.current) return;
      setRows(data.content ?? []);
      setTotalPages(Math.max(1, data.totalPages ?? 1));
      setPage(nextPage);
    } catch {
      if (seq !== historySeq.current) return;
      setHistoryFailed(true);
    } finally {
      if (seq === historySeq.current) setHistoryLoading(false);
    }
  }, [targetSourceId]);

  useEffect(() => {
    void loadHistory(0);
  }, [loadHistory]);

  const scanning = latestJob?.scan_status === 'SCANNING';

  // A finished scan adds a history row whatever its outcome, so reload on the
  // SCANNING→terminal edge (not only on success). The ref starts false, so
  // mounting on an already-terminal job does not double-fetch page 0.
  const wasScanningRef = useRef(false);
  useEffect(() => {
    if (wasScanningRef.current && !scanning) void loadHistory(0);
    wasScanningRef.current = scanning;
  }, [scanning, loadHistory]);

  const runScan = useCallback(async (): Promise<void> => {
    setStarting(true);
    setStartFailed(false);
    try {
      await startScan(targetSourceId);
      // Pull the new job in immediately — useScanPolling resumes polling by
      // itself once it observes SCANNING.
      await refresh();
    } catch {
      setStartFailed(true);
    } finally {
      setStarting(false);
    }
  }, [targetSourceId, refresh]);

  const { table } = opsStyles;
  const latestCounts = sortResourceCounts(latestJob?.resource_count_by_resource_type);
  const latestTotal = totalOf(latestCounts);

  // 직전 성공 대비 증감 — 이력 1페이지에서 파생한다.
  // ponytail: 직전 성공이 1페이지(5행) 밖이면 증감을 생략한다. 필요해지면 서버 파생으로.
  const prevSuccess =
    latestJob?.scan_status === 'SUCCESS'
      ? rows.find(
          (row) =>
            row.id !== latestJob.id
            && row.scan_status === 'SUCCESS'
            && row.resource_count_by_resource_type != null,
        )
      : undefined;
  const countDiff = prevSuccess
    ? latestTotal - totalOf(sortResourceCounts(prevSuccess.resource_count_by_resource_type))
    : null;

  const breakdownCounts = sortResourceCounts(breakdownJob?.resource_count_by_resource_type);

  const recentScanCard = (
    <section className={pipelineStyles.card.base} aria-label="최근 스캔">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className={cn(opsStyles.cardTitle, 'flex items-center gap-2')}>
            <Icon name="search" size="md" className="text-[var(--pl-primary)]" />
            최근 스캔
          </h2>
          <p className={opsStyles.cardDesc}>
            클라우드 리소스를 스캔해 연동 가능한 대상 목록을 갱신합니다.
          </p>
        </div>
        {/* 새로고침 삭제 — 스캔 중엔 useScanPolling이 2초 폴링, 이 탭에서 실행한
            스캔은 refresh()가 즉시 반영한다. 다른 화면에서 시작된 스캔은 탭
            재진입으로만 보인다(폴링은 SCANNING 동안만 도는 트레이드오프). */}
        <PlButton
          variant="primary"
          className="flex-none"
          disabled={scanning || starting}
          onClick={() => void runScan()}
        >
          <Icon
            name={scanning || starting ? 'loader' : 'play'}
            size="sm"
            className={scanning || starting ? 'animate-spin' : undefined}
          />
          {scanning ? '스캔 중…' : starting ? '시작 중…' : '스캔 실행'}
        </PlButton>
      </div>

      {startFailed && (
        <p className="mt-4 rounded-lg bg-[var(--pl-err-bg)] px-3 py-2.5 text-[13px] text-[var(--pl-err-text)]">
          스캔을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      )}

      {loading && !latestJob ? (
        <p className={cn(pipelineStyles.text.meta, 'mt-4')} aria-busy>
          불러오는 중…
        </p>
      ) : !latestJob ? (
        error ? (
          <p className={cn(pipelineStyles.text.meta, 'mt-4')}>스캔 정보를 불러오지 못했습니다.</p>
        ) : (
          <PlEmptyState icon="search" message="스캔 이력이 없습니다." className="mt-2" />
        )
      ) : (
        <>
          {/* 계층: 결과행(판정+시점·소요 캡션) > 발견 리소스(주인공) > 참조행(Scan#·버전).
              완료된 스캔의 답은 "뭘 찾았나"다 — 메타는 캡션으로 물러난다. */}
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <ScanStatusPill status={latestJob.scan_status} />
            <span className={CAPTION}>
              실행 <b className={CAPTION_VALUE}>{fmtDateTime(latestJob.created_at)}</b>
              {!scanning && (
                <>
                  {' · '}소요 <b className={CAPTION_VALUE}>{fmtDuration(latestJob.duration_seconds)}</b>
                </>
              )}
            </span>
          </div>

          {/* 진행 바는 SCANNING에서만 — 끝난 스캔의 진행률은 정보가 아니라 착시다. */}
          {scanning && (
            <div className="mt-3.5 flex items-center gap-3">
              <div
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--pl-gray-100)]"
                role="progressbar"
                aria-valuenow={fmtPercent(latestJob.scan_progress)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-[var(--pl-primary)]"
                  style={{ width: `${fmtPercent(latestJob.scan_progress)}%` }}
                />
              </div>
              <span className="text-[12px] font-semibold tabular-nums text-[var(--pl-text-medium)]">
                {fmtPercent(latestJob.scan_progress)}%
              </span>
            </div>
          )}

          {/* 발견 리소스 — 성공/진행 중에만. 실패는 결과가 아니라 원인(오류 박스)을 말한다. */}
          {(scanning || latestJob.scan_status === 'SUCCESS') && (
            <div className="mt-5">
              <p className={pipelineStyles.text.kvKey}>발견 리소스</p>
              {scanning ? (
                <p className={cn(pipelineStyles.text.meta, 'mt-1.5')}>스캔 완료 후 집계돼요.</p>
              ) : latestCounts.length === 0 ? (
                <p className={cn(pipelineStyles.text.meta, 'mt-1.5')}>발견된 리소스가 없습니다.</p>
              ) : (
                <>
                  {/* 총계가 카드의 주인공 — 20/700, 단위는 값의 꼬리표 계층 (step2 타일 교훈). */}
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-[20px] font-bold leading-[28px] tabular-nums text-[var(--pl-text-strong)]">
                      {latestTotal}
                      <span className="ml-0.5 text-[12px] font-medium text-[var(--pl-text-weak)]">개</span>
                    </span>
                    {countDiff !== null && countDiff !== 0 && (
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11.5px] font-bold tabular-nums',
                          countDiff > 0
                            ? 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]'
                            : 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)]',
                        )}
                        title="직전 성공 스캔 대비"
                      >
                        {countDiff > 0 ? `+${countDiff}` : countDiff}
                      </span>
                    )}
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {latestCounts.map(([type, count]) => (
                      <ResourceTypeTag key={type} type={type} count={count} provider={provider} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {latestJob.scan_error && (
            <p className="mt-4 rounded-lg bg-[var(--pl-err-bg)] px-3 py-2.5 text-[13px] text-[var(--pl-err-text)]">
              <span className="[font-family:var(--pl-font-mono)] font-semibold">{latestJob.scan_error}</span>
              <span className="ml-2">{errorLabel(latestJob.scan_error)}</span>
            </p>
          )}

          {/* 참조행 — Scan #·버전은 로그 대조용 참조 정보라 최하위 계층.
              (목의 #가 Date.now() 합성이라 커 보일 뿐, 계약 필드는 실존한다.) */}
          <p className="mt-4 border-t border-[var(--pl-gray-100)] pt-3 text-[12px] text-[var(--pl-text-faint)]">
            {latestJob.id !== undefined && (
              <>
                Scan <span className="[font-family:var(--pl-font-mono)]">#{latestJob.id}</span>
                {' · '}
              </>
            )}
            <span className="[font-family:var(--pl-font-mono)]">v{latestJob.scan_version ?? '-'}</span>
          </p>
        </>
      )}
    </section>
  );

  return (
    <>
      {/* IDC는 클라우드 스캔 자격이 없어 권한 카드를 렌더하지 않는다 — 최근 스캔이 전폭. */}
      {provider === 'IDC' ? (
        recentScanCard
      ) : (
        <div className={opsStyles.cardsRow}>
          <ScanCredentialCard provider={provider} targetSourceId={targetSourceId} />
          {recentScanCard}
        </div>
      )}

      <section className={pipelineStyles.card.base} aria-label="스캔 이력">
        <h2 className={cn(opsStyles.cardTitle, 'flex items-center gap-2')}>
          <Icon name="clock" size="md" className="text-[var(--pl-primary)]" />
          스캔 이력
        </h2>

        {historyLoading ? (
          <div className="min-h-[160px]" aria-busy />
        ) : historyFailed ? (
          <div className={cn(pipelineStyles.empty.base, 'mt-2')}>
            <p>스캔 이력을 불러오지 못했습니다.</p>
            <PlButton variant="secondary" className="mt-3" onClick={() => void loadHistory(page)}>
              다시 시도
            </PlButton>
          </div>
        ) : rows.length === 0 ? (
          <PlEmptyState icon="search" message="스캔 이력이 없습니다." className="mt-2" />
        ) : (
          <div className={cn(pipelineStyles.card.tableWrap, 'mt-3')}>
            <table className={table.base}>
              <thead>
                <tr>
                  <th className={table.headCell}>실행 일시</th>
                  <th className={table.headCell}>상태</th>
                  <th className={table.headCell}>버전</th>
                  <th className={table.headCell}>발견 리소스</th>
                  <th className={table.headCell}>소요</th>
                  <th className={table.headCell}>오류</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const rowCounts = sortResourceCounts(row.resource_count_by_resource_type);
                  return (
                    <tr key={row.id ?? `${row.created_at ?? ''}-${index}`}>
                      <td className={cn(table.cell, 'whitespace-nowrap')}>{fmtDateTime(row.created_at)}</td>
                      <td className={table.cell}>
                        <ScanStatusPill status={row.scan_status} />
                      </td>
                      <td className={cn(table.cell, '[font-family:var(--pl-font-mono)]')}>
                        v{row.scan_version ?? '-'}
                      </td>
                      <td className={cn(table.cell, 'tabular-nums')}>
                        {rowCounts.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setBreakdownJob(row)}
                            className="font-semibold text-[var(--pl-text-medium)] underline decoration-[var(--pl-text-faint)] underline-offset-[3px] transition-colors hover:text-[var(--pl-primary)] hover:decoration-[var(--pl-primary)]"
                          >
                            {totalOf(rowCounts)}개
                          </button>
                        ) : (
                          <span className="text-[var(--pl-text-faint)]">—</span>
                        )}
                      </td>
                      <td className={cn(table.cell, 'whitespace-nowrap')}>{fmtDuration(row.duration_seconds)}</td>
                      <td className={table.cell}>
                        {row.scan_error ? (
                          <span
                            className={cn(
                              opsStyles.statusTag,
                              'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
                            )}
                            title={errorLabel(row.scan_error)}
                          >
                            {row.scan_error}
                          </span>
                        ) : (
                          <span className="text-[var(--pl-text-faint)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <OpsPagination page={page} totalPages={totalPages} onChange={(next) => void loadHistory(next)} />
      </section>

      {/* 이력 발견 셀 클릭 → 해당 실행의 타입별 전량 (최근 스캔 카드와 같은 태그 문법). */}
      <ModalShell
        open={breakdownJob !== null}
        onClose={() => setBreakdownJob(null)}
        labelledBy="scan-breakdown-title"
      >
        {breakdownJob && (
          <>
            <h3 id="scan-breakdown-title" className="text-[16px] font-semibold text-[var(--pl-text-strong)]">
              발견 리소스
            </h3>
            <p className="mt-1 text-[12.5px] text-[var(--pl-text-weak)]">
              {fmtDateTime(breakdownJob.created_at)} · 총{' '}
              <b className="font-bold text-[var(--pl-text-strong)] tabular-nums">{totalOf(breakdownCounts)}개</b>
              {' · '}
              {breakdownCounts.length}타입
            </p>
            <div className="mt-4 flex max-h-[320px] flex-wrap gap-2 overflow-y-auto">
              {breakdownCounts.map(([type, count]) => (
                <ResourceTypeTag key={type} type={type} count={count} provider={provider} />
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <PlButton variant="secondary" onClick={() => setBreakdownJob(null)}>
                닫기
              </PlButton>
            </div>
          </>
        )}
      </ModalShell>
    </>
  );
}
