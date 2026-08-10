'use client';

/**
 * Ops page header (design-benchmark `ops-target-source-header.md`, 시안 A1) — the
 * sibling PipelineDetailView grammar transplanted: a fixed page label (h1) over a
 * bare provider mark + 3-tier identity (provider·#id·현재 단계 → 서비스 이름·코드 →
 * 계정·리전·설치모드), role ARN rows as tier 4, and the 협업 채널 block docked right.
 * Every identity metric comes from `improvedStyles.header` — no new values, and the
 * two screens that link to each other now draw the same target the same way.
 * Role rows and the 설치모드 tag are AWS-only; the TF Role row shows in AUTO mode.
 */
import Link from 'next/link';
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { displayProvider, providerLabel } from '@/lib/pipeline/format';
import { normalizeCloudProvider } from '@/lib/types';
import { ProviderLogo } from '@/app/components/features/admin/v7/ProviderLogo';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { improvedStyles } from '@/app/admin/pipelines/_detail/detailImprovedStyles';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
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
  /** 이 화면에서 방금 저장한 ARN만 — 그 외에는 detail.metadata 가 표시의 유일한 출처. */
  savedRoleArns: Partial<Record<RoleKind, string>>;
  grantTfExecution: boolean;
  channel: CollaborationChannel | null;
  /** false = 아직 조회 중 — null 을 "티켓 없음" 으로 단정하지 않는다. */
  channelLoaded: boolean;
  onOpenMode: () => void;
  onOpenEdit: (kind: RoleKind) => void;
  onOpenChannel: () => void;
}

