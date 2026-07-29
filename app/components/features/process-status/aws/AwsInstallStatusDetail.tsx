'use client';

import { useMemo, useState } from 'react';
import {
  bgColors,
  borderColors,
  cn,
  idcStyles,
  statusColors,
  tagStyles,
  textColors,
} from '@/lib/theme';
import {
  TABLE_BODY_CELL,
  TABLE_HEADER_CELL,
  TABLE_MONO_CELL,
  TABLE_TAG_PILL,
} from '@/app/components/features/process-status/install-task-pipeline/table-styles';
import { CopyButton } from '@/app/components/ui/CopyButton';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { Pagination } from '@/app/components/ui/Pagination';
import { usePagination } from '@/app/hooks/usePagination';
import { formatDateTime } from '@/lib/utils/date';
import type { ConfirmedResource } from '@/lib/types/resources';
import type {
  AwsInstallationStatus,
  AwsInstallResourceStatus,
  AwsInstallStepState,
  AwsInstallStepValue,
  DatabaseType,
} from '@/lib/types';

/**
 * Step-4 AWS install status — master-detail layout. Left rail lists the install
 * steps (summary / role verify / the three terraform steps) with per-step
 * aggregates; the right panel shows the selected step's per-resource table
 * (name, id, region joined from the confirmed integration) with pagination.
 */

export const AWS_INSTALL_STATUS_LABEL: Record<AwsInstallStepValue, string> = {
  COMPLETED: '완료',
  IN_PROGRESS: '진행중',
  FAIL: '실패',
  SKIP: '해당 없음',
  BDC_INSTALL_REQUIRED: 'BDC 설치 대기',
  UNKNOWN: '확인 중',
};

const STATUS_TAG: Record<AwsInstallStepValue, string> = {
  COMPLETED: tagStyles.success,
  IN_PROGRESS: tagStyles.info,
  FAIL: tagStyles.error,
  SKIP: tagStyles.neutral,
  BDC_INSTALL_REQUIRED: tagStyles.amber,
  UNKNOWN: tagStyles.neutral,
};

const StatusPill = ({ status }: { status: AwsInstallStepValue }) => (
  <span className={cn(TABLE_TAG_PILL, 'whitespace-nowrap', STATUS_TAG[status])}>
    {AWS_INSTALL_STATUS_LABEL[status]}
  </span>
);

type StepId = 'summary' | 'perm' | 'service' | 'bdcService' | 'bdcCommon';

interface StepDef {
  id: StepId;
  title: string;
  /** 주체 태그 (서비스측/BDC측). summary는 없음. */
  side: string | null;
  desc: string;
  pick?: (resource: AwsInstallResourceStatus) => AwsInstallStepState;
}

const buildSteps = (manualInstall: boolean): StepDef[] => [
  {
    id: 'summary',
    title: '설치 현황 요약',
    side: null,
    desc: '리소스별 전체 설치 상태입니다. 단계별 진행 상황은 좌측 단계를 선택해 확인하세요.',
    pick: (r) => ({ status: r.installationStatus, guide: null }),
  },
  ...(manualInstall
    ? []
    : [
        {
          id: 'perm' as const,
          title: 'Terraform 권한 부여 확인',
          side: '서비스측',
          desc: '대상 AWS 계정에 Terraform 실행을 위한 IAM Role / AssumeRole 권한이 부여되었는지 검증합니다.',
        },
      ]),
  {
    id: 'service',
    title: manualInstall ? '서비스 측 Terraform 직접 적용' : '서비스 측 Terraform 적용',
    side: manualInstall ? '서비스측 · 직접 수행' : '서비스측 인프라 · 자동',
    desc: manualInstall
      ? '다운로드한 Terraform 스크립트를 서비스 AWS 계정에 직접 적용합니다.'
      : '리소스별 Private Endpoint / IAM Role / Glue Policy 설정을 Terraform으로 자동 배포합니다.',
    pick: (r) => r.serviceTerraform,
  },
  {
    id: 'bdcService',
    title: 'BDC 서비스 Terraform 적용',
    side: 'BDC측 · 자동',
    desc: '리소스별 BDC 계정 측 Private Endpoint Service / IAM Role 설정을 자동 배포합니다.',
    pick: (r) => r.bdcServiceTerraform,
  },
  {
    id: 'bdcCommon',
    title: 'BDC 공통 Terraform 적용',
    side: 'BDC측 · 자동',
    desc: '대상 소스 공통 BDC 인프라 설정을 자동 배포합니다.',
    pick: (r) => r.bdcCommonTerraform,
  },
];

