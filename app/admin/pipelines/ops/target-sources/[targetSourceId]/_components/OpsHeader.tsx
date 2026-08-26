'use client';

/**
 * Ops masthead (design-benchmark `ops-target-frontmeta.md`, 시안 C) — the target's
 * whole identity as ONE FrontMeta on the gray-100 wash, in the grammar the
 * service-side install screen uses (`projectHeaderStyles.blockHead`):
 *
 *   1  path         서비스 운영 / [서비스 코드 CPN] / Target Source 운영 / [Target Source #1642],
 *                   then the step pill and the first-install stamp
 *   2  연동 대상     a named block: [mark] name … 「상세 정보 ⌄」, closed by one hairline
 *   3  kv 4열       the facts, label above value — cells change per provider, the
 *                   column rule does not; 관련 페이지 (Jira · the service-side screen)
 *                   closes the grid as its last cell
 *
 * Two things moved here in this round. The 236px meta rail is gone: the service
 * axis it owned (이름·코드·Jira·운영) and the 설명 now live behind the disclosure
 * (`OpsDetailFold`), and its width goes back to the content column on all seven
 * tabs. And GCP's service accounts came off the bottom of that rail into the
 * grid — "Role 은 바로 노출" (오너 지시) was already broken for GCP, where the
 * Terraform SA sat below the fold of a 683px viewport.
 *
 * Every strip value truncates now, which reverses the rail's old "주소는 접지
 * 않는다" rule on purpose: that rule existed because the rail was the ONLY place
 * an address appeared. 「상세 정보」 prints every identifier in full with copy, so
 * the premise is gone and the strip is free to keep one fixed row height.
 */
