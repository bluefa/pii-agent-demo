'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/app/components/ui/Button';
import { Modal } from '@/app/components/ui/Modal';
import { Pagination } from '@/app/components/ui/Pagination';
import { SCAN_ERROR_LABELS, SCAN_STATUS_LABELS } from '@/app/components/features/scan/scan-labels';
import { getScanHistory } from '@/app/lib/api/scan';
import { borderColors, cn, idcStyles, textColors } from '@/lib/theme';
import { formatDate } from '@/lib/utils/date';
import type { AsyncState } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state';
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

const resultText = (job: ScanJob): string => {
  if (job.scan_status === 'SUCCESS') {
    const found = Object.values(job.resource_count_by_resource_type ?? {}).reduce<number>(
      (sum, count) => sum + (count ?? 0),
      0,
    );
    return `${found}개 발견`;
  }
  if (job.scan_error) return SCAN_ERROR_LABELS[job.scan_error] ?? job.scan_error;
  return '';
};

/** 스캔 이력 모달 — GET /scan/history 그대로: 시각 · 상태 · 소요 · 결과. */
export const ScanHistoryModal = ({ targetSourceId, onClose }: ScanHistoryModalProps) => {
  const [state, setState] = useState<AsyncState<HistoryPage>>({ status: 'loading' });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [retryNonce, setRetryNonce] = useState(0);

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
      title="스캔 이력"
      subtitle="최근 실행된 인프라 스캔 기록이에요."
      footer={<Button variant="secondary" onClick={onClose}>닫기</Button>}
    >
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
              </tr>
            </thead>
            <tbody className={idcStyles.table.body}>
              {state.data.jobs.map((job, index) => (
                <tr key={job.id ?? index}>
                  <td className={cn(BODY_CELL, 'whitespace-nowrap text-[13px]', textColors.secondary)}>
                    {job.created_at ? formatDate(job.created_at, 'datetime') : ''}
                  </td>
                  <td className={BODY_CELL}>
                    <span className={cn(idcStyles.tag.base, statusTagClass(job.scan_status))}>
                      {job.scan_status ? (SCAN_STATUS_LABELS[job.scan_status] ?? job.scan_status) : ''}
                    </span>
                  </td>
                  <td className={cn(BODY_CELL, 'whitespace-nowrap font-mono text-[12px]', textColors.secondary)}>
                    {typeof job.duration_seconds === 'number' ? `${Math.round(job.duration_seconds)}초` : ''}
                  </td>
                  <td className={cn(BODY_CELL, 'text-[13px]', textColors.secondary)}>
                    {resultText(job)}
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
    </Modal>
  );
};
