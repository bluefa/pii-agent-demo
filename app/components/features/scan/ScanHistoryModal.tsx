'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/app/components/ui/Button';
import { Modal } from '@/app/components/ui/Modal';
import { SCAN_ERROR_LABELS, SCAN_STATUS_LABELS } from '@/app/components/features/scan/scan-labels';
import { getScanHistory } from '@/app/lib/api/scan';
import { cn, idcStyles, textColors } from '@/lib/theme';
import { formatDate } from '@/lib/utils/date';
import type { AsyncState } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';

type ScanJob = z.infer<typeof schemas.ScanJobResponse>;

// 계약은 페이지네이션(PageScanJobResponse)을 제공하지만 v1은 최근 1페이지만
// 보여준다 — 이력은 "요즘 왜 실패하지"를 답하는 창이지 아카이브 뷰가 아니다.
const HISTORY_PAGE_SIZE = 10;

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
  const [state, setState] = useState<AsyncState<ScanJob[]>>({ status: 'loading' });
  const [retryNonce, setRetryNonce] = useState(0);

  // setState only inside the promise callbacks (WaitingApprovalCard's fetch
  // pattern) — the effect body itself stays setState-free.
  useEffect(() => {
    let cancelled = false;
    void getScanHistory(targetSourceId, 0, HISTORY_PAGE_SIZE)
      .then((page) => {
        if (!cancelled) setState({ status: 'ready', data: page.content ?? [] });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', message: '스캔 이력을 불러오지 못했어요.' });
      });
    return () => {
      cancelled = true;
    };
  }, [targetSourceId, retryNonce]);

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

      {state.status === 'ready' && state.data.length === 0 && (
        <p className={cn('py-8 text-center text-sm', textColors.tertiary)}>
          아직 실행된 스캔이 없어요.
        </p>
      )}

      {state.status === 'ready' && state.data.length > 0 && (
        <div className={idcStyles.table.frame}>
          <table className="w-full">
            <thead className={idcStyles.table.approvalHeader}>
              <tr className="whitespace-nowrap">
                <th className={idcStyles.table.approvalHeaderCell}>실행 시각</th>
                <th className={idcStyles.table.approvalHeaderCell}>상태</th>
                <th className={idcStyles.table.approvalHeaderCell}>소요</th>
                <th className={idcStyles.table.approvalHeaderCell}>결과</th>
              </tr>
            </thead>
            <tbody className={idcStyles.table.body}>
              {state.data.map((job, index) => (
                <tr key={job.id ?? index}>
                  <td className={cn(idcStyles.table.approvalCell, 'whitespace-nowrap text-[13px]', textColors.secondary)}>
                    {job.created_at ? formatDate(job.created_at, 'datetime') : ''}
                  </td>
                  <td className={idcStyles.table.approvalCell}>
                    <span className={cn(idcStyles.tag.base, statusTagClass(job.scan_status))}>
                      {job.scan_status ? (SCAN_STATUS_LABELS[job.scan_status] ?? job.scan_status) : ''}
                    </span>
                  </td>
                  <td className={cn(idcStyles.table.approvalCell, 'whitespace-nowrap font-mono text-[12px]', textColors.secondary)}>
                    {typeof job.duration_seconds === 'number' ? `${Math.round(job.duration_seconds)}초` : ''}
                  </td>
                  <td className={cn(idcStyles.table.approvalCell, 'text-[13px]', textColors.secondary)}>
                    {resultText(job)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
};
