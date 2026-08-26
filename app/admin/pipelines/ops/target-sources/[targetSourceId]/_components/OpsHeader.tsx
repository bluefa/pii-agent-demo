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
  onOpenMode: () => void;
  onOpenEdit: (kind: RoleKind) => void;
  onOpenRawData: () => void;
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
  onOpenMode,
  onOpenEdit,
  onOpenRawData,
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

  /** kv 셀 — 라벨이 값 위에 선다. `wide` 는 긴 주체(ARN·SA·App ID)가 먹는 2열. */
  const cell = (label: string, value: ReactNode, wide = false): ReactElement => (
    <div key={label} className={cn(opsStyles.fmCell, wide && opsStyles.fmCellWide)}>
      <span className={opsStyles.fmKey}>{label}</span>
      <span className={opsStyles.fmValue}>{value}</span>
    </div>
  );

  /** 값은 강조 태그로, 동작은 옆의 수정 링크로 (오너 08-20 넷째 조정) — 태그가 클릭
      대상 행세를 하지 않으니 밑줄도 hover 채움도 없다. */
  const tagCell = (
    label: string,
    tag: string,
    onEdit: () => void,
    editTitle: string,
    tagTitle?: string,
  ): ReactElement =>
    cell(
      label,
      <>
        <span className={opsStyles.metaTag} title={tagTitle}>
          {tag}
        </span>
        <button type="button" className={opsStyles.fmLink} onClick={onEdit} title={editTitle}>
          수정
        </button>
      </>,
    );

  /**
   * 파티션(China · Global)은 제 칸을 갖지 않고 **계정 값 옆에** 선다 (오너 08-26
   * "리전은 없애. 그리고 계정 옆에 Global 을 적어"). 리전은 계정의 속성이지 계정과
   * 나란한 사실이 아니었고, 한 칸을 차지하면 4열에서 진짜 사실 하나를 밀어낸다.
   * 계정 자리는 프로바이더마다 다르다 — AWS 계정 · GCP 프로젝트 · Azure 구독.
   * 읽기 전용이라 흰 면이 아니라 gray-200 이다: 흰 면은 수정 가능한 값의 것으로 남는다.
   */
  const scopeTag = (
    <span className={cn(opsStyles.metaTagQuiet, 'flex-none')}>{isChina ? 'China' : 'Global'}</span>
  );

  /** 읽기 전용 mono 값 — 전문은 「상세 정보」가 복사와 함께 진다. */
  const monoCell = (
    label: string,
    value: string | null | undefined,
    wide = false,
    after?: ReactNode,
  ): ReactElement =>
    cell(
      label,
      <>
        {value ? (
          <span className={cn(opsStyles.fmValueText, opsStyles.fmMono)} title={value}>
            {value}
          </span>
        ) : (
          <span className={opsStyles.fmNone}>미등록</span>
        )}
        {after}
      </>,
      wide,
    );

  /** 표시값은 detail 과 같이 온다 (v5 metadata 의 등록값) — 저장 직후 한 칸만 saved 가 덮는다. */
  const roleCell = (kind: RoleKind): ReactElement => {
    const arn =
      savedRoleArns[kind]
      ?? (kind === 'scan' ? meta.aws_scan_role_arn : meta.aws_terraform_execution_role_arn);
    return cell(
      ROLE_META[kind].short,
      arn ? (
        <>
          {/* ARN 은 값이지 동작이 아니다 — 링크로 그리지 않고, 동작(수정)은 옆 버튼이
              맡는다. prefix 가 대상 계정과 일치할 때만 role 이름으로 줄고, 불일치
              (교차 계정·파티션)는 그 prefix 가 어긋남의 유일한 증거라 전체를 남긴다
              (awsRoleArnDisplay). 전문은 「상세 정보」에 복사와 함께 있다. */}
          <span className={cn(opsStyles.fmValueText, opsStyles.fmMono)} title={arn}>
            {awsRoleArnDisplay(arn, meta.aws_account_id ?? '', isChina)}
          </span>
          <button type="button" className={opsStyles.fmLink} onClick={() => onOpenEdit(kind)}>
            수정
          </button>
        </>
      ) : (
        <>
          <span className={opsStyles.fmNone}>미등록</span>
          <button type="button" className={opsStyles.fmLink} onClick={() => onOpenEdit(kind)}>
            등록하기
          </button>
        </>
      ),
      true,
    );
  };

  return (
    <>
      {/* 경로 한 줄 — 세 마디, 굵은 것 하나 (오너 2026-08-26 2차: "너무 어지럽다").
          문법은 `opsStyles.path*` 의 독블록에 적혀 있다. 요지: 마디는 값만 말하고, 종류는
          마지막 마디가 한 번만 말하며, 칠한 태그는 없다. */}
      <div className={opsStyles.pathLine}>
        <h1 className={opsStyles.path}>
          {/* 마디마다 목적지가 다르다: 목록 → 이 서비스 → 이 대상. 예전에는 「서비스
              운영」만 링크이고 그 옆 코드 태그는 값이라, 두 마디가 사실상 한 곳을
              가리켰다. 서비스가 없으면 갈 곳도 없으므로 두 마디가 통째로 빠진다. */}
          {detail.service_code && (
            <>
              <Link href={passRoutes.pipelines.ops.services} className={opsStyles.pathLink}>
                서비스 운영
              </Link>
              <span className={opsStyles.pathSep} aria-hidden>
                /
              </span>
              {/* 코드만 적는다 — 라벨 없이도 자리가 종류를 말한다. 처음 온 사람을 위한
                  설명은 title 이 지고, 서비스 이름은 「상세 정보」의 서비스 그룹에 있다. */}
              <Link
                href={passRoutes.pipelines.ops.service(detail.service_code)}
                className={opsStyles.pathLinkId}
                title={`서비스 코드 ${detail.service_code} — 이 서비스의 운영 화면`}
              >
                {detail.service_code}
              </Link>
              <span className={opsStyles.pathSep} aria-hidden>
                /
              </span>
            </>
          )}
          {/* 서 있는 곳. 종류를 여기서 한 번만 말하므로 「Target Source 운영」 마디는
              사라졌다 — 링크도 아니었고, 바로 뒤 태그가 같은 낱말을 반복하고 있었다. */}
          <span className={opsStyles.pathHere} aria-current="page">
            <span className={opsStyles.pathHereKind}>Target Source</span>
            <span className={opsStyles.pathHereId}>#{targetSourceId}</span>
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

        {/* 항상 보이는 스트립 — 계정/프로젝트 · 리전 · 설정, 그리고 **권한 주체**.
            Role 은 접힘 밖에 산다 (오너 지시): 이 화면에서 운영자가 가장 자주 대조하는
            값이고, 접어 두면 프로바이더마다 다른 깊이에 숨는다. */}
        <div className={opsStyles.fmGrid}>
          {isAws && monoCell('계정', meta.aws_account_id, false, scopeTag)}
          {provider === 'GCP' && monoCell('프로젝트', meta.gcp_project_id, false, scopeTag)}
          {/* Azure 는 계정 자리가 구독이고, 테넌트가 그 옆에 선다 (오너 2026-08-26).
              Q3 에서는 UUID 두 개가 스코프 줄을 468px 쓴다고 접힘에 두자고 했는데,
              4열 그리드는 값 폭이 아니라 셀 수로 서는 배치라 그 근거가 없다 — 둘이
              나란히 서면 한 행이 정확히 4칸으로 찬다. */}
          {provider === 'Azure' && monoCell('구독', meta.subscription_id, false, scopeTag)}
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
          {isAws && tagCell('설치모드', grantTfExecution ? '자동' : '수동', onOpenMode, '설치모드 변경')}
          {tagCell('실데이터', rawDataLabel, onOpenRawData, '실데이터 여부 변경', '실데이터 여부')}
          {isAws && roleCell('scan')}
          {isAws && grantTfExecution && roleCell('execution')}
          {provider === 'GCP' && (
            <>
              {monoCell('Scan Service Account', meta.gcp_scan_service_account, true)}
              {monoCell('Terraform Service Account', meta.gcp_terraform_service_account, true)}
            </>
          )}
          {provider === 'Azure' && monoCell('Scan App', meta.azure_scan_app_id, true)}
          {/* 관련 페이지 — 이 대상을 두고 갈 수 있는 다른 화면들 (오너 2026-08-26). Jira 는
              접힘 안에만 있었는데, 논의가 어디서 벌어지는지는 헤더가 답해야 하는 질문이다.
              사실 셀들 뒤에 마지막으로 선다: 프로바이더마다 앞의 셀 수가 달라도 이 셀의
              자리는 늘 같은 곳(마지막)이다. */}
          {cell(
            '관련 페이지',
            <span className="flex items-center gap-3">
              {/* 티켓은 detail 과 따로 도착한다 — 도착 전에 자리를 비우면 셀이 한 번
                  흔들리므로, 그 사이는 같은 폭의 자리만 잡아 둔다. 열 주소가 없거나 http(s)
                  가 아니면 링크가 아니라 **글자**로 선다 (`docs/api/jira-tickets.md`, 다른 두
                  렌더 자리와 같은 규칙) — 주소를 조립하지도, 티켓 번호를 감추지도 않는다. */}
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
                <span className={opsStyles.fmValueText} title="Jira 열 주소 없음 — 티켓 번호만 확인된다">
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
            </span>,
            true,
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
