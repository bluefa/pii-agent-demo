'use client';

/**
 * Meta rail (design-benchmark `ops-detail-ia-redesign.md`, R1 + R1′ V-b) — the
 * five natures the old header flattened into one text stack, regrouped by what
 * they are: 서비스 (name·code·Jira·ops screen), 클라우드 · 설정 (account·region·
 * install mode·실데이터), 검증값 (role ARNs / service accounts). The rail sits on
 * every tab in the same place, so a value is findable without leaving the tab.
 *
 * Surface rule (R1′): the rail is NOT a card. It stands bare on the canvas with
 * hairline group dividers; the white face is reserved for interactive values
 * (설치모드·실데이터 chips, the ARN edit action) — 흰 섬 = 터치 대상.
 */
import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';
import { cn } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { awsRoleArnDisplay } from '@/lib/constants/aws-role';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import type { TargetJiraTicket } from '@/app/lib/api/ops';
import { ROLE_META, type RoleKind } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/roleMeta';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

export interface OpsMetaRailProps {
  detail: RawTargetSourceDetail;
  isAws: boolean;
  /** 이 화면에서 방금 저장한 ARN만 — 그 외에는 detail.metadata 가 표시의 유일한 출처. */
  savedRoleArns: Partial<Record<RoleKind, string>>;
  grantTfExecution: boolean;
  jiraTicket: TargetJiraTicket | null;
  /** false = 아직 조회 중 — null 을 "티켓 없음" 으로 단정하지 않는다. */
  ticketLoaded: boolean;
  /** 실데이터 여부. `undefined` = 응답에 값이 없다 — "미포함"이 아니라 "미확인". */
  supportRawData: boolean | undefined;
  onOpenMode: () => void;
  onOpenEdit: (kind: RoleKind) => void;
  onOpenRawData: () => void;
}

function Row({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className={opsStyles.railRow}>
      <span className={opsStyles.railKey}>{label}</span>
      {children}
    </div>
  );
}

