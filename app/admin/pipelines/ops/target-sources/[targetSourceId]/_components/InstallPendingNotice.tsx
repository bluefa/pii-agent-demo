'use client';

import { type ReactElement } from 'react';
import Link from 'next/link';
import { LocaleProvider } from '@/app/components/LocaleProvider';
import { bgColors, borderColors, cn, statusColors, tagStyles, textColors, textStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { useModal } from '@/app/hooks/useModal';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { StatusSuccessIcon } from '@/app/components/ui/icons';
import { LastCheckStamp } from '@/app/components/features/process-status/install-status-detail/LastCheckStamp';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { InstallResourceListModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/InstallResourceListModal';
import type { InstallTask } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installTasks';
import type { InstallPendingResult } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installGate';
import type { InstallLastCheck } from '@/app/components/features/process-status/install-status-detail/model';

export const INSTALL_CHECK_TOOLTIP = '설치 상태는 실시간으로 조회하지 않습니다. 화면에 진입할 때 마지막 확인 결과를 조회하며, 연결 테스트 종료 후에도 갱신합니다. 표시된 시간은 서버에서 설치 상태를 마지막으로 확인한 시각으로, 현재 상태와 다를 수 있습니다.';

export interface InstallPendingNoticeData {
  result: InstallPendingResult;
  lastCheck: InstallLastCheck | null;
  tasks: InstallTask[];
  targetSourceId: number;
  provider: string;
  manualInstall: boolean;
}

export interface InstallPendingNoticeProps {
  data: InstallPendingNoticeData | null;
  className?: string;
  loading?: boolean;
}

const TASK_COLORS: Record<InstallTask['state'], string> = {
  needed: tagStyles.info, waiting: tagStyles.neutral, done: tagStyles.success, check: tagStyles.neutral,
};

/** Readiness guidance stays visible after completion; TC execution remains operator-controlled. */
export function InstallPendingNotice({ data, className, loading = false }: InstallPendingNoticeProps): ReactElement | null {
  const detailModal = useModal<string>();
  if (loading) return (
    <section aria-label="설치 정보 조회 중" aria-busy="true" className={cn('rounded-xl border overflow-hidden', borderColors.light, bgColors.surface, textColors.primary, className)}>
      <div aria-hidden="true" className={cn('flex items-center justify-between gap-3 border-b px-4 py-3', borderColors.light, bgColors.muted)}>
        <span className={cn(opsStyles.skeletonBar, 'h-5 w-44')} />
        <span className={cn(opsStyles.skeletonBar, 'h-4 w-52')} />
      </div>
      <div aria-hidden="true">
        {[0, 1].map(row => (
          <div key={row} className={cn('grid grid-cols-[112px_minmax(0,1fr)_auto] gap-4 border-b px-4 py-4', borderColors.light)}>
            <span className={cn(opsStyles.skeletonBar, 'h-4 w-20')} />
            <div className="space-y-2">
              <div className={cn(opsStyles.skeletonBar, 'h-5 w-40')} />
              <div className={cn(opsStyles.skeletonBar, 'h-4 w-3/4')} />
            </div>
            <span className={cn(opsStyles.skeletonBar, 'h-5 w-24')} />
          </div>
        ))}
        <div className="px-4 py-3"><div className={cn(opsStyles.skeletonBar, 'h-4 w-1/2')} /></div>
      </div>
    </section>
  );
  if (data === null || data.result.kind === 'unknown') return null;
  const { result, lastCheck, tasks, targetSourceId, provider, manualInstall } = data;
  const complete = result.kind === 'done';
  const selected = tasks.find(task => task.id === detailModal.data);
  const mode = provider === 'aws' ? 'AWS · ' + (manualInstall ? '수동' : '자동') + ' 설치' : provider.toUpperCase();

  return (
    <>
      <section aria-label="설치 현황" className={cn('rounded-xl border text-left overflow-hidden', borderColors.light, bgColors.surface, textColors.primary, className)}>
        <div className={cn('flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b', borderColors.light, bgColors.muted)}>
          <div className="flex items-center gap-2">
            <span className={textStyles.bodyStrong}>{complete ? '설치 현황' : '연결 테스트 전 준비 사항'}</span>
            <span className={cn('rounded px-2 py-0.5', textStyles.caption, tagStyles.neutral)}>{mode}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(textStyles.caption, textColors.tertiary)}>마지막 확인</span>
            {lastCheck?.checkedAt ? (
              <LocaleProvider initial="ko">
                <LastCheckStamp lastCheck={lastCheck} tooltip={INSTALL_CHECK_TOOLTIP} />
              </LocaleProvider>
            ) : <span className={cn(textStyles.caption, textColors.tertiary)}>확인 기록 없음</span>}
          </div>
        </div>
        {complete ? (
          <div className={cn('flex items-center gap-2 px-4 py-4', textStyles.bodyStrong)}>
            <StatusSuccessIcon className={cn('h-5 w-5', statusColors.success.textDark)} />
            설치가 완료되었습니다.
          </div>
        ) : (
          <>
            {tasks.map(task => (
              <div key={task.id} className={cn('grid grid-cols-[112px_minmax(0,1fr)_auto] items-start gap-4 border-b px-4 py-4', borderColors.light)}>
                <span className={cn(textStyles.captionStrong, textColors.secondary)}>
                  {task.owner === 'service' ? '서비스 담당자' : 'BDC 담당자'}
                </span>
                <div>
                  <div className={textStyles.bodyStrong}>{task.title}</div>
                  <p className={cn('mt-1 break-keep', textStyles.caption, textColors.secondary)}>{task.description}</p>
                  {task.state !== 'done' && (
                    <div className="mt-2 flex flex-wrap items-center gap-4">
                      {task.rows.length > 0 && (
                        <button type="button" onClick={() => detailModal.open(task.id)} className={opsStyles.detailLink}>
                          대상 리소스 및 작업 보기 · {new Set(task.rows.map(row => row.resourceId)).size}건
                          <Icon name="arrow-up-right" size="sm" />
                        </button>
                      )}
                      {task.owner === 'bdc' && task.state !== 'waiting' && (
                        <Link href={passRoutes.pipelines.ops.targetSource(targetSourceId, 'infra')} className={opsStyles.detailLink}>
                          인프라 작업 보기 <Icon name="arrow-up-right" size="sm" />
                        </Link>
                      )}
                    </div>
                  )}
                </div>
                <span className={cn('rounded px-2 py-0.5 whitespace-nowrap', textStyles.caption, TASK_COLORS[task.state])}>{task.label}</span>
              </div>
            ))}
            <p className={cn('px-4 py-3', textStyles.caption, textColors.secondary)}>
              준비가 완료된 후 연결 테스트를 실행해 주세요. 미완료 대상은 연결에 실패할 수 있습니다.
            </p>
          </>
        )}
      </section>
      {detailModal.isOpen && selected && !complete && (
        <InstallResourceListModal title={selected.title} rows={selected.rows} stepColumn lastCheck={lastCheck} onClose={detailModal.close} />
      )}
    </>
  );
}