import Link from 'next/link';
import { useId, useState, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { normalizeCloudProvider } from '@/lib/types';
import { awsRoleArnDisplay } from '@/lib/constants/aws-role';
import { safeBrowseUrl } from '@/lib/jira-ticket';
import { ProviderGlyph } from '@/app/components/ui/CloudProviderIcon';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import type { TargetJiraTicket } from '@/app/lib/api/ops';
import type { ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';
import { StepPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/StepPill';
import { CompletedStamp } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/CompletedStamp';
import { OpsDetailFold } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsDetailFold';
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
  jiraTicket: TargetJiraTicket | null;
  /** false = 아직 조회 중 — null 을 "티켓 없음" 으로 단정하지 않는다. */
  ticketLoaded: boolean;
  /** 「계정 정보」 묶음 머리 — Scan/TF Role 을 한 폼에서 연다 (AWS 전용). */
  onOpenRoles: () => void;
  /** 「대상 설정」 묶음 머리 — 설치모드·실데이터를 한 폼에서 연다. */
  onOpenSettings: () => void;
  onEditDescription: () => void;
}

export function OpsHeader({
  targetSourceId,
  detail,
  processStatus,
  isAws,
  savedRoleArns,
  grantTfExecution,
  supportRawData,
  jiraTicket,
  ticketLoaded,
  onOpenRoles,
  onOpenSettings,
  onEditDescription,
}: OpsHeaderProps): ReactElement {
  const [open, setOpen] = useState(false);
  const labelId = useId();
  const foldId = useId();

  const meta = detail.metadata ?? {};
  const provider = normalizeCloudProvider(detail.cloud_provider);
  const jiraHref = jiraTicket ? safeBrowseUrl(jiraTicket.browseUrl) : null;
  const isChina = meta.is_china_region === true;
  // 세 상태를 항상 그린다: 값이 없는 것을 "미포함"으로 적으면 화면이 읽지도 못한
  // 값을 단정하게 되고, 여기는 그 값을 바꾸는 자리라 무엇을 바꾸는지부터 보인다.
  const rawDataLabel =
    supportRawData === true ? '포함' : supportRawData === false ? '미포함' : '미확인';

  /** kv 셀 — 라벨이 값 위에 선다. 묶음 안에서 세로로 쌓이므로 열 병합은 없다. */
  const cell = (label: string, value: ReactNode): ReactElement => (
    <div key={label} className={opsStyles.fmCell}>
      <span className={opsStyles.fmKey}>{label}</span>
      <span className={opsStyles.fmValue}>{value}</span>
    </div>
  );

  /** 값은 강조 태그로 (오너 08-20 넷째 조정) — 태그가 클릭 대상 행세를 하지 않으니
      밑줄도 hover 채움도 없다. 동작은 이제 값 옆이 아니라 **묶음 머리**에 산다. */
  const tagCell = (label: string, tag: string, tagTitle?: string): ReactElement =>
    cell(
      label,
      <span className={opsStyles.metaTag} title={tagTitle}>
        {tag}
      </span>,
    );

  /** 읽기 전용 mono 값 — 전문은 「상세 정보」가 복사와 함께 진다. */
  const monoCell = (label: string, value: string | null | undefined): ReactElement =>
    cell(
      label,
      value ? (
        <span className={cn(opsStyles.fmValueText, opsStyles.fmMono)} title={value}>
          {value}
        </span>
      ) : (
        <span className={opsStyles.fmNone}>미등록</span>
      ),
    );

  /** 표시값은 detail 과 같이 온다 (v5 metadata 의 등록값) — 저장 직후 한 칸만 saved 가 덮는다. */
  const roleCell = (kind: RoleKind): ReactElement => {
    const arn =
      savedRoleArns[kind]
      ?? (kind === 'scan' ? meta.aws_scan_role_arn : meta.aws_terraform_execution_role_arn);
    return cell(
      ROLE_META[kind].short,
      arn ? (
        // ARN 은 값이지 동작이 아니다 — prefix 가 대상 계정과 일치할 때만 role 이름으로
        // 줄고, 불일치(교차 계정·파티션)는 그 prefix 가 어긋남의 유일한 증거라 전체를
        // 남긴다 (awsRoleArnDisplay). 전문은 「상세 정보」에 복사와 함께 있다.
        <span className={cn(opsStyles.fmValueText, opsStyles.fmMono)} title={arn}>
          {awsRoleArnDisplay(arn, meta.aws_account_id ?? '', isChina)}
        </span>
      ) : (
        <span className={opsStyles.fmNone}>미등록</span>
      ),
    );
  };

  /** 묶음 — 이름 + (있으면) 그 묶음의 편집 진입 하나, 그 아래로 셀이 쌓인다. */
  const band = (
    label: string,
    cells: ReactNode,
    action?: { label: string; title: string; onClick: () => void },
  ): ReactElement => (
    <section className={opsStyles.fmBand} aria-label={label}>
      <div className={opsStyles.fmBandHead}>
        <h3 className={opsStyles.fmFoldLabel}>{label}</h3>
        {action && (
          <button
            type="button"
            className={opsStyles.fmLink}
            onClick={action.onClick}
            title={action.title}
          >
            {action.label}
          </button>
        )}
      </div>
      {cells}
    </section>
  );

  return (
    <>
      {/* 경로 한 줄 (오너 2026-08-26) — Linear FrontMeta 문법. 「화면 이름 · 그 화면의
          식별자」 짝이 두 벌 선다: 지나온 서비스 운영(파란 낱말 + 코드 태그)과 서 있는
          Target Source 운영(짙은 낱말 + 번호 태그). 값은 늘 대조 가능한 식별자다 — 서비스
          **이름**은 여기서 빠져 「상세 정보」의 서비스 그룹으로 갔다(이름은 라벨이지 경로가
          아니다). 파랑은 이동하는 낱말에만 든다. */}
      <div className={opsStyles.pathLine}>
        <h1 className={opsStyles.path}>
          {/* 서비스가 없으면 갈 운영 화면도 없다 — 없는 목적지는 말하지 않고 빠진다. */}
          {detail.service_code && (
            <>
              <Link
                href={passRoutes.pipelines.ops.service(detail.service_code)}
                className={opsStyles.pathLink}
                title={`서비스 ${detail.service_code} 운영`}
              >
                서비스 운영
              </Link>
              <span className={opsStyles.pathSep}>/</span>
              <span className={opsStyles.pathChip}>
                <span className={opsStyles.pathChipLabel}>서비스 코드</span>
                <span className={opsStyles.pathChipValue}>{detail.service_code}</span>
              </span>
              <span className={opsStyles.pathSep}>/</span>
            </>
          )}
          <span className={opsStyles.pathRoot}>Target Source 운영</span>
          <span className={opsStyles.pathSep}>/</span>
          <span className={opsStyles.pathChip}>
            <span className={opsStyles.pathChipLabel}>Target Source</span>
            <span className={opsStyles.pathChipValue}>#{targetSourceId}</span>
          </span>
        </h1>
        {processStatus && <StepPill status={processStatus} />}
        {/* 도장과 알약은 다른 축이다: 알약은 "지금 어디", 도장은 "최초로 마친 적
            있다 · 언제". 초기화된 대상은 둘이 같이 보이는 것이 말해야 하는 사실이다. */}
        <CompletedStamp firstInstalledAt={detail.pii_agent_first_installed_at} size="md" />
      </div>

      <section aria-labelledby={labelId} className={opsStyles.fmGroup}>
        <div className={opsStyles.fmHead}>
          <span className={opsStyles.fmName}>
            {/* 마크는 이름을 대신하지 않는다 — 블록 이름이 읽히는 문자열이라
                글리프는 장식으로 남는다. */}
            <span aria-hidden className="flex">
              <ProviderGlyph
                provider={provider}
                isSdu={meta.is_sdu_type === true}
                className={opsStyles.fmGlyph}
              />
            </span>
            <span id={labelId} className={opsStyles.fmLabel}>
              연동 대상
            </span>
          </span>
          {/* 큐는 자기가 여는 블록과 같은 줄에 선다 (오너 판단 Q2) — 그래야 무엇이
              열리는지 말한다. 파랑은 이 팔레트에서 "누를 수 있다"의 한 가지 색. */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={open ? foldId : undefined}
            className={opsStyles.fmCue}
          >
            상세 정보
            <Icon
              name="chev-d"
              size="sm"
              className={cn(opsStyles.fmCueIcon, open && opsStyles.fmCueIconOpen)}
            />
          </button>
        </div>

        {/* 항상 보이는 스트립 — 세 묶음이다 (design-benchmark `ops-header-groups.md`,
            시안 C). 「계정 정보」는 그 클라우드에서 **우리가 누구인가**(계정/프로젝트/구독
            + 스캔·실행 주체), 「대상 설정」은 **이 대상을 어떻게 다루는가**(리전·설치모드·
            실데이터), 「관련 페이지」는 **여기서 어디로 나가는가**. Role 은 접힘 밖에 산다
            (오너 지시): 운영자가 가장 자주 대조하는 값이고, 접어 두면 프로바이더마다 다른
            깊이에 숨는다.

            편집 진입은 값 옆이 아니라 **묶음 머리**에 하나씩 선다 — 넷이던 「수정」이 둘이
            되고, 둘은 서로 다른 낱말이라 문맥 없이도 갈린다 (오너 2026-08-26 "수정 가능한
            내역들도 너무 많음"). Cloudscape details-page 가 "리소스 전체에 영향을 주는
            액션은 헤더 버튼", GCP Cloud SQL 이 "절마다 Edit …" 로 세운 자리와 같다. */}
        <div className={opsStyles.fmBands}>
          {band(
            '계정 정보',
            <>
              {isAws && monoCell('계정', meta.aws_account_id)}
              {provider === 'GCP' && monoCell('프로젝트', meta.gcp_project_id)}
              {/* Azure 는 계정 자리가 구독이고, 테넌트가 그 아래 선다 (오너 2026-08-26). */}
              {provider === 'Azure' && monoCell('구독', meta.subscription_id)}
              {provider === 'Azure' && monoCell('테넌트', meta.tenant_id)}
              {/* IDC 는 계정이 없는 게 정상이다 — 빈 칸을 두는 대신 그 대상이 무엇인지
                  말한다 (ServiceDetailView glossOf 의 어휘 그대로). */}
              {provider === 'IDC'
                && cell(
                  '환경',
                  <>
                    사내망
                    <span className={opsStyles.metaTagQuiet}>IDC</span>
                  </>,
                )}
              {isAws && roleCell('scan')}
              {isAws && grantTfExecution && roleCell('execution')}
              {provider === 'GCP' && (
                <>
                  {monoCell('Scan Service Account', meta.gcp_scan_service_account)}
                  {monoCell('Terraform Service Account', meta.gcp_terraform_service_account)}
                </>
              )}
              {provider === 'Azure' && monoCell('Scan App', meta.azure_scan_app_id)}
            </>,
            // 고칠 수 있는 주체가 있는 프로바이더는 AWS 뿐이다 — 나머지는 머리에 동작을
            // 두지 않는다 (누를 것이 없는 자리에 낱말만 남기지 않는다).
            isAws
              ? {
                  label: 'Role 수정',
                  title: grantTfExecution
                    ? 'Scan Role · Terraform Execution Role 등록/수정'
                    : 'Scan Role 등록/수정',
                  onClick: onOpenRoles,
                }
              : undefined,
          )}

          {band(
            '대상 설정',
            <>
              {/* 리전은 읽기 전용 배치값이라 흰 면이 아니라 gray-200 이다 — 흰 면은 이
                  화면에서 "바꿀 수 있는 값"의 것으로 남는다. */}
              {provider !== 'IDC'
                && cell(
                  '리전',
                  <span className={opsStyles.metaTagQuiet}>{isChina ? 'China' : 'Global'}</span>,
                )}
              {isAws && tagCell('설치모드', grantTfExecution ? '자동' : '수동')}
              {tagCell('실데이터', rawDataLabel, '실데이터 여부')}
            </>,
            {
              label: '설정 수정',
              title: isAws ? '설치모드 · 실데이터 여부 변경' : '실데이터 여부 변경',
              onClick: onOpenSettings,
            },
          )}

          {/* 이동은 사실이 아니다 — 라벨 위·값 아래 짝을 입히면 「관련 페이지 = Jira Ticket」
              처럼 읽힌다. 묶음 이름이 곧 라벨이고, 목적지는 그 아래로 쌓인다. */}
          {band(
            '관련 페이지',
            <>
              {/* 티켓은 detail 과 따로 도착한다 — 도착 전에 자리를 비우면 묶음이 한 번
                  흔들리므로, 그 사이는 같은 폭의 자리만 잡아 둔다. 열 주소가 없거나 http(s)
                  가 아니면 링크가 아니라 **글자**로 선다 (`docs/api/jira-tickets.md`). */}
              {!ticketLoaded ? (
                <span className={cn(opsStyles.skeletonWash, 'h-4 w-[68px]')} aria-hidden />
              ) : jiraHref ? (
                <a
                  href={jiraHref}
                  target="_blank"
                  rel="noreferrer"
                  className={opsStyles.relatedLink}
                  title={`Jira ${jiraTicket?.issueKey} — 협업 채널`}
                >
                  Jira Ticket <Icon name="arrow-ur" size="sm" />
                </a>
              ) : jiraTicket ? (
                <span
                  className={opsStyles.fmValueText}
                  title="Jira 열 주소 없음 — 티켓 번호만 확인된다"
                >
                  {jiraTicket.issueKey}
                </span>
              ) : null}
              {/* 같은 대상의 서비스측 화면 — 운영자가 "담당자한테는 지금 뭐가 보이나"를
                  묻는 자리가 여기뿐이다. */}
              <Link
                href={passRoutes.targetSource(targetSourceId)}
                className={opsStyles.relatedLink}
                title="PII Agent 설치 화면 — 서비스 담당자가 보는 진행 화면"
              >
                서비스 담당자가 보는 화면 <Icon name="arrow-ur" size="sm" />
              </Link>
            </>,
          )}
        </div>

        {open && (
          <OpsDetailFold
            id={foldId}
            detail={detail}
            grantTfExecution={grantTfExecution}
            savedRoleArns={savedRoleArns}
            onEditDescription={onEditDescription}
          />
        )}
      </section>
    </>
  );
}
