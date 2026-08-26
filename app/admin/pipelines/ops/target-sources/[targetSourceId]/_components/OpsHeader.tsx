'use client';

/**
 * Ops masthead (design-benchmark `ops-target-frontmeta.md`, 시안 C) — the target's
 * whole identity as ONE FrontMeta on the gray-100 wash, in the grammar the
 * service-side install screen uses (`projectHeaderStyles.blockHead`):
 *
 *   1  path         서비스 운영 / CPN / Target Source #1642 — where you came from,
 *                   and nothing else.
 *   2  연동 대상     a named block: [mark] name · step pill · first-install stamp …
 *                   관련 페이지 (Jira, the service-side screen) | 「상세 정보 ⌄」,
 *                   closed by one hairline. The pill and the stamp are the target's
 *                   state, so they belong to the block that names it rather than to
 *                   the path; the right end of the same row is where everything you
 *                   can press lives, split by a rule between what leaves the page
 *                   and what opens here (owner, 08-26).
 *   3  kv 4열       the facts, label above value — cells change per provider, the
 *                   column rule does not
 *   4  관련 페이지   a second named block in the same grammar: the doors out of this
 *                   target (Jira, the service-side screen). Not facts to compare
 *                   and not a control on someone else's row — its own tier, named
 *                   (owner, 08-26).
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
import { JiraLogo } from '@/app/admin/pipelines/_components/brandMarks';
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
  const relatedId = useId();

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
  /**
   * Role 셀 — 「수정」 링크가 없다 (오너 08-26 "ScanRole 오른쪽에 수정은 없애 …
   * 해당 값에 밑줄을 그어야지. 밑줄은 파란색으로"). 값 옆에 서 있던 동사가 값 자신으로
   * 접혀 들어가면서 셀 하나가 한 칸으로 줄고, AWS 첫 행이 계정·Scan·TF·설치모드로
   * 정확히 찬다. 옛 주석의 "ARN 은 값이지 동작이 아니다 — 링크로 그리지 않는다" 는
   * 이 지시로 뒤집혔다: 값이 곧 동작이고, 신호는 색이 아니라 파란 밑줄이 진다.
   *
   * ARN 전문은 「상세 정보」가 복사와 함께 지므로 240px 안에서 잘려도 된다 — prefix 가
   * 대상 계정과 일치할 때만 role 이름으로 줄고, 불일치(교차 계정·파티션)는 그 prefix 가
   * 어긋남의 유일한 증거라 전체를 남긴다 (awsRoleArnDisplay).
   */
  const roleCell = (kind: RoleKind): ReactElement => {
    const arn =
      savedRoleArns[kind]
      ?? (kind === 'scan' ? meta.aws_scan_role_arn : meta.aws_terraform_execution_role_arn);
    const short = ROLE_META[kind].short;
    return cell(
      short,
      <button
        type="button"
        className={cn(opsStyles.fmValueEdit, 'flex min-w-0 items-center')}
        onClick={() => onOpenEdit(kind)}
        title={arn ? `${arn} — ${short} 수정` : `${short} 등록`}
      >
        {arn ? (
          <span className={cn(opsStyles.fmValueText, opsStyles.fmMono)}>
            {awsRoleArnDisplay(arn, meta.aws_account_id ?? '', isChina)}
          </span>
        ) : (
          <span className={opsStyles.fmNone}>미등록</span>
        )}
      </button>,
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
            {/* 알약과 도장은 「연동 대상」 옆에 선다 (오너 08-26) — 둘 다 이 블록이
                말하는 그 대상의 상태이지 경로의 일부가 아니다. 경로 줄은 이제 이동만
                말한다: 어디서 왔고(크럼) 어디로 더 갈 수 있나(관련 페이지). */}
            {processStatus && <StepPill status={processStatus} framed />}
            {/* 도장과 알약은 다른 축이다: 알약은 "지금 어디", 도장은 "최초로 마친 적
                있다 · 언제". 초기화된 대상은 둘이 같이 보이는 것이 말해야 하는 사실이다. */}
            <CompletedStamp firstInstalledAt={detail.pii_agent_first_installed_at} size="sm" />
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

        {/* 항상 보이는 스트립 — 계정/프로젝트 · 설정, 그리고 **권한 주체**.
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
          {/* Azure 도 주체가 계정 옆이다. 리전 칸이 사라진 뒤 「구독·테넌트·실데이터」는
              첫 행에 한 칸을 비워 두는데, 2열짜리 Scan App 이 그 자리로 올라오면
              첫 행이 정확히 찬다. GCP 는 반대다 — SA 둘이 2열씩이라 위로 올리면
              「프로젝트 + SA」로 3칸만 차고 다음 SA 가 못 들어온다. 그 자리는
              실데이터가 채운다. */}
          {provider === 'Azure' && monoCell('Scan App', meta.azure_scan_app_id, true)}
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
          {/* 주체는 계정 바로 옆에 선다 (오너 08-26) — 운영자가 콘솔과 대조하는 순서가
              「이 계정의 · 이 role」 이고, 설정 두 칸이 그 사이에 끼면 짝이 갈라진다.
              4열은 자동(계정·scan·execution·설치모드)과 수동(계정·scan·설치모드·실데이터)
              양쪽에서 첫 행이 정확히 찬다. */}
          {isAws && roleCell('scan')}
          {isAws && grantTfExecution && roleCell('execution')}
          {/* 설정 한 칸 (design-benchmark 시안 A, 오너 08-26) — 라벨 둘·흰 면 태그 둘·
              「수정」 둘이 라벨 하나와 밑줄 낱말 둘이 된다. 라벨이 줄었으니 값이 스스로를
              말한다. 이 칸이 그리드의 마지막 사실 뒤에 서면서 AWS 자동은 첫 행이 4칸으로
              정확히 찬다 — 실데이터 하나 때문에 서 있던 둘째 행이 사라진다. */}
          {cell(
            '설정',
            <span className={opsStyles.fmSettings}>
              {isAws && (
                <>
                  <button
                    type="button"
                    className={opsStyles.fmValueEdit}
                    onClick={onOpenMode}
                    title="설치모드 변경"
                  >
                    {grantTfExecution ? '자동 설치' : '수동 설치'}
                  </button>
                  <span className={opsStyles.fmSettingsSep} aria-hidden>
                    ·
                  </span>
                </>
              )}
              <button
                type="button"
                className={opsStyles.fmValueEdit}
                onClick={onOpenRawData}
                title="실데이터 여부 변경"
              >
                실데이터 {rawDataLabel}
              </button>
            </span>,
          )}
          {provider === 'GCP' && (
            <>
              {monoCell('Scan Service Account', meta.gcp_scan_service_account, true)}
              {monoCell('Terraform Service Account', meta.gcp_terraform_service_account, true)}
            </>
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

      {/* 관련 페이지 — 「연동 대상」과 같은 문법의 **한 단 아래 블록**이다 (오너 08-26
          "연동 대상 처럼 한 단을 밑에 추가하자고"). 사실 그리드에 섞여 있을 때는 대조하는
          값 행세를 했고, 머리 줄 오른쪽에 붙였을 때는 「상세 정보」와 같은 급이 됐다. 제
          이름을 가진 블록이 되면 둘 다 아니다: 이 대상을 두고 갈 수 있는 다른 화면들이
          한 묶음으로 서고, 이름이 그 묶음이 무엇인지 말한다. */}
      <section aria-labelledby={relatedId} className={opsStyles.fmGroup}>
        <div className={opsStyles.fmHead}>
          <span id={relatedId} className={opsStyles.fmLabel}>
            관련 페이지
          </span>
        </div>
        {/* GitHub 의 About 패널 문법 (오너 08-26 "Github About으로 관련 사이트도 구성",
            design-benchmark 레퍼런스 04) — 목적지마다 **아이콘이 앞에 서고 이름이 링크**다.
            화살표를 줄마다 반복하지 않는다: 아이콘이 이미 "무엇으로 가는지"를 말하고,
            About 패널도 링크 뒤에 표식을 붙이지 않는다. 새 창으로 여는 것(Jira)만 ↗ 를
            남긴다 — 그건 목적지가 아니라 **어디에 열리는지**를 말하는 표식이라 다른 축이다. */}
        <div className={opsStyles.fmLinkRow}>
          {/* 티켓은 detail 과 따로 도착한다 — 도착 전에 자리를 비우면 줄이 한 번 흔들리므로,
              그 사이는 같은 폭의 자리만 잡아 둔다. 열 주소가 없거나 http(s) 가 아니면 링크가
              아니라 **글자**로 선다 (`docs/api/jira-tickets.md`, 다른 두 렌더 자리와 같은
              규칙) — 주소를 조립하지도, 티켓 번호를 감추지도 않는다. */}
          {!ticketLoaded ? (
            <span className={cn(opsStyles.skeletonWash, 'h-4 w-[120px]')} aria-hidden />
          ) : (
            <span className={opsStyles.aboutRow}>
              <span className={opsStyles.aboutMark} aria-hidden>
                <JiraLogo size={14} />
              </span>
              {jiraHref ? (
                <a
                  href={jiraHref}
                  target="_blank"
                  rel="noreferrer"
                  className={opsStyles.aboutLink}
                  title={`Jira ${jiraTicket?.issueKey} — 협업 채널`}
                >
                  {jiraTicket?.issueKey} <Icon name="arrow-ur" size="sm" />
                </a>
              ) : jiraTicket ? (
                <span
                  className={opsStyles.aboutPlain}
                  title="Jira 열 주소 없음 — 티켓 번호만 확인된다"
                >
                  {jiraTicket.issueKey}
                </span>
              ) : (
                <span className={opsStyles.aboutPlain}>티켓 없음</span>
              )}
            </span>
          )}
          {/* 같은 대상의 서비스측 화면 — 운영자가 "담당자한테는 지금 뭐가 보이나"를
              묻는 자리가 여기뿐이다. */}
          <span className={opsStyles.aboutRow}>
            <span className={opsStyles.aboutMark} aria-hidden>
              <Icon name="install" size="sm" />
            </span>
            <Link
              href={passRoutes.targetSource(targetSourceId)}
              className={opsStyles.aboutLink}
              title="PII Agent 설치 화면 — 서비스 담당자가 보는 진행 화면"
            >
              서비스가 보는 화면
            </Link>
          </span>
        </div>
      </section>
    </>
  );
}