export function OpsMetaRail({
  detail,
  isAws,
  savedRoleArns,
  grantTfExecution,
  jiraTicket,
  ticketLoaded,
  supportRawData,
  onOpenMode,
  onOpenEdit,
  onOpenRawData,
}: OpsMetaRailProps): ReactElement {
  const meta = detail.metadata ?? {};
  const accountId = meta.aws_account_id ?? '';
  const isChina = meta.is_china_region === true;
  // 세 상태를 항상 그린다: 값이 없는 것을 "미포함"으로 적으면 화면이 읽지도 못한
  // 값을 단정하게 되고, 여기는 그 값을 바꾸는 자리라 무엇을 바꾸는지부터 보인다.
  const rawDataLabel =
    supportRawData === true ? '포함' : supportRawData === false ? '미포함' : '미확인';

  /** 흰 면 + 획 칩 — the rail's only white islands; the underline is the affordance. */
  const chip = (label: string, onClick: () => void, title: string): ReactElement => (
    <button
      type="button"
      className={cn(opsStyles.rawDataTag, opsStyles.rawDataToggle)}
      onClick={onClick}
      title={title}
    >
      <span className={opsStyles.rawDataToggleValue}>{label}</span>
    </button>
  );

  /** 표시값은 detail 과 같이 온다 (v5 metadata 의 등록값) — 저장 직후 한 칸만 saved 가 덮는다. */
  const roleRow = (kind: RoleKind): ReactElement => {
    const arn =
      savedRoleArns[kind]
      ?? (kind === 'scan' ? meta.aws_scan_role_arn : meta.aws_terraform_execution_role_arn);
    return (
      <Row label={ROLE_META[kind].short}>
        {arn ? (
          // ARN 은 값이자 트리거다 — prefix 가 대상 계정과 일치할 때만 role 이름으로
          // 줄고, 불일치(교차 계정·파티션)는 그 prefix 가 어긋남의 유일한 증거라
          // 전체를 남긴다 (awsRoleArnDisplay). 전체값은 항상 title 에 있다.
          <button type="button" className={opsStyles.railAction} onClick={() => onOpenEdit(kind)}>
            <span className={cn(opsStyles.cellActionValue, opsStyles.railMono)} title={arn}>
              {awsRoleArnDisplay(arn, accountId, isChina)}
            </span>
            <span className={opsStyles.railActionHint}>수정</span>
          </button>
        ) : (
          <span className="flex items-baseline gap-2">
            <span className={opsStyles.railNone}>미등록</span>
            <button type="button" className={opsStyles.railLink} onClick={() => onOpenEdit(kind)}>
              등록
            </button>
          </span>
        )}
      </Row>
    );
  };

  /** Read-only 주체 행 (GCP SA·Azure App) — 등록/수정 계약이 없어 표시만 한다. */
  const infoRow = (label: string, value: string | null | undefined): ReactElement => (
    <Row label={label}>
      {value ? (
        <span className={cn(opsStyles.railValue, opsStyles.railMono)} title={value}>
          {value}
        </span>
      ) : (
        <span className={opsStyles.railNone}>미등록</span>
      )}
    </Row>
  );

  const hasVerification = isAws || detail.cloud_provider === 'GCP' || detail.cloud_provider === 'AZURE';

  return (
    <aside className={opsStyles.rail} aria-label="대상 속성">
      <section className={opsStyles.railGroup}>
        <h2 className={opsStyles.railLabel}>서비스</h2>
        <Row label="이름">
          <span className={opsStyles.railValue} title={detail.service_name ?? undefined}>
            {detail.service_name ?? '-'}
          </span>
        </Row>
        {detail.service_code && (
          <Row label="코드">
            <span className={cn(opsStyles.railValue, opsStyles.railMono)}>{detail.service_code}</span>
          </Row>
        )}
        {/* 티켓은 detail 과 따로 도착한다 — 도착 전에 "없음"을 그리면 곧바로 티켓으로
            뒤집히므로, 그 사이는 자리만 비워 둔다. 열 주소가 없으면 키는 값일 뿐이라
            링크로 그리지 않는다 (URL 조립 금지). */}
        <Row label="Jira">
          {!ticketLoaded ? (
            <span className={cn(opsStyles.skeletonBar, 'h-4 w-[84px]')} aria-hidden />
          ) : !jiraTicket ? (
            <span className={opsStyles.railNone}>없음</span>
          ) : jiraTicket.browseUrl ? (
            <a
              href={jiraTicket.browseUrl}
              target="_blank"
              rel="noreferrer"
              className={opsStyles.railLink}
              title="협업 채널 — Jira에서 논의하기"
            >
              {jiraTicket.issueKey} ↗
            </a>
          ) : (
            <span className={opsStyles.railValue}>{jiraTicket.issueKey}</span>
          )}
        </Row>
        {/* 서비스가 없으면 갈 운영 화면도 없다 — 없는 목적지는 말하지 않고 빠진다. */}
        {detail.service_code && (
          <Row label="운영">
            <Link
              href={passRoutes.pipelines.ops.service(detail.service_code)}
              className={opsStyles.railLink}
              title={`서비스 ${detail.service_code} 운영 — 티켓 연결·해제`}
            >
              서비스 관리 ↗
            </Link>
          </Row>
        )}
      </section>

      <section className={opsStyles.railGroup}>
        <h2 className={opsStyles.railLabel}>클라우드 · 설정</h2>
        {isAws && meta.aws_account_id && (
          <>
            <Row label="계정">
              <span className={cn(opsStyles.railValue, opsStyles.railMono, 'tabular-nums')}>
                {meta.aws_account_id}
              </span>
            </Row>
            <Row label="리전">
              <span className={opsStyles.railValue}>{isChina ? 'China' : 'Global'}</span>
            </Row>
            <Row label="설치모드">
              {chip(grantTfExecution ? '자동' : '수동', onOpenMode, '설치모드 변경')}
            </Row>
          </>
        )}
        <Row label="실데이터">{chip(rawDataLabel, onOpenRawData, '실데이터 여부 변경')}</Row>
      </section>

      {hasVerification && (
        <section className={opsStyles.railGroup}>
          <h2 className={opsStyles.railLabel}>검증값</h2>
          {isAws && (
            <>
              {roleRow('scan')}
              {grantTfExecution && roleRow('execution')}
            </>
          )}
          {/* GCP·Azure scan/terraform 주체 — AWS role 행과 같은 문법의 read-only 행.
              수정은 AWS 만 계약이 있다 (scan-role/terraform-execution-role upsert). */}
          {detail.cloud_provider === 'GCP' && (
            <>
              {infoRow('Scan SA', meta.gcp_scan_service_account)}
              {infoRow('TF SA', meta.gcp_terraform_service_account)}
            </>
          )}
          {detail.cloud_provider === 'AZURE' && infoRow('Scan App', meta.azure_scan_app_id)}
        </section>
      )}
    </aside>
  );
}
