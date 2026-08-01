'use client';

/**
 * 스캔 tab — 스캔 권한(자격 검증) + 최근 스캔 카드를 한 행에, 그 아래 paged 스캔
 * 이력 table (docs 정의: 운영자 질문 순서 — 돌고 있나 / 언제·성공했나 / 실패 왜 /
 * 자격 유효한가 / 뭘 발견했나 / 과거 패턴).
 * Latest job comes from useScanPolling, so a running scan animates and a 404
 * (never scanned) surfaces as the empty state rather than an error.
 * 표시 규칙: 진행 바는 SCANNING에서만(끝난 스캔이 0%를 말하는 착시 제거), 발견
 * 리소스는 개수 내림차순 태그(프로바이더 접두어 트림), 이력은 행 클릭 → 모달로
 * 상세(최근 스캔 카드와 같은 계층: 판정 → 스캔 결과 → 오류 → 시각행).
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTime, fmtDateTimeSec } from '@/lib/pipeline/format';
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

// 도트 없는 틴트 pill — 라벨과 색이 이미 상태를 말해서 도트는 같은 말의 반복(운영 피드백).
const TONE_CLASS: Record<Tone, string> = {
  ok: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]',
  info: 'bg-[var(--pl-info-bg)] text-[var(--pl-info-text)]',
  err: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
  off: 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)]',
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

/** 하단 시각행 전용 필드 — 콘텐츠(kv)가 아니라 메타데이터 톤: 라벨 faint, 값 14/medium. */
function TimeField({ label, children }: { label: string; children: React.ReactNode }): ReactElement {
  return (
    <div className="min-w-0">
      <p className="text-[12px] font-medium text-[var(--pl-text-faint)]">{label}</p>
      <p className="mt-0.5 whitespace-nowrap text-[14px] font-medium tabular-nums text-[var(--pl-text-medium)]">
        {children}
      </p>
    </div>
  );
}

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

/** 운영 규모(수만 단위) 카운트용 천 단위 콤마 — 로케일 고정(SSR/CSR 불일치 방지). */
const fmtCount = (n: number): string => n.toLocaleString('ko-KR');

function ScanStatusPill({ status }: { status: string | null | undefined }): ReactElement {
  const spec = (status && SCAN_STATUS[status]) || { tone: 'off' as Tone, label: status ?? '-' };
  return (
    <span className={cn(pipelineStyles.pill.base, pipelineStyles.pill.md, TONE_CLASS[spec.tone])}>
      {spec.label}
    </span>
  );
}

/**
 * 발견 리소스 스탯 타일 — 라벨(12/500 weak, mono) 위 / 숫자(16/500 strong) 아래.
 * 인라인 태그 나열은 숫자가 정렬되지 않아 규모 비교가 안 된다는 운영 피드백으로
 * 그리드 타일 전환(그리드가 숫자 세로줄을 만든다). 증감(+N ok / −N err)은 숫자
 * 옆 12px, 이번 스캔에서 사라진 타입(count 0)은 점선 보더 + faint로 흐리게 남긴다.
 */
