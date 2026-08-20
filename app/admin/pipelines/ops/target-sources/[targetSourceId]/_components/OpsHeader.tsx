'use client';

/**
 * Ops masthead (design-benchmark `ops-detail-ia-redesign.md`, R1 + owner
 * adjustment 08-20) — three lines on one gray-100 wash: breadcrumb (서비스
 * 운영 / 서비스 이름 / #id), the identity line ("Target Source 운영 #{id}" h1 +
 * step pill + first-install stamp + service-side link), and a quiet meta line
 * holding the cloud settings and verification values (account with its region
 * tag · 설치모드 · 실데이터 · Scan/TF role) — the owner pulled these back out of
 * the rail: they are the target's own facts, and the rail keeps the service
 * axis. Editable values render as tags with a 수정 link beside them.
 */
import Link from 'next/link';
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { normalizeCloudProvider } from '@/lib/types';
import { awsRoleArnDisplay } from '@/lib/constants/aws-role';
import { ProviderGlyph } from '@/app/components/ui/CloudProviderIcon';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import type { ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';
import { StepPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/StepPill';
import { CompletedStamp } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/CompletedStamp';
import { ROLE_META, type RoleKind } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/roleMeta';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

export interface OpsHeaderProps {
  targetSourceId: number;
  detail: RawTargetSourceDetail;
  processStatus: ProcessStatus | null;
  isAws: boolean;
  /** 이 화면에서 방금 저장한 ARN만 — 그 외에는 detail.metadata 가 표시의 유일한 출처. */
  savedRoleArns: Partial<Record<RoleKind, string>>;
  grantTfExecution: boolean;
  /** 실데이터 여부. `undefined` = 응답에 값이 없다 — "미포함"이 아니라 "미확인". */
  supportRawData: boolean | undefined;
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
  supportRawData,
  onOpenMode,
  onOpenEdit,
  onOpenRawData,
}: OpsHeaderProps): ReactElement {
  const { button } = pipelineStyles;
  const meta = detail.metadata ?? {};
  const isChina = meta.is_china_region === true;
  // 세 상태를 항상 그린다: 값이 없는 것을 "미포함"으로 적으면 화면이 읽지도 못한
  // 값을 단정하게 되고, 여기는 그 값을 바꾸는 자리라 무엇을 바꾸는지부터 보인다.
  const rawDataLabel =
    supportRawData === true ? '포함' : supportRawData === false ? '미포함' : '미확인';

  /** 수정 가능한 값의 행 (오너 08-20 넷째 조정) — 값은 강조 태그로, 동작은 옆의
      수정 링크로. 태그가 클릭 대상 행세를 하지 않으니 밑줄·hover 채움이 없다. */
  const tagRow = (
    key: string,
    label: string,
    onEdit: () => void,
    editTitle: string,
    tagTitle?: string,
  ): ReactElement => (
    <div className={opsStyles.metaRow}>
      <span className={opsStyles.metaKey}>{key}</span>
      <span className={opsStyles.metaTag} title={tagTitle}>
        {label}
      </span>
      <button type="button" className={opsStyles.railLink} onClick={onEdit} title={editTitle}>
        수정
      </button>
    </div>
  );

  /** 표시값은 detail 과 같이 온다 (v5 metadata 의 등록값) — 저장 직후 한 칸만 saved 가 덮는다. */
  const roleRow = (kind: RoleKind): ReactElement => {
    const arn =
      savedRoleArns[kind]
      ?? (kind === 'scan' ? meta.aws_scan_role_arn : meta.aws_terraform_execution_role_arn);
    return (
      <div className={opsStyles.metaRow}>
        <span className={opsStyles.metaKey}>{ROLE_META[kind].short}</span>
        {arn ? (
          <>
            {/* ARN 은 값이지 동작이 아니다 — 링크로 그리지 않고, 동작(수정)은 옆 버튼이
                맡는다. prefix 가 대상 계정과 일치할 때만 role 이름으로 줄고, 불일치
                (교차 계정·파티션)는 그 prefix 가 어긋남의 유일한 증거라 전체를 남긴다
                (awsRoleArnDisplay). 전체값은 항상 title 에 있다. */}
            <span className={cn(opsStyles.metaValue, opsStyles.railMono, 'break-all')} title={arn}>
              {awsRoleArnDisplay(arn, meta.aws_account_id ?? '', isChina)}
            </span>
            <button type="button" className={opsStyles.railLink} onClick={() => onOpenEdit(kind)}>
              수정
            </button>
          </>
        ) : (
          <>
            <span className={opsStyles.metaKey}>미등록</span>
            <button type="button" className={opsStyles.railLink} onClick={() => onOpenEdit(kind)}>
              등록하기
            </button>
          </>
        )}
      </div>
    );
  };

  /** Read-only 주체 행 (GCP SA·Azure App) — 등록/수정 계약이 없어 표시만 한다. */
  const infoRow = (label: string, value: string | null | undefined): ReactElement => (
    <div className={opsStyles.metaRow}>
      <span className={opsStyles.metaKey}>{label}</span>
      {value ? (
        <span className={cn(opsStyles.metaValue, opsStyles.railMono, 'break-all')} title={value}>
          {value}
        </span>
      ) : (
        <span className={opsStyles.metaKey}>미등록</span>
      )}
    </div>
  );

  return (
    <>
      {/* The service is the container this target lives in, so it is the path,
          not a side block: the first crumb goes to its ops screen when we know
          the code, and the target id closes the path as "you are here". */}
      <nav className={opsStyles.crumb} aria-label="현재 위치">
        {detail.service_code ? (
          <Link
            href={passRoutes.pipelines.ops.service(detail.service_code)}
            className={opsStyles.crumbLink}
            title={`서비스 ${detail.service_code} 운영`}
          >
            서비스 운영
          </Link>
        ) : (
          <span>서비스 운영</span>
        )}
        <span className={opsStyles.crumbSep}>/</span>
        <span className="max-w-[280px] truncate" title={detail.service_name ?? undefined}>
          {detail.service_name ?? '-'}
        </span>
        <span className={opsStyles.crumbSep}>/</span>
        <span className={opsStyles.crumbHere}>#{targetSourceId}</span>
      </nav>

      <div className={opsStyles.idLine}>
        <ProviderGlyph
          provider={normalizeCloudProvider(detail.cloud_provider)}
          isSdu={detail.metadata?.is_sdu_type === true}
          className="h-6 w-6 flex-none text-[var(--pl-text-medium)]"
        />
        {/* 화면 이름 + 대상 번호 (오너 08-20) — provider 는 글리프와 브레드크럼이
            이미 말하므로 제목이 반복하지 않는다. */}
        <h1 className={opsStyles.idTitle}>
          Target Source 운영 <span className={opsStyles.idHash}>#</span>
          <span className={opsStyles.idNum}>{targetSourceId}</span>
        </h1>
        {processStatus && <StepPill status={processStatus} />}
        {/* 도장과 알약은 다른 축이다: 알약은 "지금 어디", 도장은 "최초로 마친 적
            있다 · 언제". 초기화된 대상은 둘이 같이 보이는 것이 말해야 하는 사실이다. */}
        <CompletedStamp firstInstalledAt={detail.pii_agent_first_installed_at} size="md" />
        <span className="flex-1" aria-hidden />
        {/* 같은 대상의 서비스측 화면 — 운영자가 "담당자한테는 지금 뭐가 보이나"를
            묻는 자리가 여기뿐이다. */}
        <Link
          href={passRoutes.targetSource(targetSourceId)}
          className={cn(button.base, button.sm, button.secondary, 'hover:bg-[var(--pl-gray-50)]')}
          title="PII Agent 설치 화면 — 서비스 담당자가 보는 진행 화면"
        >
          서비스가 보는 화면 <Icon name="arrow-ur" size="sm" />
        </Link>
      </div>

      {/* 클라우드 · 설정 + 검증값 — 대상 자신의 사실이라 마스트헤드에 산다 (오너
          08-20, 레일에서 복귀). 한 줄 나열이 아니라 사실 하나에 행 하나 — 기존
          헤더의 행 문법 (오너 08-20 둘째 조정). */}
      <div className={opsStyles.metaRows}>
        {isAws && meta.aws_account_id && (
          <>
            <div className={opsStyles.metaRow}>
              <span className={opsStyles.metaKey}>계정</span>
              <span className={cn(opsStyles.metaValue, opsStyles.railMono, 'tabular-nums')}>
                {meta.aws_account_id}
              </span>
              {/* 리전은 계정의 속성이라 제 행 대신 계정 옆 태그로 (오너 08-20).
                  읽기 전용이라 흰 면이 아니라 gray-200 — 흰 면은 수정 가능한 값의
                  것으로 남는다. */}
              <span className={opsStyles.metaTagQuiet}>{isChina ? 'China' : 'Global'}</span>
            </div>
            {tagRow('설치모드', grantTfExecution ? '자동' : '수동', onOpenMode, '설치모드 변경')}
          </>
        )}
        {tagRow('실데이터', rawDataLabel, onOpenRawData, '실데이터 여부 변경', '실데이터 여부')}
        {isAws && roleRow('scan')}
        {isAws && grantTfExecution && roleRow('execution')}
        {/* GCP·Azure scan/terraform 주체 — AWS role 행과 같은 문법의 read-only 행.
            수정은 AWS 만 계약이 있다 (scan-role/terraform-execution-role upsert). */}
        {detail.cloud_provider === 'GCP' && (
          <>
            {infoRow('Scan SA', meta.gcp_scan_service_account)}
            {infoRow('TF SA', meta.gcp_terraform_service_account)}
          </>
        )}
        {detail.cloud_provider === 'AZURE' && infoRow('Scan App', meta.azure_scan_app_id)}
      </div>
    </>
  );
}
