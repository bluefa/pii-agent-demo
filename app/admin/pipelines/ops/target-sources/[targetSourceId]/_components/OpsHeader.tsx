'use client';

/**
 * Ops page header (design-benchmark `ops-target-source-header.md`, 시안 A1) — the
 * sibling PipelineDetailView grammar transplanted: a fixed page label (h1) over a
 * bare provider mark + 3-tier identity (provider·#id·현재 단계 → 서비스 이름·코드 →
 * 계정·리전·설치모드), role ARN rows as tier 4, and the two service-axis
 * destinations (Jira 티켓 · 서비스 운영) as a quiet side line under tier 2.
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
import type { TargetJiraTicket } from '@/app/lib/api/ops';
import type { ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';
import { StepPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/StepPill';
import { ROLE_META, type RoleKind } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/roleMeta';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

/** Jira brand mark (Simple Icons path), tinted with the primary token. */
function JiraMark(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 flex-none text-[var(--pl-primary)]"
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
  jiraTicket: TargetJiraTicket | null;
  /** false = 아직 조회 중 — null 을 "티켓 없음" 으로 단정하지 않는다. */
  ticketLoaded: boolean;
  /** 실데이터 여부. `undefined` = 응답에 값이 없다 — "미포함"이 아니라 "미확인". */
  doesSupportRaw: boolean | undefined;
  onOpenMode: () => void;
  onOpenEdit: (kind: RoleKind) => void;
  onOpenRawData: () => void;
}

export function OpsHeader({
  targetSourceId,
  detail,
  processStatus,
  isAws,
  savedRoleArns,
  grantTfExecution,
  jiraTicket,
  ticketLoaded,
  doesSupportRaw,
  onOpenMode,
  onOpenEdit,
  onOpenRawData,
}: OpsHeaderProps): ReactElement {
  const h = improvedStyles.header;
  const meta = detail.metadata ?? {};
  const isChina = meta.is_china_region === true;
  const provider = providerLabel(displayProvider(detail.cloud_provider, meta.is_sdu_type));
  // 대상의 성질이라 신원 스택 1층 — 단계 알약 옆이다. 계정 줄(3층)에 두면 계정이 없는
  // provider(IDC·SDU)에서는 줄 자체가 안 그려져 칩이 통째로 사라진다.
  // 세 상태를 항상 그린다: 값이 없는 것을 "미포함"으로 적으면 화면이 읽지도 못한 값을
  // 단정하게 되고, 여기는 그 값을 바꾸는 자리라 무엇을 바꾸는지부터 보여야 한다.
  const rawDataLabel =
    doesSupportRaw === true ? '포함' : doesSupportRaw === false ? '미포함' : '미확인';

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
            <button
              type="button"
              className={cn(opsStyles.rawDataTag, opsStyles.rawDataToggle, 'ml-0.5')}
              onClick={onOpenRawData}
              title="실데이터 여부 변경"
            >
              <span className={opsStyles.rawDataToggleKey}>실데이터</span>
              <span className={opsStyles.rawDataToggleValue}>{rawDataLabel}</span>
            </button>
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

          {/* 서비스 축의 두 목적지 — 티켓(외부)과 서비스 운영 화면(내부). 라벨 붙은
              블록으로 화면 반대편에 세워 두면 이름·코드와 같은 이야기를 두 군데서
              하는 셈이라, 그 이름 바로 아래 곁줄로 내려 붙인다. 티켓 연결·해제는
              서비스 × provider 축의 계약이라 이 화면에는 없다 — 그 화면으로 보내는
              것이 여기서 할 수 있는 전부다. */}
          <div className={opsStyles.chanRow}>
            {!ticketLoaded ? (
              <span className={cn(opsStyles.skeleton, 'h-4 w-[84px]')} aria-hidden />
            ) : !jiraTicket ? (
              <span className={opsStyles.chanNone}>연결된 티켓 없음</span>
            ) : jiraTicket.browseUrl ? (
              <a
                href={jiraTicket.browseUrl}
                target="_blank"
                rel="noreferrer"
                className={opsStyles.chanLink}
                title="협업 채널 — Jira에서 논의하기"
              >
                <JiraMark />
                <span className={opsStyles.chanKind}>Jira Ticket</span>
                <span className={opsStyles.chanLinkText}>{jiraTicket.issueKey}</span>
                <span className={opsStyles.chanArrow}>↗</span>
              </a>
            ) : (
              /* 열 주소가 없으면 키는 값일 뿐이다 — 링크로 그리지 않는다 (URL 조립 금지). */
              <span className={opsStyles.chanLink}>
                <JiraMark />
                <span className={opsStyles.chanKind}>Jira Ticket</span>
                <span className={opsStyles.chanPlain}>{jiraTicket.issueKey}</span>
              </span>
            )}
            {/* 서비스가 없으면 갈 운영 화면도 없다 — 라벨이 사라진 줄에서 없는 목적지는
                말하지 않고 빠진다 (안내할 자리가 없다). */}
            {detail.service_code && (
              <Link
                href={passRoutes.pipelines.ops.service(detail.service_code)}
                className={opsStyles.chanLink}
                title={`서비스 ${detail.service_code} 운영 — 티켓 연결·해제`}
              >
                <span className={opsStyles.chanLinkText}>서비스 관리</span>
                <span className={opsStyles.chanArrow}>↗</span>
              </Link>
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
  );
}