/** Worst-wins aggregate for a step across resources: 실패 > 진행중 > 대기 > 완료. */
interface StepAggregate {
  label: string;
  tag: string;
  /** 'settled/total' — null for the role-verify step (no resource list). */
  count: string | null;
  kind: 'failed' | 'running' | 'waiting' | 'done';
}

const aggregateStep = (
  step: StepDef,
  status: AwsInstallationStatus,
): StepAggregate => {
  if (!step.pick) {
    const s = status.roleVerify.status;
    const kind =
      s === 'FAIL' ? 'failed'
        : s === 'IN_PROGRESS' ? 'running'
          : s === 'COMPLETED' || s === 'SKIP' ? 'done'
            : 'waiting';
    return { label: AWS_INSTALL_STATUS_LABEL[s], tag: STATUS_TAG[s], count: null, kind };
  }
  const values = status.resources.map((r) => step.pick!(r).status);
  const settled = values.filter((v) => v === 'COMPLETED' || v === 'SKIP').length;
  const count = `${settled}/${values.length}`;
  if (values.includes('FAIL')) {
    return { label: '실패', tag: tagStyles.error, count, kind: 'failed' };
  }
  if (values.includes('IN_PROGRESS')) {
    return { label: '진행중', tag: tagStyles.info, count, kind: 'running' };
  }
  if (values.length > 0 && settled === values.length) {
    return { label: '완료', tag: tagStyles.success, count, kind: 'done' };
  }
  return { label: '대기', tag: tagStyles.neutral, count, kind: 'waiting' };
};

const SideTag = ({ side }: { side: string }) => (
  <span
    className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold whitespace-nowrap',
      borderColors.default,
      textColors.secondary,
      side.startsWith('BDC') && 'border-dashed',
    )}
  >
    {side}
  </span>
);

interface ResourceRow {
  resourceId: string;
  resourceName: string | null;
  region: string | null;
  databaseType: DatabaseType | null;
  status: AwsInstallStepValue;
  guide: string | null;
}