function ResourceTypeTile({
  type,
  count,
  provider,
  diff,
}: {
  type: string;
  count: number;
  provider: CloudProvider;
  diff?: number | null;
}): ReactElement {
  const removed = count === 0;
  return (
    <div
      title={type}
      className={cn(
        'min-w-0 rounded-[6px] border bg-[var(--pl-bg-card)] px-3 py-2 shadow-[var(--pl-shadow-sm)]',
        removed ? 'border-dashed border-[var(--pl-border)]' : 'border-[var(--pl-border)]',
      )}
    >
      <p
        className={cn(
          'truncate text-[12px] font-medium [font-family:var(--pl-font-mono)]',
          removed ? 'text-[var(--pl-text-faint)]' : 'text-[var(--pl-text-weak)]',
        )}
      >
        {trimProviderPrefix(type, provider)}
      </p>
      <p className="mt-0.5 flex items-baseline gap-1.5">
        <span
          className={cn(
            'text-[16px] font-medium tabular-nums',
            removed ? 'text-[var(--pl-text-faint)]' : 'text-[var(--pl-text-strong)]',
          )}
        >
          {fmtCount(count)}
        </span>
        {diff != null && diff !== 0 && (
          <span
            className={cn(
              'text-[12px] font-medium tabular-nums',
              diff > 0 ? 'text-[var(--pl-ok-text)]' : 'text-[var(--pl-err-text)]',
            )}
          >
            {diff > 0 ? `+${fmtCount(diff)}` : fmtCount(diff)}
          </span>
        )}
      </p>
    </div>
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
  /** 이력 행 클릭으로 여는 상세 모달의 대상 잡. */
  const [detailJob, setDetailJob] = useState<ScanJob | null>(null);

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

  // 타입별 증감 — 직전 성공이 있으면 현재∪직전 키 합집합으로 diff를 계산한다.
  // 직전에만 있던 타입은 count 0(사라짐)으로 남겨 −N을 정직하게 보여준다.
  const typeEntries: Array<{ type: string; count: number; diff: number | null }> = (() => {
    if (!prevSuccess) return latestCounts.map(([type, count]) => ({ type, count, diff: null }));
    const prevMap = Object.fromEntries(sortResourceCounts(prevSuccess.resource_count_by_resource_type));
    const currentMap = Object.fromEntries(latestCounts);
    return Array.from(new Set([...Object.keys(currentMap), ...Object.keys(prevMap)]))
      .map((type) => {
        const count = currentMap[type] ?? 0;
        return { type, count, diff: count - (prevMap[type] ?? 0) };
      })
      .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
  })();

  const detailCounts = sortResourceCounts(detailJob?.resource_count_by_resource_type);

  const recentScanCard = (
    // flex-col — 하단 시각행을 mt-auto로 카드 밑바닥에 깐다(짝 카드가 더 길 때 허공 방지).
    <section className={cn(pipelineStyles.card.base, 'flex flex-col')} aria-label="최근 스캔">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className={cn(opsStyles.cardTitle, 'flex items-center gap-2')}>
            <Icon name="search" size={18} className="text-[var(--pl-primary)]" />
            최근 스캔
            {/* 식별자(#N) 먼저, 판정 pill 나중 — 모달 타이틀과 같은 순서. */}
            {latestJob?.scan_version != null && (
              <span className="text-[12px] font-medium text-[var(--pl-text-weak)]">
                #{latestJob.scan_version}
              </span>
            )}
            {latestJob && <ScanStatusPill status={latestJob.scan_status} />}
          </h2>
          <p className={opsStyles.cardDesc}>
            클라우드 리소스를 스캔해 연동 가능한 대상 목록을 갱신합니다.
          </p>
        </div>
        {/* 새로고침 삭제 — 스캔 중엔 useScanPolling이 2초 폴링, 이 탭에서 실행한
            스캔은 refresh()가 즉시 반영한다. 다른 화면에서 시작된 스캔은 탭
            재진입으로만 보인다(폴링은 SCANNING 동안만 도는 트레이드오프).
            variant outline(파란 스트로크)·아이콘 없음 — primary 면은 과하고
            회색은 죽어 보인다는 운영 피드백의 절충. */}
        <PlButton
          variant="outline"
          className="flex-none"
          disabled={scanning || starting}
          onClick={() => void runScan()}
        >
          {scanning ? '스캔 중…' : starting ? '시작 중…' : '스캔 실행'}
        </PlButton>
      </div>

      {startFailed && (
        <p className="mt-4 rounded-lg bg-[var(--pl-err-bg)] px-3 py-2.5 text-[14px] text-[var(--pl-err-text)]">
          스캔을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      )}

      {loading && !latestJob ? (
        // 최종 레이아웃(결과 헤더 + 문장 + 타일 그리드) 자리를 그리는 스켈레톤 — 점프 방지.
        <div className="mt-5" aria-busy>
          <div className={cn(opsStyles.skeleton, 'h-5 w-24')} aria-hidden="true" />
          <div className={cn(opsStyles.skeleton, 'mt-2.5 h-5 w-72')} aria-hidden="true" />
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className={cn(opsStyles.skeleton, 'h-[60px]')} aria-hidden="true" />
            ))}
          </div>
        </div>
      ) : !latestJob ? (
        error ? (
          <p className={cn(pipelineStyles.text.meta, 'mt-4')}>스캔 정보를 불러오지 못했습니다.</p>
        ) : (
          <PlEmptyState icon="search" message="스캔 이력이 없습니다." className="mt-2" />
        )
      ) : (
        <>
          {/* 계층: 판정(타이틀 옆 pill) > 발견 리소스(주인공) > 시각행(하단).
              완료된 스캔의 답은 "뭘 찾았나"다 — 시각 메타는 카드 바닥으로 물러난다. */}
          {/* 진행 바는 SCANNING에서만 — 끝난 스캔의 진행률은 정보가 아니라 착시다. */}
          {scanning && (
            <div className="mt-4 flex items-center gap-3">
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

          {/* 스캔 결과 — 성공/진행 중에만. 실패는 결과가 아니라 원인(오류 박스)을 말한다.
              헤더(16/600) 아래 보조 한 줄(총계·직전 비교, 값만 약간 강조) → 태그가 내용. */}
          {(scanning || latestJob.scan_status === 'SUCCESS') && (
            <div className="mt-5">
              <p className="text-[16px] font-semibold text-[var(--pl-text-strong)]">스캔 결과</p>
              {scanning ? (
                <p className={cn(pipelineStyles.text.meta, 'mt-1.5')}>스캔 완료 후 집계돼요.</p>
              ) : latestCounts.length === 0 ? (
                <p className={cn(pipelineStyles.text.meta, 'mt-1.5')}>발견된 리소스가 없습니다.</p>
              ) : (
                <>
                  {/* 한 문장으로 — '총 N개 · 직전 대비 +N' 조각 나열이 어색하다는
                      운영 피드백. 총계 숫자만 브랜드 색 + 18px, 증감 숫자는 ok/err. */}
                  <p className="mt-1 text-[14px] text-[var(--pl-text-weak)]">
                    {countDiff !== null && countDiff !== 0 && (
                      <>
                        직전 스캔보다{' '}
                        <b
                          className={cn(
                            'font-bold tabular-nums',
                            countDiff > 0 ? 'text-[var(--pl-ok-text)]' : 'text-[var(--pl-err-text)]',
                          )}
                        >
                          {fmtCount(Math.abs(countDiff))}개
                        </b>
                        {countDiff > 0 ? ' 늘어난' : ' 줄어든'}{' '}
                      </>
                    )}
                    {countDiff === 0 && <>직전 스캔과 같은 </>}
                    총{' '}
                    <b className="text-[20px] font-bold tabular-nums text-[var(--pl-primary)]">
                      {fmtCount(latestTotal)}
                    </b>
                    개를 발견했어요.
                  </p>
                  <div className="mt-2.5 grid grid-cols-3 gap-2">
                    {typeEntries.map(({ type, count, diff }) => (
                      <ResourceTypeTile key={type} type={type} count={count} provider={provider} diff={diff} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {latestJob.scan_error && (
            <p className="mt-4 rounded-lg bg-[var(--pl-err-bg)] px-3 py-2.5 text-[14px] text-[var(--pl-err-text)]">
              <span className="[font-family:var(--pl-font-mono)] font-semibold">{latestJob.scan_error}</span>
              <span className="ml-2">{errorLabel(latestJob.scan_error)}</span>
            </p>
          )}

          {/* 시각행 — 라벨 위/값 아래 필드, mt-auto로 카드 밑바닥 고정(안쪽 mt-4가 최소 간격). */}
          <div className="mt-auto">
            <div className="mt-4 flex flex-wrap gap-x-10 gap-y-3 border-t border-[var(--pl-gray-100)] pt-3.5">
              <TimeField label="실행시간">{fmtDateTimeSec(latestJob.created_at)}</TimeField>
              {!scanning && (
                <>
                  {/* 실행시간과 같은 포맷 — 같은 날이어도 날짜를 생략하지 않는다. */}
                  <TimeField label="완료시간">{fmtDateTimeSec(latestJob.updated_at)}</TimeField>
                  <TimeField label="소요 시간">{fmtDuration(latestJob.duration_seconds)}</TimeField>
                </>
              )}
            </div>
          </div>
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
          <Icon name="clock" size={18} className="text-[var(--pl-primary)]" />
          스캔 이력
        </h2>
        {/* 보관 정책 선언 — 페이지 용어(스캔 결과·버전) 그대로. 한도 절만
            weight+색 한 단계 승급(크기 아님)으로 강조. */}
        <p className={opsStyles.cardDesc}>
          내부 정책에 따라 스캔 결과는{' '}
          <b className="font-semibold text-[var(--pl-text-medium)]">최근 10개 버전까지만 보관합니다.</b>
        </p>

        {historyLoading ? (
          // 행 높이(≈40px) × 페이지 크기 스켈레톤 — 빈 공백 대신 테이블 자리를 그린다.
          <div className="mt-3" aria-busy>
            {Array.from({ length: PAGE_SIZE }, (_, index) => (
              <div key={index} className={cn(opsStyles.skeleton, 'mt-2 h-10 first:mt-0')} aria-hidden="true" />
            ))}
          </div>
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
                  <th className={table.headCell}>완료 일시</th>
                  <th className={table.headCell}>상태</th>
                  <th className={table.headCell}>버전</th>
                  <th className={table.headCell}>발견 리소스</th>
                  <th className={table.headCell}>소요 시간</th>
                  <th className={table.headCell}>오류</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const rowCounts = sortResourceCounts(row.resource_count_by_resource_type);
                  return (
                    // 행 전체가 클릭 대상(Enter/Space 동일) — 상세는 모달로. 클릭이
                    // 유일한 진입로라 키보드 포커스·활성화를 행에 직접 단다.
                    <tr
                      key={row.id ?? `${row.created_at ?? ''}-${index}`}
                      tabIndex={0}
                      aria-haspopup="dialog"
                      className={cn(
                        table.rowHover,
                        'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--pl-primary)]',
                      )}
                      onClick={() => setDetailJob(row)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setDetailJob(row);
                        }
                      }}
                    >
                      <td className={cn(table.cell, 'whitespace-nowrap')}>{fmtDateTime(row.created_at)}</td>
                      <td className={cn(table.cell, 'whitespace-nowrap')}>{fmtDateTime(row.updated_at)}</td>
                      <td className={table.cell}>
                        <ScanStatusPill status={row.scan_status} />
                      </td>
                      <td className={cn(table.cell, '[font-family:var(--pl-font-mono)]')}>
                        #{row.scan_version ?? '-'}
                      </td>
                      <td className={cn(table.cell, 'tabular-nums')}>
                        {rowCounts.length > 0 ? (
                          `${fmtCount(totalOf(rowCounts))}개`
                        ) : (
                          <span className="text-[var(--pl-text-faint)]">—</span>
                        )}
                      </td>
                      <td className={cn(table.cell, 'whitespace-nowrap')}>{fmtDuration(row.duration_seconds)}</td>
                      <td className={table.cell}>
                        {/* 오류 없음 = 빈 셀 — '—'조차 시선을 끈다(운영 피드백). */}
                        {row.scan_error && (
                          <span
                            className={cn(
                              opsStyles.statusTag,
                              'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
                            )}
                            title={errorLabel(row.scan_error)}
                          >
                            {row.scan_error}
                          </span>
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

      {/* 이력 행 클릭 → 상세 모달 — 최근 스캔 카드의 계층을 그대로 미러링:
          판정(타이틀 옆 pill) → 스캔 결과(총계 + 태그) → 오류 → 시각행(하단). */}
      <ModalShell
        open={detailJob !== null}
        onClose={() => setDetailJob(null)}
        labelledBy="scan-detail-title"
      >
        {detailJob && (
          <>
            {/* '스캔 #N' 타이틀 + '스캔 결과' 헤더 2단이 계층을 흐린다는 피드백 —
                타이틀 한 줄('스캔 결과 #N + 판정')로 병합. */}
            <h3
              id="scan-detail-title"
              className="flex items-center gap-2 text-[16px] font-bold text-[var(--pl-text-strong)]"
            >
              스캔 결과 <span className="[font-family:var(--pl-font-mono)]">#{detailJob.scan_version ?? '-'}</span>
              <ScanStatusPill status={detailJob.scan_status} />
            </h3>

            {detailJob.scan_status === 'SUCCESS' && (
              <div className="mt-4">
                {detailCounts.length === 0 ? (
                  <p className={pipelineStyles.text.meta}>발견된 리소스가 없습니다.</p>
                ) : (
                  <>
                    <p className="text-[14px] text-[var(--pl-text-weak)]">
                      총{' '}
                      <b className="text-[20px] font-bold tabular-nums text-[var(--pl-primary)]">
                        {fmtCount(totalOf(detailCounts))}
                      </b>
                      개를 발견했어요.
                    </p>
                    {/* 타입별 개수 — 선은 헤더 아래 한 줄이 전부. 행은 구분선 없이
                        여백+정렬(mono 좌 / 숫자 우 tabular)이 만들고, 추적은 hover가
                        돕는다. 값 400/헤더 500 — 데이터 잉크가 아닌 장식은 뺀다.
                        (sticky 헤더: border-collapse는 보더가 떨어져 나가 border-separate) */}
                    <div className="mt-3 max-h-[320px] overflow-y-auto">
                      <table className="w-full border-separate border-spacing-0">
                        <thead>
                          <tr>
                            <th className="sticky top-0 border-b border-[var(--pl-border)] bg-[var(--pl-bg-card)] py-2 pr-3 text-left text-[12px] font-medium text-[var(--pl-text-weak)]">
                              리소스 타입
                            </th>
                            <th className="sticky top-0 border-b border-[var(--pl-border)] bg-[var(--pl-bg-card)] py-2 pl-3 text-right text-[12px] font-medium text-[var(--pl-text-weak)]">
                              개수
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailCounts.map(([type, count]) => (
                            <tr key={type} title={type} className="hover:bg-[var(--pl-gray-50)]">
                              <td className="rounded-l-md py-2 pl-1 pr-3 text-[12px] font-medium text-[var(--pl-text-medium)] [font-family:var(--pl-font-mono)]">
                                {trimProviderPrefix(type, provider)}
                              </td>
                              <td className="rounded-r-md py-2 pl-3 pr-1 text-right text-[14px] tabular-nums text-[var(--pl-text-strong)]">
                                {fmtCount(count)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {detailJob.scan_error && (
              <p className="mt-4 rounded-lg bg-[var(--pl-err-bg)] px-3 py-2.5 text-[14px] text-[var(--pl-err-text)]">
                <span className="[font-family:var(--pl-font-mono)] font-semibold">{detailJob.scan_error}</span>
                <span className="ml-2">{errorLabel(detailJob.scan_error)}</span>
              </p>
            )}

            {/* 닫기 버튼 없음 — Esc·바깥 클릭으로 충분(운영 피드백), 시각행이 바닥. */}
            <div className="mt-5 flex flex-wrap gap-x-10 gap-y-3 border-t border-[var(--pl-gray-100)] pt-3.5">
              <TimeField label="실행시간">{fmtDateTimeSec(detailJob.created_at)}</TimeField>
              <TimeField label="완료시간">{fmtDateTimeSec(detailJob.updated_at)}</TimeField>
              <TimeField label="소요 시간">{fmtDuration(detailJob.duration_seconds)}</TimeField>
            </div>
          </>
        )}
      </ModalShell>
    </>
  );
}
