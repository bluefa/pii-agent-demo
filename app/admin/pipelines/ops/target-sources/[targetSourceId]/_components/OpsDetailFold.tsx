'use client';

/**
 * 「상세 정보」 접힘 (design-benchmark `ops-target-frontmeta.md`, 시안 C) — the
 * body of the FrontMeta disclosure. Three named groups side by side, so opening
 * it adds one band rather than a column of stacked rows:
 *
 *   서비스   the axis the 236px meta rail used to own — 이름 · 코드 · 운영. The Jira
 *            ticket left for the masthead's 관련 페이지 cell (오너 2026-08-26): where the
 *            discussion happens is a question the header answers, and one link in two
 *            places is one link too many.
 *   대상     the target's own prose and dates — 설명(전문 + 수정) · 생성일 · 최초 연동
 *   식별자   every mono identifier IN FULL, with copy
 *
 * The 식별자 group repeats values the strip above already shows, and that is the
 * point: the strip is read at a glance (an ARN folds to its role name, a long id
 * ellipses), while this group is the place the whole string can be selected and
 * copied. Before this, 전문 lived only inside a `title` tooltip — visible for two
 * seconds, selectable never.
 */
import Link from 'next/link';
import { useState, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { fmtDate } from '@/lib/pipeline/format';
import { normalizeCloudProvider } from '@/lib/types';
import { TIMINGS } from '@/lib/constants/timings';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import type { RoleKind } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/roleMeta';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

export interface OpsDetailFoldProps {
  id: string;
  detail: RawTargetSourceDetail;
  grantTfExecution: boolean;
  /** 이 화면에서 방금 저장한 ARN만 — 그 외에는 detail.metadata 가 표시의 유일한 출처. */
  savedRoleArns: Partial<Record<RoleKind, string>>;
  onEditDescription: () => void;
}

/** 전문 옆의 복사 — 값이 아니라 동작이라 아이콘 하나로 서고, 누른 뒤 체크로 답한다. */
function CopyButton({ value, label }: { value: string; label: string }): ReactElement {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={opsStyles.fmCopy}
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), TIMINGS.COPY_FEEDBACK_MS);
        } catch (error) {
          console.warn('[OpsDetailFold] clipboard.writeText failed', { error, label });
        }
      }}
    >
      <Icon name={copied ? 'check' : 'copy'} size="sm" />
    </button>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <section className={opsStyles.fmFoldGroup}>
      <h3 className={opsStyles.fmFoldLabel}>{label}</h3>
      {children}
    </section>
  );
}

function Cell({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className={opsStyles.fmCell}>
      <span className={opsStyles.fmKey}>{label}</span>
      {children}
    </div>
  );
}

export function OpsDetailFold({
  id,
  detail,
  grantTfExecution,
  savedRoleArns,
  onEditDescription,
}: OpsDetailFoldProps): ReactElement {
  const meta = detail.metadata ?? {};
  const provider = normalizeCloudProvider(detail.cloud_provider);
  const description = (detail.description ?? '').trim();

  // 프로바이더마다 갖는 mono 식별자를 한 줄로 모은다 — 없는 값은 행째로 빠진다
  // (빈 값을 '-' 로 그리면 화면이 읽지도 못한 사실을 단정한다).
  const identifiers: Array<{ label: string; value: string }> = [];
  const push = (label: string, value: string | null | undefined): void => {
    if (value && value.trim() !== '') identifiers.push({ label, value });
  };
  if (provider === 'AWS') {
    push('계정 ID', meta.aws_account_id);
    push('Scan Role ARN', savedRoleArns.scan ?? meta.aws_scan_role_arn);
    if (grantTfExecution) {
      push('Terraform Role ARN', savedRoleArns.execution ?? meta.aws_terraform_execution_role_arn);
    }
  } else if (provider === 'GCP') {
    push('Project ID', meta.gcp_project_id);
    push('Scan Service Account', meta.gcp_scan_service_account);
    push('Terraform Service Account', meta.gcp_terraform_service_account);
  } else if (provider === 'Azure') {
    push('Subscription ID', meta.subscription_id);
    push('Tenant ID', meta.tenant_id);
    push('Scan App ID', meta.azure_scan_app_id);
  }

  return (
    <div id={id} className={opsStyles.fmFold}>
      <Group label="서비스">
        <Cell label="이름">
          <span className={opsStyles.fmValue}>
            <span className={opsStyles.fmValueText} title={detail.service_name ?? undefined}>
              {detail.service_name ?? '-'}
            </span>
          </span>
        </Cell>
        {detail.service_code && (
          <Cell label="코드">
            <span className={opsStyles.fmValue}>
              <span className={cn(opsStyles.fmValueText, opsStyles.fmMono)}>
                {detail.service_code}
              </span>
            </span>
          </Cell>
        )}
        {/* 서비스가 없으면 갈 운영 화면도 없다 — 없는 목적지는 말하지 않고 빠진다. */}
        {detail.service_code && (
          <Cell label="운영">
            <span className={opsStyles.fmValue}>
              <Link
                href={passRoutes.pipelines.ops.service(detail.service_code)}
                className={opsStyles.fmLink}
                title={`서비스 ${detail.service_code} 운영 — 티켓 연결·해제`}
              >
                서비스 관리 ↗
              </Link>
            </span>
          </Cell>
        )}
      </Group>

      <Group label="대상">
        <div className={opsStyles.fmCell}>
          <span className={opsStyles.fmKey}>
            설명
            <button
              type="button"
              className={cn(opsStyles.fmLink, 'ml-2')}
              onClick={onEditDescription}
              title={description ? '설명 수정' : '설명 등록'}
            >
              {description ? '수정' : '등록하기'}
            </button>
          </span>
          {/* 레일이 236px 였을 때는 표시를 100자에서 접었다 — 3열 접힘에는 그 폭
              제약이 없으므로 전문을 편다. 계약의 1000자 한도는 수정 모달이 진다. */}
          {description ? (
            <p className={opsStyles.fmProse}>{description}</p>
          ) : (
            <span className={opsStyles.fmNone}>없음</span>
          )}
        </div>
        <Cell label="생성일">
          <span className={opsStyles.fmValue}>
            <span className="tabular-nums">{fmtDate(detail.created_at)}</span>
          </span>
        </Cell>
        <Cell label="최초 연동">
          <span className={opsStyles.fmValue}>
            {detail.pii_agent_first_installed_at ? (
              <span className="tabular-nums">{fmtDate(detail.pii_agent_first_installed_at)}</span>
            ) : (
              <span className={opsStyles.fmNone}>없음</span>
            )}
          </span>
        </Cell>
      </Group>

      {identifiers.length > 0 && (
        <Group label="식별자">
          {identifiers.map(({ label, value }) => (
            <div key={label} className={opsStyles.fmCell}>
              <span className={opsStyles.fmKey}>{label}</span>
              <span className="flex items-start gap-1">
                <span className={cn(opsStyles.fmValueFull, opsStyles.fmMono)}>{value}</span>
                <CopyButton value={value} label={`${label} 복사`} />
              </span>
            </div>
          ))}
        </Group>
      )}
    </div>
  );
}