const StepResourceTable = ({ rows }: { rows: ResourceRow[] }) => {
  const { page, pageSize, setPage, setPageSize, pageItems } = usePagination(rows);

  if (rows.length === 0) {
    return (
      <div className={cn('px-4 py-3 rounded-lg border text-sm', borderColors.default, textColors.tertiary)}>
        설치 대상 리소스가 없습니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className={idcStyles.table.frame}>
        <table className="w-full text-sm">
          <thead className={bgColors.muted}>
            <tr>
              <th className={TABLE_HEADER_CELL}>Database Type</th>
              <th className={TABLE_HEADER_CELL}>Resource Name</th>
              <th className={TABLE_HEADER_CELL}>Resource ID</th>
              <th className={TABLE_HEADER_CELL}>Region</th>
              <th className={TABLE_HEADER_CELL}>상태</th>
              <th className={TABLE_HEADER_CELL}>안내</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((row) => (
              <tr
                key={row.resourceId}
                className={cn('border-t border-[#EBEEF2] group', row.status === 'FAIL' && statusColors.error.bg)}
              >
                <td className={TABLE_BODY_CELL}>
                  {row.databaseType ? (
                    <span className={cn(TABLE_TAG_PILL, tagStyles.info)}>
                      {getDatabaseShortLabel(row.databaseType)}
                    </span>
                  ) : (
                    <span className={textColors.tertiary}>—</span>
                  )}
                </td>
                <td className={TABLE_MONO_CELL}>{row.resourceName ?? '—'}</td>
                <td className={TABLE_MONO_CELL}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap [direction:rtl] text-left">
                      {row.resourceId}
                    </span>
                    <CopyButton
                      value={row.resourceId}
                      label={`${row.resourceId} 복사`}
                      className="opacity-0 group-hover:opacity-100"
                    />
                  </span>
                </td>
                <td className={TABLE_MONO_CELL}>{row.region ?? '—'}</td>
                <td className={TABLE_BODY_CELL}>
                  <StatusPill status={row.status} />
                </td>
                <td className={cn(TABLE_BODY_CELL, 'text-[13px]')}>
                  {row.guide ? (
                    <span
                      className={cn(
                        'block max-w-[320px] overflow-hidden text-ellipsis whitespace-nowrap',
                        row.status === 'FAIL' ? statusColors.error.textDark : textColors.secondary,
                      )}
                      title={row.guide}
                    >
                      {row.guide}
                    </span>
                  ) : (
                    <span className={textColors.tertiary}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        totalCount={rows.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[10, 20, 50]}
      />
    </div>
  );
};

const RoleVerifyPanel = ({ status }: { status: AwsInstallationStatus }) => (
  <div className={cn('rounded-xl border px-5 py-4 flex flex-col gap-1', borderColors.default)}>
    <div className="flex gap-3 py-1.5 text-sm items-center">
      <span className={cn('w-24 flex-shrink-0', textColors.tertiary)}>검증 결과</span>
      <StatusPill status={status.roleVerify.status} />
    </div>
    <div className="flex gap-3 py-1.5 text-sm items-center">
      <span className={cn('w-24 flex-shrink-0', textColors.tertiary)}>Role ARN</span>
      {status.roleVerify.roleArn ? (
        <span className="inline-flex items-center gap-1.5 min-w-0 group">
          <span className={cn('font-mono text-[12px] break-all', textColors.primary)}>{status.roleVerify.roleArn}</span>
          <CopyButton
            value={status.roleVerify.roleArn}
            label="Role ARN 복사"
            className="opacity-0 group-hover:opacity-100"
          />
        </span>
      ) : (
        <span className={textColors.tertiary}>—</span>
      )}
    </div>
    {status.lastCheck.checkedAt && (
      <div className="flex gap-3 py-1.5 text-sm items-center">
        <span className={cn('w-24 flex-shrink-0', textColors.tertiary)}>확인 시각</span>
        <span className={textColors.primary}>{formatDateTime(status.lastCheck.checkedAt)}</span>
      </div>
    )}
  </div>
);

interface AwsInstallStatusDetailProps {
  status: AwsInstallationStatus;
  confirmed: readonly ConfirmedResource[];
  manualInstall: boolean;
}

export const AwsInstallStatusDetail = ({
  status,
  confirmed,
  manualInstall,
}: AwsInstallStatusDetailProps) => {
  const steps = useMemo(() => buildSteps(manualInstall), [manualInstall]);
  const aggregates = useMemo(
    () => new Map(steps.map((s) => [s.id, aggregateStep(s, status)])),
    [steps, status],
  );

  // Default selection follows the data (failed > running > waiting step);
  // a user click pins the selection.
  const hotStepId = useMemo<StepId>(() => {
    for (const kind of ['failed', 'running', 'waiting'] as const) {
      const hit = steps.find((s) => s.id !== 'summary' && aggregates.get(s.id)?.kind === kind);
      if (hit) return hit.id;
    }
    return 'summary';
  }, [steps, aggregates]);
  const [selected, setSelected] = useState<StepId | null>(null);
  const activeId = selected ?? hotStepId;
  const active = steps.find((s) => s.id === activeId) ?? steps[0];
  const activeAggregate = aggregates.get(active.id);

  const metaById = useMemo(
    () => new Map(confirmed.map((c) => [c.resourceId, c])),
    [confirmed],
  );

  const rows = useMemo<ResourceRow[]>(() => {
    if (!active.pick) return [];
    return status.resources.map((r) => {
      const meta = metaById.get(r.resourceId);
      const step = active.pick!(r);
      return {
        resourceId: r.resourceId,
        resourceName: r.resourceName ?? meta?.resourceName ?? null,
        region: meta?.region ?? null,
        databaseType: meta?.databaseType ?? null,
        status: step.status,
        guide: step.guide,
      };
    });
  }, [active, status.resources, metaById]);

  return (
    <div className={cn('grid grid-cols-[280px_minmax(0,1fr)] rounded-xl border overflow-hidden', borderColors.default)}>
      <nav className={cn('border-r p-2.5 flex flex-col gap-1 bg-white', borderColors.default)} aria-label="설치 단계">
        {steps.map((step, index) => {
          const aggregate = aggregates.get(step.id)!;
          const isActive = step.id === activeId;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setSelected(step.id)}
              aria-current={isActive}
              className={cn(
                'flex items-start gap-2.5 w-full text-left px-2.5 py-2.5 rounded-lg border',
                isActive
                  ? cn(bgColors.muted, borderColors.default)
                  : cn('border-transparent', bgColors.mutedHover),
              )}
            >
              <span
                className={cn(
                  'w-6 h-6 rounded-full grid place-items-center text-[11.5px] font-bold flex-shrink-0 mt-0.5',
                  bgColors.muted,
                  textColors.secondary,
                )}
              >
                {step.id === 'summary' ? '≡' : index}
              </span>
              <span className="min-w-0 flex flex-col gap-1.5">
                <span className={cn('text-[13px] font-bold leading-[1.35] tracking-[-0.01em]', textColors.primary)}>
                  {step.title}
                </span>
                <span className="flex items-center gap-1.5 flex-wrap">
                  {step.side && <SideTag side={step.side} />}
                  <span className={cn(TABLE_TAG_PILL, 'whitespace-nowrap', aggregate.tag)}>{aggregate.label}</span>
                  {aggregate.count && (
                    <span className={cn('text-[11px] font-semibold tabular-nums', textColors.tertiary)}>
                      {aggregate.count}
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="p-5 bg-white min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={cn('text-[16px] font-bold tracking-[-0.02em]', textColors.primary)}>{active.title}</h3>
              {active.side && <SideTag side={active.side} />}
            </div>
            <p className={cn('mt-1 text-[12.5px] max-w-[60ch]', textColors.secondary)}>
              {active.desc}
            </p>
          </div>
          {activeAggregate && (
            <span className={cn(TABLE_TAG_PILL, activeAggregate.tag, 'flex-shrink-0 whitespace-nowrap')}>
              {activeAggregate.count
                ? `${activeAggregate.label} ${activeAggregate.count}`
                : activeAggregate.label}
            </span>
          )}
        </div>

        {active.pick && (
          <div className={cn('mt-3 mb-2.5 text-[11.5px]', textColors.tertiary)}>
            {status.lastCheck.checkedAt && (
              <>마지막 확인 {formatDateTime(status.lastCheck.checkedAt)}</>
            )}
            {status.lastCheck.status === 'FAILED' && (
              <span className={cn('font-semibold', statusColors.error.textDark)}> · 상태 확인 실패</span>
            )}
          </div>
        )}

        <div className={active.pick ? '' : 'mt-4'}>
          {/* key resets pagination when switching steps */}
          {active.pick ? (
            <StepResourceTable key={active.id} rows={rows} />
          ) : (
            <RoleVerifyPanel status={status} />
          )}
        </div>
      </div>
    </div>
  );
};
