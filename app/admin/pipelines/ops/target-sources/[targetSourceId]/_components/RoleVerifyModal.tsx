'use client';

/**
 * Role 권한 확인 modal (Figma 1:2). Contract honesty: the verify API returns a
 * SINGLE verdict — required permissions render as a static reference list, never
 * painted pass/fail per item.
 */
import { useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { fmtDateTime } from '@/lib/pipeline/format';
import { getAwsRoleVerification, type AwsRoleVerification } from '@/app/lib/api/aws';
import { ROLE_META, type RoleKind } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/roleMeta';

const TITLE_ID = 'ops-role-verify-title';

/** Static reference list — the verify API gives no per-permission results. */
const REQUIRED_PERMS: Record<RoleKind, readonly string[]> = {
  scan: ['rds:DescribeDBInstances', 'rds:DescribeDBClusters', 'ec2:DescribeSubnets', 'secretsmanager:GetSecretValue'],
  execution: ['iam:PassRole', 'ec2:RunInstances', 'ec2:CreateSecurityGroup', 'elasticloadbalancing:CreateTargetGroup'],
};

const verdictMeta = (status?: string | null) => {
  switch (status) {
    case 'VALID':
    case 'COMPLETED':
      return { label: '검증 완료', cls: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]', ok: true };
    case 'IN_PROGRESS':
      return { label: '검증 중', cls: 'bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]', ok: false };
    case 'FAIL':
    case 'INVALID':
      return { label: '검증 실패', cls: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]', ok: false };
    default:
      return { label: status ?? '알 수 없음', cls: 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)]', ok: false };
  }
};

export interface RoleVerifyModalProps {
  open: boolean;
  onClose: () => void;
  targetSourceId: number;
  kind: RoleKind;
  verification: AwsRoleVerification | null;
  serviceName: string;
  serviceCode: string;
  regionLabel: string;
  /** Fresh verification fetched via [다시 확인] — parent keeps header in sync. */
  onRefreshed: (kind: RoleKind, verification: AwsRoleVerification) => void;
  /** [Role 수정] — parent swaps this modal for the edit modal. */
  onEdit: (kind: RoleKind) => void;
}

export function RoleVerifyModal({
  open,
  onClose,
  targetSourceId,
  kind,
  verification,
  serviceName,
  serviceCode,
  regionLabel,
  onRefreshed,
  onEdit,
}: RoleVerifyModalProps): ReactElement | null {
  const [refreshing, setRefreshing] = useState(false);
  const meta = ROLE_META[kind];
  const verdict = verdictMeta(verification?.status);

  const refresh = async (): Promise<void> => {
    setRefreshing(true);
    try {
      onRefreshed(kind, await getAwsRoleVerification(targetSourceId, kind));
    } catch {
      // Verify is read-only; a failed refresh keeps the last verdict on screen.
    } finally {
      setRefreshing(false);
    }
  };

  const infoRow = (label: string, value: ReactElement | string): ReactElement => (
    <div className="flex items-center gap-3 text-[12px]">
      <span className="w-[72px] flex-none text-[var(--pl-text-faint)]">{label}</span>
      {typeof value === 'string' ? (
        <span className="font-medium text-[var(--pl-text-strong)]">{value}</span>
      ) : (
        value
      )}
    </div>
  );

  return (
    <ModalShell open={open} onClose={onClose} labelledBy={TITLE_ID}>
      <h3 id={TITLE_ID} className={pipelineStyles.modal.title}>{meta.title} 권한 확인</h3>
      <p className={pipelineStyles.modal.desc}>해당 Role에 대한 권한 검증을 수행합니다.</p>

      <div className="flex flex-col gap-1.5 rounded-lg bg-[var(--pl-gray-50)] p-3">
        {infoRow('서비스 이름', serviceName)}
        {infoRow('코드', <span className={pipelineStyles.text.mono}>{serviceCode}</span>)}
        {infoRow(
          '리전',
          <span className="inline-flex items-center rounded bg-[var(--pl-gray-100)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--pl-text-weak)]">
            {regionLabel}
          </span>,
        )}
        {infoRow(
          meta.short,
          <span className={cn(pipelineStyles.text.mono, 'break-all text-[var(--pl-primary)]')}>
            {verification?.role_arn ?? '미등록'}
          </span>,
        )}
      </div>

      <div className="mt-4 flex items-center gap-4">
        <span className="flex items-center gap-2 text-[12px] text-[var(--pl-text-weak)]">
          검증 상태
          <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[12px] font-semibold', verdict.cls)}>
            {verdict.label}
          </span>
        </span>
        <span className="flex items-center gap-2 text-[12px] text-[var(--pl-text-weak)]">
          최근 검증
          <span className="text-[14px] font-medium text-[var(--pl-text-strong)]">
            {verification?.last_verified_at ? fmtDateTime(verification.last_verified_at) : '-'}
          </span>
        </span>
      </div>

      {verdict.ok && (
        <p className="mt-3 text-[14px] font-semibold text-[var(--pl-ok-text)]">
          필수 권한이 모두 확인되었습니다.
        </p>
      )}
      {verification?.fail_message && !verdict.ok && (
        <p className="mt-3 text-[14px] font-medium text-[var(--pl-err-text)]">
          {verification.fail_message}
        </p>
      )}

      <div className="mt-4">
        <p className={pipelineStyles.text.subsectionTitle}>필요 권한</p>
        <p className={cn(pipelineStyles.text.meta, 'mt-1')}>
          이 Role에 부여돼야 하는 항목입니다. 검증 API는 권한별 결과를 주지 않습니다.
        </p>
        <ul className="mt-2">
          {REQUIRED_PERMS[kind].map((perm) => (
            <li
              key={perm}
              className={cn(
                pipelineStyles.text.mono,
                'border-t border-[var(--pl-gray-100)] py-2.5 first:border-t-0',
              )}
            >
              {perm}
            </li>
          ))}
        </ul>
      </div>

      <div className={pipelineStyles.modal.foot}>
        <PlButton variant="secondary" onClick={() => void refresh()} disabled={refreshing}>
          {refreshing ? '확인 중…' : '다시 확인'}
        </PlButton>
        <PlButton variant="secondary" onClick={() => onEdit(kind)}>
          Role 수정
        </PlButton>
        <PlButton variant="primary" onClick={onClose}>
          닫기
        </PlButton>
      </div>
    </ModalShell>
  );
}