export function OpsHeader({
  targetSourceId,
  detail,
  processStatus,
  isAws,
  savedRoleArns,
  grantTfExecution,
  channel,
  channelLoaded,
  onOpenMode,
  onOpenEdit,
  onOpenChannel,
}: OpsHeaderProps): ReactElement {
  const h = improvedStyles.header;
  const meta = detail.metadata ?? {};
  const isChina = meta.is_china_region === true;
  const provider = providerLabel(displayProvider(detail.cloud_provider, meta.is_sdu_type));

  const roleRow = (kind: RoleKind): ReactElement => {
    // 표시값은 detail 과 같이 온다 (v5 metadata 의 등록값) — 별도 조회가 없으니
    // 첫 페인트가 곧 최종값이고, 미등록이 ARN 으로 뒤집히는 깜빡임이 없다.
    const arn =
      savedRoleArns[kind]
      ?? (kind === 'scan' ? meta.aws_scan_role_arn : meta.aws_terraform_execution_role_arn);
    return (
      <div className={opsStyles.roleRow}>
        <span className={opsStyles.roleLabel}>{ROLE_META[kind].short}</span>
        {arn ? (
          <>
            {/* ARN 은 값이지 동작이 아니다 — 링크로 그리지 않고, 동작(수정)은 옆 버튼이 맡는다. */}
            <span className={opsStyles.roleValue}>{arn}</span>
            <button type="button" className={opsStyles.roleRegister} onClick={() => onOpenEdit(kind)}>
              수정
            </button>
          </>
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

  /** Read-only 주체 행 (GCP SA·Azure App) — 등록/수정 계약이 없어 표시만 한다. */
  const infoRow = (label: string, value: string | null | undefined): ReactElement => (
    <div className={opsStyles.roleRow}>
      <span className={opsStyles.roleLabel}>{label}</span>
      {value ? (
        <span className={opsStyles.roleValue}>{value}</span>
      ) : (
        <span className={opsStyles.roleEmpty}>미등록</span>
      )}
    </div>
  );

  return (
    <div className={opsStyles.header}>
      <div className={opsStyles.titleRow}>
        <div className={opsStyles.titleCol}>
          <div className={opsStyles.titleLine}>
            {/* Fixed page label. The subject (#id + service) is the identity stack
                below — a service name as h1 said "which service" three times over
                and never said which target you had opened. */}
            <h1 className={pipelineStyles.text.pageTitle}>Target Source 운영</h1>
            {/* 같은 대상의 서비스측 화면. 운영자가 "담당자한테는 지금 뭐가 보이나"를
                묻는 자리가 여기뿐이라, 목적지를 이름으로 부르는 조용한 링크로 둔다. */}
            <Link
              href={passRoutes.targetSource(targetSourceId)}
              className={h.link}
              title="PII Agent 설치 화면 — 서비스 담당자가 보는 진행 화면"
            >
              서비스가 보는 화면 <Icon name="arrow-ur" size="sm" />
            </Link>
          </div>

          <div className={opsStyles.identityRow}>
            <ProviderLogo
              provider={normalizeCloudProvider(detail.cloud_provider)}
              variant="bare"
              className="flex-none self-center"
            />
            <div className={h.body}>
              <div className={h.idRow}>
                <span className={h.prov}>{provider}</span>
                <span className={h.id}>
                  <span className={h.idHash}>#</span>
                  {targetSourceId}
                </span>
                {processStatus && <StepPill status={processStatus} className="ml-0.5" />}
              </div>

              <div className={h.nameRow}>
                <span className={h.klabel}>서비스 이름</span>
                <span className={h.name} title={detail.service_name ?? undefined}>
                  {detail.service_name ?? '-'}
                </span>
                {detail.service_code && (
                  <>
                    <span className={h.klabel}>코드</span>
                    <span className={h.code}>{detail.service_code}</span>
                  </>
                )}
              </div>

              {isAws && meta.aws_account_id && (
                <div className={opsStyles.cloudRow}>
                  <span className={cn(opsStyles.cloudStrong, 'tabular-nums')}>
                    {meta.aws_account_id}
                  </span>
                  <span className={opsStyles.cloudSep}>·</span>
                  <span>{isChina ? 'China' : 'Global'}</span>
                  <button type="button" className={opsStyles.modeTag} onClick={onOpenMode}>
                    <span className={opsStyles.modeTagKey}>설치모드</span>
                    <span className={opsStyles.modeTagValue}>
                      {grantTfExecution ? '자동' : '수동'}
                    </span>
                  </button>
                </div>
              )}

              {isAws && (
                <div className="mt-1">
                  {roleRow('scan')}
                  {grantTfExecution && roleRow('execution')}
                </div>
              )}

              {/* GCP·Azure scan/terraform 주체 — AWS role 행과 같은 문법의 read-only 행.
                  수정은 AWS 만 계약이 있다 (scan-role/terraform-execution-role upsert). */}
              {detail.cloud_provider === 'GCP' && (
                <div className="mt-1">
                  {infoRow('Scan SA', meta.gcp_scan_service_account)}
                  {infoRow('TF SA', meta.gcp_terraform_service_account)}
                </div>
              )}
              {detail.cloud_provider === 'AZURE' && (
                <div className="mt-1">{infoRow('Scan App', meta.azure_scan_app_id)}</div>
              )}
            </div>
          </div>
        </div>

        {/* 협업 채널 — 티켓(외부) 위에 관리 위치(내부)를 함께 세운다. 목적지를
            "관리" 두 글자가 아니라 이름으로 부르므로 누르기 전에 어디로 가는지 안다. */}
        <div className={opsStyles.chan}>
          <span className={opsStyles.chanLabel}>협업 채널</span>
          {!channelLoaded ? (
            <span className={cn(opsStyles.skeleton, 'h-5 w-[118px]')} aria-hidden />
          ) : channel ? (
            <a href={channel.url} target="_blank" rel="noreferrer" className={opsStyles.chanRow}>
              <JiraMark />
              <span className={opsStyles.chanKey}>
                {channel.issue_key} <span className={opsStyles.chanArrow}>↗</span>
              </span>
            </a>
          ) : (
            <span className={opsStyles.chanNone}>연결된 티켓 없음</span>
          )}
          {detail.service_code ? (
            <Link
              href={passRoutes.pipelines.ops.service(detail.service_code)}
              className={opsStyles.chanGo}
            >
              서비스 <span className={opsStyles.chanGoName}>{detail.service_code} 운영</span>에서
              관리 <span className={opsStyles.chanArrow}>↗</span>
            </Link>
          ) : (
            /* 서비스가 없으면 갈 운영 화면도 없다 — 채널 자체 편집이 유일한 관리 경로. */
            <button type="button" className={opsStyles.chanGo} onClick={onOpenChannel}>
              <span className={opsStyles.chanGoName}>채널 연결 정보</span> 수정
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
