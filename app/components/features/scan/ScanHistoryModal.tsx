'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/app/components/ui/Button';
import { Modal } from '@/app/components/ui/Modal';
import { Pagination } from '@/app/components/ui/Pagination';
import { ArrowUpRightIcon } from '@/app/components/ui/icons';
import { SCAN_ERROR_LABELS, SCAN_STATUS_LABELS } from '@/app/components/features/scan/scan-labels';
import { getScanHistory } from '@/app/lib/api/scan';
import { borderColors, cn, idcStyles, primaryColors, statusColors, textColors } from '@/lib/theme';
import { formatDate } from '@/lib/utils/date';
import type { AsyncState } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state';
import type { CloudProvider } from '@/lib/types';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';

type ScanJob = z.infer<typeof schemas.ScanJobResponse>;

/** 서버 페이지네이션(PageScanJobResponse) 그대로 — 오래된 스캔도 끝까지 볼 수 있다. */
const DEFAULT_PAGE_SIZE = 10;

/** 이력 페이지 — 목록과 전체 건수(페이저가 쓰는 값)는 같은 응답에서 온다. */
interface HistoryPage {
  jobs: ScanJob[];
  total: number;
}

// 카드 없는 목록 — 모달 본문이 이미 여백을 가지므로 바깥 열의 좌우 인셋만 걷어내고
// (first/last), 열 사이 간격은 승인 테이블과 같은 18px 를 그대로 쓴다.
const HEAD_CELL = cn(
  idcStyles.table.approvalHeaderCell,
  'first:pl-0 last:pr-0 text-left text-[12px] font-semibold',
  textColors.secondary,
);
const BODY_CELL = cn(idcStyles.table.approvalCell, 'first:pl-0 last:pr-0');

interface ScanHistoryModalProps {
  targetSourceId: number;
  /** 타입별 개수의 접두어 트림에만 쓰인다 — 한 대상 안에서 프로바이더는 상수다. */
  provider: CloudProvider;
  onClose: () => void;
}

const statusTagClass = (scanStatus: ScanJob['scan_status']): string => {
  switch (scanStatus) {
    case 'SUCCESS':
      return idcStyles.tag.green;
    case 'FAIL':
    case 'TIMEOUT':
      return idcStyles.tag.red;
    default: // SCANNING · CANCELED
      return idcStyles.tag.gray;
  }
};

const statusLabel = (job: ScanJob): string =>
  job.scan_status ? (SCAN_STATUS_LABELS[job.scan_status] ?? job.scan_status) : '';

/** 타입별 개수 → [타입, 개수] 배열. 개수 내림차순, 동수는 이름순. */
const sortedCounts = (job: ScanJob): Array<[string, number]> =>
  Object.entries(job.resource_count_by_resource_type ?? {})
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

const totalOf = (counts: Array<[string, number]>): number =>
  counts.reduce((sum, [, count]) => sum + count, 0);

/**
 * 한 대상 안에서 프로바이더는 상수라 `AZURE_` 접두어는 정보가 없다 — 표시에서만
 * 떼고 전체 키는 `title` 로 남긴다(관리자 스캔 탭과 같은 규칙).
 */
const trimProviderPrefix = (type: string, provider: CloudProvider): string => {
  const prefix = `${provider.toUpperCase()}_`;
  return type.startsWith(prefix) ? type.slice(prefix.length) : type;
};

const durationText = (job: ScanJob): string =>
  typeof job.duration_seconds === 'number' ? `${Math.round(job.duration_seconds)}초` : '';

const resultText = (job: ScanJob): string => {
  if (job.scan_status === 'SUCCESS') return `${totalOf(sortedCounts(job))}개 발견`;
  if (job.scan_error) return SCAN_ERROR_LABELS[job.scan_error] ?? job.scan_error;
  return '';
};

/** 상세의 시각 필드 — 라벨은 메타 티어, 값이 내용 티어. */
const TimeField = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <p className={cn('text-[12px] font-medium', textColors.tertiary)}>{label}</p>
    <p className={cn('mt-0.5 whitespace-nowrap text-[14px] font-medium tabular-nums', textColors.secondary)}>
      {value || '—'}
    </p>
  </div>
);

/**
 * 한 스캔의 상세 — 관리자 스캔 탭의 상세 모달과 같은 계층(판정 → 결과 → 오류 →
 * 시각)을 이 화면의 토큰으로 옮겼다. 이력 응답이 타입별 개수를 이미 싣고 있어
 * 추가 조회가 없다.
 */
