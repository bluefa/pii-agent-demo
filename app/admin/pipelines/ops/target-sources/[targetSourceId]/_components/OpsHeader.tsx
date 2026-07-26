'use client';

/**
 * Ops page header (Figma 4:78) — breadcrumb · 현재 단계 pill · title group ·
 * cloud inline row (Global/설치모드 tags) · role ARN sub-rows · 협업 채널 bubble.
 * Role rows and the 설치모드 tag are AWS-only; the TF Role row shows in AUTO mode.
 */
import Link from 'next/link';
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { displayProvider, providerLabel } from '@/lib/pipeline/format';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import type { AwsRoleVerification } from '@/app/lib/api/aws';
import type { CollaborationChannel } from '@/app/lib/api/ops';
import type { ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';
import { StepPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/StepPill';
import { ROLE_META, type RoleKind } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/roleMeta';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

/** Jira brand mark (Simple Icons path), tinted with the primary token. */
function JiraMark(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[13px] w-[13px] flex-none text-[var(--pl-primary)]"
      fill="currentColor"
      aria-hidden
    >
      <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0z" />
    </svg>
  );
}

export interface OpsHeaderProps {
  targetSourceId: number;
  detail: RawTargetSourceDetail;
  processStatus: ProcessStatus | null;
  isAws: boolean;
  /** null while loading / on error; role rows render 미등록 when role_arn is absent. */
  roles: Partial<Record<RoleKind, AwsRoleVerification | null>>;
  grantTfExecution: boolean;
  channel: CollaborationChannel | null;
  onOpenMode: () => void;
  onOpenVerify: (kind: RoleKind) => void;
  onOpenEdit: (kind: RoleKind) => void;
  onOpenChannel: () => void;
}

export function OpsHeader({
  targetSourceId,
  detail,
  processStatus,
  isAws,
  roles,
  grantTfExecution,
  channel,
  onOpenMode,
  onOpenVerify,
  onOpenEdit,
  onOpenChannel,
}: OpsHeaderProps): ReactElement {
  const { breadcrumb } = pipelineStyles;
  const meta = detail.metadata ?? {};
  const isChina = meta.is_china_region === true;
  const provider = providerLabel(displayProvider(detail.cloud_provider, meta.is_sdu_type));

  const roleRow = (kind: RoleKind): ReactElement => {
    const verification = roles[kind];
    const arn = verification?.role_arn;
    return (
      <div className={opsStyles.roleRow}>
        <span className={opsStyles.roleLabel}>{ROLE_META[kind].short}</span>
        {arn ? (
          <button type="button" className={opsStyles.roleArn} onClick={() => onOpenVerify(kind)}>
            {arn}
          </button>
        ) : (
          <>
            <span className={opsStyles.roleEmpty}>미등록</span>
            <button type="button" className={opsStyles.roleRegister} onClick={() => onOpenEdit(kind)}>
              등록하기
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className={opsStyles.header}>
      <nav aria-label="현재 위치" className={cn(breadcrumb.base, 'mb-0')}>
        <Link href={passRoutes.pipelines.ops.targetSources} className={breadcrumb.crumb}>
          Target Source 운영
        </Link>
        <span className={breadcrumb.sep}>/</span>
        <span className={breadcrumb.cur}>#{targetSourceId}</span>
      </nav>

      <div className={opsStyles.stageRow}>
        <span className={opsStyles.stageLabel}>현재 단계</span>
        {processStatus ? (
          <StepPill status={processStatus} />
        ) : (
          <span className={opsStyles.stageLabel}>-</span>
        )}
      </div>

      <div className={opsStyles.titleRow}>
        <div className="min-w-0">
          <div className={opsStyles.titleGroup}>
            <h1 className={cn(pipelineStyles.text.pageTitle, 'truncate')}>
              {detail.service_name ?? detail.service_code ?? `#${targetSourceId}`}
            </h1>
            <span className={opsStyles.tag}>Target # {targetSourceId}</span>
            {detail.service_code && <span className={opsStyles.tag}>{detail.service_code}</span>}
          </div>

          <div className={opsStyles.cloudRow}>
            <span className={opsStyles.cloudStrong}>{provider}</span>
            {isAws && meta.aws_account_id && (
              <>
                <span className={opsStyles.cloudSep}>·</span>
                <span className={cn(opsStyles.cloudStrong, 'tabular-nums')}>{meta.aws_account_id}</span>
                <span className={opsStyles.cloudSep}>·</span>
                <span className={opsStyles.regionTag}>{isChina ? 'China' : 'Global'}</span>
                <button type="button" className={opsStyles.modeTag} onClick={onOpenMode}>
                  <span className={opsStyles.modeTagKey}>설치모드</span>
                  <span className={opsStyles.modeTagValue}>{grantTfExecution ? '자동' : '수동'}</span>
                </button>
              </>
            )}
          </div>

          {isAws && (
            <div className="mt-1">
              {roleRow('scan')}
              {grantTfExecution && roleRow('execution')}
            </div>
          )}
        </div>

        <div className={opsStyles.bubbleWrap}>
          <div className={opsStyles.bubble}>
            <div className={opsStyles.bubbleTop}>
              <span className={opsStyles.bubbleTitle}>협업 채널</span>
              {/* 관리 lands on the service ops page (Jira ticket management lives
                  there); the modal remains the fallback when no service is linked. */}
              {detail.service_code ? (
                <Link
                  href={passRoutes.pipelines.ops.service(detail.service_code)}
                  className={opsStyles.bubbleManage}
                >
                  관리
                </Link>
              ) : (
                <button type="button" className={opsStyles.bubbleManage} onClick={onOpenChannel}>
                  관리
                </button>
              )}
            </div>
            {channel ? (
              <a
                href={channel.url}
                target="_blank"
                rel="noreferrer"
                className={opsStyles.bubbleJiraRow}
              >
                <JiraMark />
                <span className={opsStyles.bubbleLink}>
                  {channel.issue_key} <span aria-hidden>↗</span>
                </span>
              </a>
            ) : (
              <span className={cn(pipelineStyles.text.meta, 'whitespace-nowrap')}>연결된 채널 없음</span>
            )}
          </div>
          <span className={opsStyles.bubbleTail} aria-hidden />
        </div>
      </div>
    </div>
  );
}
