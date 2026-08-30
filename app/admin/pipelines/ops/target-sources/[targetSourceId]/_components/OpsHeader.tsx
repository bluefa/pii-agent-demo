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
 *   2r 관련 페이지   the same named block, in the RIGHT column of the same row — a
 *                   GitHub About panel: the doors out of this target (Jira, the
 *                   service-side screen), stacked, mark then name. It is its own
 *                   named block and not a control on someone else's row, but it
 *                   costs no height: it takes the width the fixed kv grid leaves
 *                   over, instead of pushing the tab band down (owner, 08-26).
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
import { isSduTarget, normalizeCloudProvider } from '@/lib/types';
import { awsRoleArnDisplay } from '@/lib/constants/aws-role';
import { gcpServiceAccountDisplay } from '@/lib/constants/gcp-service-account';
import { safeBrowseUrl } from '@/lib/jira-ticket';
import { ProviderGlyph } from '@/app/components/ui/CloudProviderIcon';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { JiraLogo } from '@/app/admin/pipelines/_components/brandMarks';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import type { TargetJiraTicket } from '@/app/lib/api/ops';
import type { ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';
import { StepPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/StepPill';
import { CompletedStamp } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/CompletedStamp';
import { CopyButton } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/CopyButton';
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

/** 파티션(Global · China)을 갖는 프로바이더 — IDC 는 클라우드 파티션이 없다. */
const PARTITIONED = new Set(['AWS', 'GCP', 'Azure']);

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
  /**
   * SDU 는 정규화된 프로바이더를 **이긴다**. SDU 는 `CloudProvider` 가 아니라 데이터가
   * 어떻게 도착하는지의 이름이라(lib/types.ts), `normalizeCloudProvider` 가 SDU 대상을
   * 그 밑에 깔린 CSP(대개 AWS)로 접는다 — 그대로 두면 이 격자가 아무도 설치하지 않는
   * 계정의 ID·role 을 사실처럼 적는다. 판정은 손으로 옮겨 적지 않는다(lib/types.ts:56).
   */
  const isSdu = isSduTarget({
    is_sdu_type: meta.is_sdu_type,
    cloud_provider: detail.cloud_provider,
  });
  const jiraHref = jiraTicket ? safeBrowseUrl(jiraTicket.browseUrl) : null;
  const isChina = meta.is_china_region === true;
  // 세 상태를 항상 그린다: 값이 없는 것을 "미포함"으로 적으면 화면이 읽지도 못한
  // 값을 단정하게 되고, 여기는 그 값을 바꾸는 자리라 무엇을 바꾸는지부터 보인다.
  const rawDataLabel =
    supportRawData === true ? '포함' : supportRawData === false ? '미포함' : '미확인';

  /**
   * kv 셀 — 라벨이 값 위에 선다. `wide` 는 긴 주체(ARN·SA·App ID)가 먹는 2열이고,
   * 라벨 줄에 단서를 붙이던 `labelAfter` 는 사라졌다 — 그 단서(파티션 태그)가 블록 머리로
   * 올라가면서 이 자리에 아무도 넘기지 않는다.
   */
  const cell = (label: string, value: ReactNode, wide = false): ReactElement => (
    <div key={label} className={cn(opsStyles.fmCell, wide && opsStyles.fmCellWide)}>
      <span className={opsStyles.fmKeyRow}>
        <span className={opsStyles.fmKey}>{label}</span>
      </span>
      <span className={opsStyles.fmValue}>{value}</span>
    </div>
  );

  // SDU 는 3등분 격자를 고르지 않는다 — GCP 로 접힌 SDU 대상까지 그 배치로 가면
  // 서지 않을 셀 셋을 전제한 열 폭이 된다.
  const isGcp = !isSdu && provider === 'GCP';
  const scanSa = meta.gcp_scan_service_account;
  const terraformSa = meta.gcp_terraform_service_account;

  /**
   * 파티션 태그 — 「연동 대상」 머리 줄에서 단계 알약 **오른쪽**에 선다. 이 값은 계정 하나의
   * 속성이 아니라 이 대상이 어느 파티션에 있느냐라, 알약과 같이 대상 전체를 말하는 자리에
   * 선다.
   *
   * 중국일 때만 뜬다 (오너 2026-08-28 "Admin 페이지에서 중국으로 표기하라는거야. Global로
   * 표현되고 있던 부분이 있으면 이것도 그냥 없애. 따로 보여주지마"). Global 은 이제 표시가
   * 아니라 표시의 부재다 — 대다수 대상이 Global 이라, 모두가 다는 태그는 아무것도 가르지
   * 못하면서 머리 줄의 자리만 먹는다. IDC 는 애초에 파티션이 없어 태그도 없다.
   *
   * SDU 는 여기서만 `isSdu` 가 이기지 **않는다** — 밑에 깔린 CSP 가 `PARTITIONED` 안에
   * 있으므로 중국 SDU 대상은 「중국」을 그대로 단다. 계정은 우리 것이 아니어도 데이터가
   * 어느 권역에 사는지는 이 대상의 사실이다. */
  const partitionTag = PARTITIONED.has(provider) && isChina ? (
    <span className={cn(opsStyles.partitionTag, opsStyles.partitionChina)}>중국</span>
  ) : null;

  /** 읽기 전용 mono 값 — 전문은 「상세 정보」가 복사와 함께 진다. */
  const monoCell = (
    label: string,
    value: string | null | undefined,
    wide = false,
  ): ReactElement =>
    cell(
      label,
      value ? (
        <span className={cn(opsStyles.fmValueText, opsStyles.fmMono)} title={value}>
          {value}
        </span>
      ) : (
        <span className={opsStyles.fmNone}>미등록</span>
      ),
      wide,
    );

  /**
   * GCP kv 줄의 셀 — `monoCell` 과 같은 활자를 쓰고 복사 하나만 더 갖는다. 라벨 12/500 ·
   * 값 14/600 의 계층은 한때 이 셀만의 것이었는데(`fmKeyQuiet`/`fmValueLead`), 서비스
   * 계정이 이름만 남으면서 스트립 전체가 같은 규칙으로 올라갔다 — 그래서 두 토큰은
   * 사라지고 이 셀도 `fmKey`/`fmValue` 를 쓴다.
   *
   * `copyValue` 가 있으면 값 오른쪽에 복사가 선다 — 표시가 짧아진 자리(서비스 계정)에서만
   * 쓴다. 넘기는 것은 **표시형이 아니라 전문**이다.
   */
  const gcpCell = (
    label: string,
    value: string | null | undefined,
    copyValue?: string | null,
  ): ReactElement => (
    <div key={label} className={opsStyles.fmCell}>
      <span className={opsStyles.fmKeyRow}>
        <span className={opsStyles.fmKey}>{label}</span>
      </span>
      <span className={opsStyles.fmValue}>
        {value ? (
          <>
            <span className={cn(opsStyles.fmValueText, opsStyles.fmMono)} title={copyValue ?? value}>
              {value}
            </span>
            {copyValue && <CopyButton value={copyValue} label={`${label} 복사`} />}
          </>
        ) : (
          <span className={opsStyles.fmNone}>미등록</span>
        )}
      </span>
    </div>
  );

  /** 표시값은 detail 과 같이 온다 (v5 metadata 의 등록값) — 저장 직후 한 칸만 saved 가 덮는다. */
  /**
   * Role 셀 — 「수정」 링크가 없다 (오너 08-26 "ScanRole 오른쪽에 수정은 없애 …
   * 해당 값에 밑줄을 그어야지. 밑줄은 파란색으로"). 값 옆에 서 있던 동사가 값 자신으로
   * 접혀 들어가면서 셀 하나가 한 칸으로 줄고, AWS 첫 행이 계정·Scan·TF·설치모드로
   * 정확히 찬다. 옛 주석의 "ARN 은 값이지 동작이 아니다 — 링크로 그리지 않는다" 는
   * 이 지시로 뒤집혔다: 값이 곧 동작이고, 신호는 색이 아니라 파란 밑줄이 진다.
   *
   * 08-27: 값 오른쪽에 복사가 선다 (오너 "ScanRole도 그냥 gcp처럼 정리할래?"). GCP 주체
   * 칸과 같은 문법이다 — **값은 읽으라고 짧고, 남에게 넘어가는 것은 전문**이라 복사는
   * 표시형이 아니라 늘 ARN 전체를 싣는다. 복사는 수정 버튼 **바깥**에 형제로 선다: 안에
   * 넣으면 아이콘을 누른 손이 수정 모달까지 열어 한 자리에 두 동작이 겹친다. ARN 이
   * 없으면(「미등록」) 넘길 것도 없으므로 복사도 없다.
   *
   * 값은 **언제나 role 이름만** 적는다 (오너 08-27 "ㄴㄴ 정리하라고"). 교차 계정·파티션
   * 불일치일 때 prefix 를 남기던 규칙은 이 지시로 폐기됐다 — 그 규칙의 전제는 "prefix 가
   * 어긋남의 유일한 증거"였는데, 이제 전문이 복사 값·title·「상세 정보」 세 자리에 있어
   * 전제가 사라졌다. 줄이는 자리는 여전히 `awsRoleArnDisplay` 하나이고, GCP 주체도 같은
   * 결정을 받았으므로 두 프로바이더의 권한 주체 행이 한 문법으로 읽힌다.
   */
  const roleCell = (kind: RoleKind): ReactElement => {
    const arn =
      savedRoleArns[kind]
      ?? (kind === 'scan' ? meta.aws_scan_role_arn : meta.aws_terraform_execution_role_arn);
    const short = ROLE_META[kind].short;
    return cell(
      short,
      <>
        <button
          type="button"
          className={cn(opsStyles.fmValueEdit, 'flex min-w-0 items-center')}
          onClick={() => onOpenEdit(kind)}
          title={arn ? `${arn} — ${short} 수정` : `${short} 등록`}
        >
          {arn ? (
            <span className={cn(opsStyles.fmValueText, opsStyles.fmMono)}>
              {awsRoleArnDisplay(arn)}
            </span>
          ) : (
            <span className={opsStyles.fmNone}>미등록</span>
          )}
        </button>
        {arn && <CopyButton value={arn} label={`${short} 복사`} />}
      </>,
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
        {/* 도장은 경로 줄로 올라왔다 (오너 2026-08-27 "「최초 1회 연동 완료」 도장을
            「Target Source #1002」가 있는 경로 줄로 올려라"). 도장이 말하는 것은 이 줄이
            가리키는 그 대상의 **지난 사실**이라 식별자 옆에 선다. 단계 알약은 「연동 대상」
            옆에 남는다 — 알약은 "지금 어디", 도장은 "최초로 마친 적 있다". */}
        <CompletedStamp firstInstalledAt={detail.pii_agent_first_installed_at} size="xs" />
      </div>

      <div className={cn(opsStyles.fmGroup, opsStyles.fmSplit)}>
        <section aria-labelledby={labelId} className="min-w-0 flex-1">
          <div className={opsStyles.fmHead}>
            <span className={opsStyles.fmName}>
              {/* 마크는 이름을 대신하지 않는다 — 블록 이름이 읽히는 문자열이라
                  글리프는 장식으로 남는다. */}
              <span aria-hidden className="flex">
                {/* 플래그만 읽으면 `cloudProvider: 'SDU'` 로 오는 대상이 밑에 깔린 CSP
                    글리프를 단다 — 격자와 같은 판정을 쓴다. */}
                <ProviderGlyph
                  provider={provider}
                  isSdu={isSdu}
                  className={opsStyles.fmGlyph}
                />
              </span>
              <span id={labelId} className={opsStyles.fmLabel}>
                연동 대상
              </span>
              {/* 알약은 「연동 대상」 옆에 선다 (오너 08-26) — 지금 몇 단계인지는 이 블록이
                  이름 붙인 그 대상의 상태이지 경로의 일부가 아니다. */}
              {processStatus && <StepPill status={processStatus} framed />}
              {partitionTag}
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
          <div className={isGcp ? opsStyles.fmGridGcp : opsStyles.fmGrid}>
            {isAws && monoCell('계정', meta.aws_account_id)}
            {!isSdu && provider === 'GCP' && gcpCell('프로젝트', meta.gcp_project_id)}
            {/* Azure 는 계정 자리가 구독이고, 테넌트가 그 옆에 선다 (오너 2026-08-26).
                Q3 에서는 UUID 두 개가 스코프 줄을 468px 쓴다고 접힘에 두자고 했는데,
                4열 그리드는 값 폭이 아니라 셀 수로 서는 배치라 그 근거가 없다. */}
            {!isSdu && provider === 'Azure' && monoCell('구독(Subscription)', meta.subscription_id, true)}
            {!isSdu && provider === 'Azure' && monoCell('테넌트(Tenant)', meta.tenant_id, true)}
            {/* All three Azure identifiers take TWO columns (reverses the 2026-08-26 note
                above): the owner rejected the truncation on 2026-08-30 — they are 36-char
                UUIDs in mono 14px, so each of them ellipsed inside one 240px column and
                the strip showed no identifier in full. Azure is therefore two rows:
                구독·테넌트 fill the first, Scan App and 「설정」 the second — 「설정」 still
                stands on the same row as Scan App, which is the constraint the 08-26 note
                actually protected.
                GCP 는 이 격자를 아예 쓰지 않는다 — 3등분(`fmGridGcp`)에 따로 선다. */}
            {!isSdu && provider === 'Azure' && monoCell('Scan App', meta.azure_scan_app_id, true)}
            {/* IDC 는 계정이 없는 게 정상이다 — 빈 칸을 두는 대신 그 대상이 무엇인지
                말한다 (ServiceDetailView glossOf 의 어휘 그대로). */}
            {!isSdu
              && provider === 'IDC'
              && cell(
                '환경',
                <>
                  사내망
                  <span className={opsStyles.metaTagQuiet}>IDC</span>
                </>,
              )}
            {/* SDU 도 계정이 없는 게 정상이다 — 밑에 깔린 CSP 계정은 있지만 우리가 설치하는
                계정이 아니라, 여기 적으면 이 화면의 어느 동작도 건드리지 않는 값을 사실처럼
                말하게 된다 (`SduProjectPage` 가 담당자쪽 헤더에서 내린 것과 같은 판단, 결정
                #49). 그래서 IDC 와 같은 자리·같은 문법으로 **무엇인지**를 적는다 — 어휘는
                콘솔이 이미 SDU 를 부르는 말이다(ServiceDetailView glossOf: 「서비스 담당자가
                데이터를 직접 업로드」). 셀은 한 트랙이라 그중 동사만 싣는다. */}
            {isSdu
              && cell(
                '환경',
                <>
                  데이터 직접 업로드
                  <span className={opsStyles.metaTagQuiet}>SDU</span>
                </>,
              )}
            {/* 주체는 계정 바로 옆에 선다 (오너 08-26) — 운영자가 콘솔과 대조하는 순서가
                「이 계정의 · 이 role」 이고, 설정 두 칸이 그 사이에 끼면 짝이 갈라진다.
                4열은 자동(계정·scan·execution·설치모드)과 수동(계정·scan·설치모드·실데이터)
                양쪽에서 첫 행이 정확히 찬다. */}
            {isAws && roleCell('scan')}
            {/* Terraform Role 칸은 **모드와 상관없이 늘 선다** (오너 08-26 "수동 설치/자동설치에
                따라서 tf role이 보이고 안 보이고가 결정되니 조금 이상한듯"). 칸이 사라지면
                화면은 "이 대상엔 그런 게 없다"와 "아직 안 읽었다"를 구분해 주지 않고, 그
                자리를 뒤 칸이 밀고 들어와 두 모드의 열 순서가 어긋난다. 수동일 때는 빈
                칸이 아니라 **왜 비었는지**를 적는다 — 미등록이 아니라 필요 없는 것이다. */}
            {isAws
              && (grantTfExecution
                ? roleCell('execution')
                : cell(
                    ROLE_META.execution.short,
                    <span
                      className={opsStyles.fmNone}
                      title="수동 설치 — 담당자가 직접 실행하므로 Terraform 실행 role 을 등록하지 않는다"
                    >
                      역할 불필요
                    </span>,
                  ))}
            {/* 설정 한 칸 (design-benchmark 시안 A, 오너 08-26) — 라벨 둘·흰 면 태그 둘·
                「수정」 둘이 라벨 하나와 밑줄 낱말 둘이 된다. 라벨이 줄었으니 값이 스스로를
                말한다. 이 칸이 그리드의 마지막 사실 뒤에 서면서 AWS 자동은 첫 행이 4칸으로
                정확히 찬다 — 실데이터 하나 때문에 서 있던 둘째 행이 사라진다. */}
            {!isGcp
              && cell(
              '설정',
              <span className={opsStyles.fmSettings}>
                {isAws && (
                  <>
                    <button
                      type="button"
                      className={opsStyles.fmSettingEdit}
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
                  className={opsStyles.fmSettingEdit}
                  onClick={onOpenRawData}
                  title="실데이터 여부 변경"
                >
                  실데이터 {rawDataLabel}
                </button>
              </span>,
              )}
            {/* GCP 는 세 칸 한 줄이고, 그 셋이 레인을 **3등분**한다 (오너 2026-08-27
                "3등분으로 정보를 갖고 가게"). 세 칸은 전부 `gcpCell` 이라 라벨이 물러나고
                값이 앞에 선다 — 계층은 값 쪽이다.

                주체 둘은 **계정 이름만** 적는다 (오너 2026-08-27 "SA 이름만 남겨보자.
                그리고 오른쪽에 복사 버튼을 눌러서 tf sa를 전달할 수 있게. 복사는 fqdn 이
                복사되도록"). 짧은 이름은 **읽으라고** 있는 것이고, 다른 사람에게
                **전달되는 것은 전문**이라 복사는 늘 주소 전체를 싣는다 — 화면에서 줄어든
                꼬리를 손으로 다시 적게 하지 않는다. 전문은 title 로도 남는다.
                줄이는 규칙은 `gcpServiceAccountDisplay` 가 진다: 프로젝트가 어디든
                **언제나 이름만** 적는다 (오너 08-27 "ㄴㄴ 정리하라고") — 빌려 온 계정의
                꼬리를 증거로 남기던 규칙은 전문이 복사 값·title·「상세 정보」 세 자리에
                있으므로 전제가 사라졌다. AWS 역할 칸도 같은 결정을 받았다.
                라벨도 한국어다 (오너 2026-08-27) — 「상세 정보」의 식별자 목록은 Project ID
                와 짝이라 영문 그대로 둔다. */}
            {!isSdu && provider === 'GCP' && (
              <>
                {gcpCell('스캔 서비스 계정', scanSa && gcpServiceAccountDisplay(scanSa), scanSa)}
                {gcpCell(
                  '테라폼 서비스 계정',
                  terraformSa && gcpServiceAccountDisplay(terraformSa),
                  terraformSa,
                )}
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

        {/* 두 단을 가르는 획 하나 (오너 2026-08-27 "줄 하나만 그어보자") — 간격 혼자
            지고 있던 "왼쪽은 사실, 오른쪽은 나가는 문" 을 획이 한 번 더 말한다. */}
        <span aria-hidden className={opsStyles.fmSplitRule} />

        {/* 관련 페이지 — 「연동 대상」과 같은 문법의 블록이되, 같은 행의 **오른쪽 단**이다
            (오너 08-26 "헤더 오른쪽에서 Github About처럼"). 사실 그리드에 섞여 있을 때는
            대조하는 값 행세를 했고, 머리 줄 오른쪽에 붙였을 때는 「상세 정보」와 같은 급이
            됐고, 한 단 아래에 뒀을 때는 탭 줄을 밀어내렸다. 제 이름을 가진 오른쪽 단이 되면
            셋 다 아니다 — 이 대상을 두고 갈 수 있는 다른 화면들이 한 묶음으로 서고, kv
            그리드가 안 쓰고 남기던 폭에 서므로 마스트헤드가 한 줄도 높아지지 않는다. */}
        <section aria-labelledby={relatedId} className={opsStyles.aboutPanel}>
          <div className={opsStyles.fmHead}>
            <span id={relatedId} className={opsStyles.fmLabel}>
              관련 페이지
            </span>
          </div>
          {/* GitHub 의 About 패널 문법 (오너 08-26, design-benchmark 레퍼런스 04) —
              목적지마다 **아이콘이 앞에 서고 이름이 링크**이고, 목적지들은 세로로 쌓인다.
              ↗ 는 **이 화면을 떠난다**는 뜻이다 (오너 2026-08-27 "규칙바꿔"). 08-26 에는
              「새 창으로 여는 것만」이었는데, 그 규칙은 같은 표식에 두 가지를 싣고 있었다 —
              목적지가 바깥이라는 것과 창이 새로 열린다는 것. 앞의 것만 남긴다: 이 패널의 두
              줄이 다 바깥으로 나가므로 둘 다 ↗ 를 달고, 창이 새로 열리는지는 표식이 아니라
              링크가 정한다(Jira 는 `target="_blank"`, 담당자 화면은 같은 창).
              이 앱의 다른 8곳도 전부 「나가는 문」이라 이 정의와 어긋나지 않는다.
              어느 화면으로 가는지는 여전히 **앞의 마크**가 말한다 — ↗ 는 방향, 마크는 목적지. */}
          <div className={opsStyles.aboutList}>
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
              {/* `install` 은 내려받기 글리프라 이 줄에서 목적지를 잘못 말했다 — 아무것도
                  내려받지 않는다 (오너 2026-08-27 "SDU Icon이라서 별로임"). 저장소가 같은
                  이유로 이미 한 번 물린 이름이다(icons.tsx:145-147, 파이프라인 태그는
                  package-plus 로 갈아탔다). `cursor` 는 다섯 후보 비교에서 오너가 고른 것:
                  다섯 중 유일하게 **사람**을 데려오는 글리프라 "담당자가 보는"이라는 문장의
                  주어와 붙는다. 시안 아티팩트는 docs/ux/icon-vocabulary.md 에 적어 뒀다. */}
              <span className={opsStyles.aboutMark} aria-hidden>
                <Icon name="cursor" size="sm" />
              </span>
              <Link
                href={passRoutes.targetSource(targetSourceId)}
                className={opsStyles.aboutLink}
                title="PII Agent 설치 화면 — 이 대상의 서비스측 진행 화면"
              >
                {/* 화살표는 Jira 줄과 같다 (오너 2026-08-27) — 이 줄도 이 화면을 떠나
                    다른 화면으로 나간다. 두 줄이 같은 종류라는 것을 같은 글리프가 말한다. */}
                서비스 담당자가 보는 화면 <Icon name="arrow-ur" size="sm" />
              </Link>
            </span>
          </div>
        </section>
      </div>
    </>
  );
}