const ScanDetail = ({ job, provider }: { job: ScanJob; provider: CloudProvider }) => {
  const counts = sortedCounts(job);
  return (
    <div>
      <span className={cn(idcStyles.tag.base, statusTagClass(job.scan_status))}>{statusLabel(job)}</span>

      {job.scan_status === 'SUCCESS' && (
        <div className="mt-4">
          {counts.length === 0 ? (
            <p className={cn('text-sm', textColors.tertiary)}>발견된 리소스가 없어요.</p>
          ) : (
            <>
              <p className={cn('text-[14px]', textColors.tertiary)}>
                총{' '}
                <b className={cn('text-[20px] font-bold tabular-nums', primaryColors.text)}>
                  {totalOf(counts).toLocaleString()}
                </b>
                개를 발견했어요.
              </p>
              {/* 스크롤은 모달 본문 하나만 — 목록에 따로 스크롤 박스를 두면 한 화면에
                  스크롤바가 둘이 된다. 헤더도 sticky 로 띄우지 않는다: 스크롤포트가
                  모달 본문이라 헤더가 목록 중간에 떠서 행을 가렸다(실측). */}
              <div className="mt-3">
                <table className="w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="whitespace-nowrap">
                      <th className={cn(HEAD_CELL, 'border-b', borderColors.default)}>리소스 타입</th>
                      <th className={cn(HEAD_CELL, 'border-b text-right', borderColors.default)}>개수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {counts.map(([type, count]) => (
                      <tr key={type} title={type}>
                        <td
                          className={cn(
                            BODY_CELL,
                            'border-b py-2.5 font-mono text-[12px]',
                            borderColors.light,
                            textColors.secondary,
                          )}
                        >
                          {trimProviderPrefix(type, provider)}
                        </td>
                        <td
                          className={cn(
                            BODY_CELL,
                            'border-b py-2.5 text-right text-[14px] tabular-nums',
                            borderColors.light,
                            textColors.primary,
                          )}
                        >
                          {count.toLocaleString()}
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

      {job.scan_error && (
        <p
          className={cn(
            'mt-4 rounded-lg px-3 py-2.5 text-[14px]',
            statusColors.error.bg,
            statusColors.error.textDark,
          )}
        >
          <span className="font-mono font-semibold">{job.scan_error}</span>
          <span className="ml-2">{SCAN_ERROR_LABELS[job.scan_error] ?? SCAN_ERROR_LABELS.UNKNOWN}</span>
        </p>
      )}

      <div className={cn('mt-5 flex flex-wrap gap-x-10 gap-y-3 border-t pt-3.5', borderColors.light)}>
        <TimeField label="실행 시각" value={job.created_at ? formatDate(job.created_at, 'datetime') : ''} />
        <TimeField label="완료 시각" value={job.updated_at ? formatDate(job.updated_at, 'datetime') : ''} />
        <TimeField label="소요 시간" value={durationText(job)} />
      </div>
    </div>
  );
};

/**
 * 스캔 이력 모달 — 목록(시각 · 상태 · 소요 · 결과)에서 행을 누르면 같은 모달 안에서
 * 그 스캔의 상세로 바뀐다. 모달 위에 모달을 겹치지 않아 ESC·배경 클릭의 주인이
 * 하나로 남는다.
 */
export const ScanHistoryModal = ({ targetSourceId, provider, onClose }: ScanHistoryModalProps) => {
  const [state, setState] = useState<AsyncState<HistoryPage>>({ status: 'loading' });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [retryNonce, setRetryNonce] = useState(0);
  const [detail, setDetail] = useState<ScanJob | null>(null);

  // setState only inside the promise callbacks (WaitingApprovalCard's fetch
  // pattern) — the effect body itself stays setState-free.
  useEffect(() => {
    let cancelled = false;
    void getScanHistory(targetSourceId, page, pageSize)
      .then((result) => {
        const jobs = result.content ?? [];
        if (!cancelled) {
          setState({ status: 'ready', data: { jobs, total: result.totalElements ?? jobs.length } });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', message: '스캔 이력을 불러오지 못했어요.' });
      });
    return () => {
      cancelled = true;
    };
  }, [targetSourceId, page, pageSize, retryNonce]);

  const retry = () => {
    setState({ status: 'loading' });
    setRetryNonce((n) => n + 1);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      chrome="toss"
      size="xl"
      title={detail ? `스캔 결과 #${detail.scan_version ?? '-'}` : '스캔 이력'}
      subtitle={detail ? undefined : '최근 실행된 인프라 스캔 기록이에요.'}
      footer={
        detail ? (
          <Button variant="secondary" onClick={() => setDetail(null)}>목록으로</Button>
        ) : (
          <Button variant="secondary" onClick={onClose}>닫기</Button>
        )
      }
    >
      {detail ? (
        <ScanDetail job={detail} provider={provider} />
      ) : (
        <>
          {state.status === 'loading' && (
            <div className="space-y-2.5" aria-busy="true" aria-live="polite">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={cn(idcStyles.skeletonBar, 'h-9 w-full rounded-lg')} />
              ))}
            </div>
          )}

          {state.status === 'error' && (
            <div className="py-6 text-center">
              <p className={cn('text-sm', textColors.tertiary)}>{state.message}</p>
              <Button variant="secondary" onClick={retry} className="mt-4 text-sm">
                다시 시도
              </Button>
            </div>
          )}

          {state.status === 'ready' && state.data.total === 0 && (
            <p className={cn('py-8 text-center text-sm', textColors.tertiary)}>
              아직 실행된 스캔이 없어요.
            </p>
          )}

          {/* 프레임(테두리·그림자) 없는 목록 — 모달 안에 카드를 한 겹 더 세우지 않고
              헤더 한 줄 아래로 행이 쭉 이어진다. */}
          {state.status === 'ready' && state.data.total > 0 && (
            <>
              {/* 마지막 행 아래 1px — 페이저 바(border-t-0)가 닫힌 상자로 읽히게 하는 윗변. */}
              <table className={cn('w-full border-b', borderColors.default)}>
                <thead>
                  <tr className={cn('whitespace-nowrap border-b', borderColors.default)}>
                    <th className={HEAD_CELL}>실행 시각</th>
                    <th className={HEAD_CELL}>상태</th>
                    <th className={HEAD_CELL}>소요</th>
                    <th className={HEAD_CELL}>결과</th>
                    {/* 화살표 열 — 머리글은 비운다(장식이 아니라 행 전체가 버튼이라는 표시) */}
                    <th className={cn(HEAD_CELL, 'w-6')} aria-hidden="true" />
                  </tr>
                </thead>
                <tbody className={idcStyles.table.body}>
                  {state.data.jobs.map((job, index) => (
                    // 행 전체가 클릭 대상(Enter·Space 포함) — 관리자 스캔 이력과 같은
                    // 문법이라 두 화면에서 같은 손동작이 통한다.
                    <tr
                      key={job.id ?? index}
                      tabIndex={0}
                      onClick={() => setDetail(job)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setDetail(job);
                        }
                      }}
                      // 마우스 hover 와 키보드 focus 가 같은 틴트를 켠다 — 포인터
                      // 사용자에게만 상태를 주지 않기 위한 토큰(bgLightActive).
                      className={cn('group cursor-pointer outline-none', primaryColors.bgLightActive)}
                    >
                      <td className={cn(BODY_CELL, 'whitespace-nowrap text-[13px]', textColors.secondary)}>
                        {job.created_at ? formatDate(job.created_at, 'datetime') : ''}
                      </td>
                      <td className={BODY_CELL}>
                        <span className={cn(idcStyles.tag.base, statusTagClass(job.scan_status))}>
                          {statusLabel(job)}
                        </span>
                      </td>
                      <td className={cn(BODY_CELL, 'whitespace-nowrap font-mono text-[12px]', textColors.secondary)}>
                        {durationText(job)}
                      </td>
                      <td className={cn(BODY_CELL, 'text-[13px]', textColors.secondary)}>
                        {resultText(job)}
                      </td>
                      <td className={cn(BODY_CELL, 'w-6 text-right')}>
                        {/* 올려두면 나타나는 ↗ — 이 행이 다른 화면으로 넘어간다는 표시.
                            키보드 포커스에서도 같이 나타난다(마우스에만 있는 단서 금지). */}
                        <ArrowUpRightIcon
                          className={cn(
                            'h-[13px] w-[13px] opacity-0 transition-opacity',
                            'group-hover:opacity-100 group-focus-visible:opacity-100',
                            primaryColors.text,
                          )}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={page}
                pageSize={pageSize}
                totalCount={state.data.total}
                onPageChange={setPage}
                onPageSizeChange={(next) => {
                  setPageSize(next);
                  setPage(0);
                }}
                pageSizeOptions={[10, 20, 50]}
              />
            </>
          )}
        </>
      )}
    </Modal>
  );
};
