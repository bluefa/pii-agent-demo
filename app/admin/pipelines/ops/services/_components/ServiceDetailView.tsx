'use client';

/**
 * 서비스 운영 상세 — Target Source 목록 · Jira Ticket 연결.
 *
 * 두 데이터 소스가 섞여 있다: 서비스/대상은 GET /admin/ops/services/{code} (라우트가
 * 실계약 `/target-sources/page?serviceCode` 로 만든다), Jira 티켓은 실계약
 * GET /services/{code}/jira-tickets. 후자는 CloudProvider 가 키라 5개 provider 를 항상
 * 전부 그린다 — 빈 표가 아니라 "무엇을 연결할 수 있는지"를 보여야 연결 지점이 화면에서
 * 읽힌다.
 *
 * 이 화면은 대상의 설치 진행 단계를 보여주지 않는다 (오너 결정). 단계는 카드의
 * "운영 화면 ↗" 한 번이면 닿는 Target Source 운영 화면이 맡는다. 여기서 빼면서
 * `/process-statuses` 집계도 라우트에서 사라졌다 — 그 엔드포인트는 serviceCode 로
 * 거를 수 없어 서비스 하나를 그리려고 전체를 페이징해야 했다.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { borderColors, cn, pipelineStyles, tableRowLift } from '@/lib/theme';
import { holdFor, SKELETON_MIN_MS } from '@/lib/min-duration';
import { passRoutes } from '@/lib/routes';
import { displayProvider, providerLabel } from '@/lib/pipeline/format';
import { JiraLogo } from '@/app/admin/pipelines/_components/brandMarks';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import { ProviderLogo } from '@/app/components/features/admin/v7';
import type { CloudProvider } from '@/lib/types';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { serviceListStyles as s } from '@/app/admin/pipelines/_services/styles';
import { jiraTicketLink } from '@/lib/jira-ticket';
import { JiraTicketMenu } from '@/app/admin/pipelines/ops/services/_components/JiraTicketMenu';
import {
  JiraTicketModal,
  type JiraTicketAction,
} from '@/app/admin/pipelines/ops/services/_components/JiraTicketModal';
import {
  getOpsService,
  getServiceJiraTickets,
  JIRA_CLOUD_PROVIDERS,
  type JiraCloudProvider,
  type JiraTicket,
  type OpsServiceDetail,
  type OpsServiceTargetRow,
} from '@/app/lib/api/ops';

/**
 * 카드 한 장의 높이 — 데이터가 아니라 상수다 (LIN-92).
 *
 * 예전에는 계정 줄과 설명 줄이 조건부 렌더라, 대상마다 카드가 2층이 되기도 3층이
 * 되기도 했다. 그래서 "가득 찬 3장짜리 페이지"끼리도 높이가 달랐고, 페이지를 넘기지
 * 않아도 아래 Jira 섹션이 움직였다. 지금은 두 줄 모두 값이 없을 때 대신 놓을 말을
 * 가지므로(glossOf / 설명 없음) 카드는 언제나 3층이다.
 *
 * `min-h` 가 아니라 `h` 인 이유: 3층 카드의 실측 높이는 113.59px 다 (19+19 패딩 +
 * 73.59 글자단 + 2 테두리). 글자단이 line-height 배수라 분수로 떨어지므로, 바닥값을
 * 두면 카드는 113.59 로 서고 빈 슬롯만 바닥값에 서서 둘이 1.6px 어긋난다 — 실제로
 * 그렇게 어긋났다. 높이를 못 박아 카드·빈 슬롯·스켈레톤이 한 값을 쓴다.
 *
 * 120px 는 113.59 위의 여유다. 천장이기도 하다: 1층이 줄바꿈할 만큼 좁아지면 넘치는
 * 대신 잘린다(`overflow-hidden`). 섹션 높이를 지키는 것이 이 화면의 요구라, 잘림을
 * 택했다. 1층은 `#번호 · provider · 중국` 셋뿐이고 시트는 900px 대라 실제로 줄바꿈할
 * 폭이 아니지만, 그렇게 되면 잘린다는 것을 여기 적어 둔다.
 */
const CARD_H = 'h-[120px]';
/** 카드 사이 간격 — /pass/services 목록과 같은 14px. */
const CARD_GAP = 'gap-3.5';

const tsTable = {
  /**
   * 카드 — /pass/services 의 연동 대상 행과 같은 문법이다. 같은 엔티티를 두 화면이
   * 다르게 그릴 이유가 없고, 표 껍데기(테두리 블록 · 툴바 · 표 푸터 바)를 걷어내면
   * 남는 것이 곧 그 카드다.
   *
   * 흰 시트 위의 흰 카드라 면이 아니라 테두리로 선다. `--pl-border` 는 흰 바닥 위에서
   * 카드를 거의 지우므로, 저쪽 화면이 같은 문제를 풀며 고른 `borderColors.card` 를
   * 그대로 쓴다. hover 도 같은 출처(`tableRowLift.card`, EC2 태그의 보라)다.
   */
  card: cn(
    'group relative flex items-start gap-3.5 overflow-hidden rounded-[12px] border',
    'bg-[var(--pl-bg-card)] px-[21px] py-[19px] cursor-pointer transition-colors',
    borderColors.card,
    tableRowLift.card,
  ),
  /** 빈 슬롯 — 카드가 아니라 카드가 놓일 자리다. 점선 한 겹으로만 말한다. */
  ghost: 'rounded-[12px] border border-dashed border-[var(--pl-border)]',
  /**
   * 커서가 카드 위에 올 때만 파랑 — 행마다 하나씩 있는 링크를 상시 파랑으로 두면
   * 목록이 화면에서 가장 시끄러운 것이 된다.
   */
  go: 'whitespace-nowrap text-[14px] font-semibold text-[var(--pl-text-weak)] underline-offset-[3px] transition-colors group-hover:text-[var(--pl-primary)] group-hover:underline',
  /** 대상 번호 — 카드의 제목. `go` 와 같이 커서 아래에서만 파랑이 된다. */
  id: 'text-[16px] font-semibold [font-family:var(--pl-font-mono)] text-[var(--pl-text-strong)] whitespace-nowrap transition-colors group-hover:text-[var(--pl-primary)]',
  /** 샾은 숫자가 아니라 문장부호다 — 한 단 여리게, 간격을 두고. */
  idHash: 'mr-0.5 font-normal text-[var(--pl-text-weak)] group-hover:text-[var(--pl-primary)]',
  metaLabel: 'text-[12px] text-[var(--pl-text-weak)]',
  /** 계정 값 — 12자리 숫자와 36자 UUID 가 섞여 있어 대조하는 값이라 mono. */
  account:
    'truncate text-[14px] font-medium [font-family:var(--pl-font-mono)] text-[var(--pl-text-strong)]',
  /** 계정이 없는 provider 의 2층 — 값이 아니라 설명이라 mono 도 강조도 없다. */
  gloss: 'text-[14px] font-medium text-[var(--pl-text-medium)]',
  /** 설명 — 길이를 알 수 없는 유일한 값이라 잘리고 전문은 title 로 남긴다. */
  desc: 'truncate text-[14px] text-[var(--pl-text-medium)]',
  /** 설명이 없을 때 — 줄을 비우지 않는다. 빈 줄은 높이를 흔들고 말은 못 한다. */
  descEmpty: 'text-[14px] text-[var(--pl-text-weak)]',
  /** 건수 배지 — 제목 옆에서 바로 읽혀야 하는 값이라 회색이 아니라 primary 톤. */
  badge:
    'inline-flex items-center rounded-full bg-[var(--pl-primary-bg)] px-2 py-[3px] text-[12px] font-semibold text-[var(--pl-primary)] tabular-nums',
  /**
   * 페이지 바 — 표 푸터가 아니라 목록의 마감 띠다. 배경도 테두리도 없이 가로줄 하나로
   * 목록과 갈라선다 (/pass/services 와 같은 52px).
   */
  pager: 'flex shrink-0 items-center justify-center gap-5 h-[52px] border-t border-[var(--pl-border)]',
  pagerLabel: 'text-[14px] font-medium text-[var(--pl-text-medium)] tabular-nums',
} as const;

/**
 * 제목 옆 ServiceCode 칩 — 회색. 이름 위 분류 태그가 파랑을 쓰므로 여기까지 primary 면
 * 머리에 파란 것이 둘이라 어느 쪽이 분류인지 흐려진다. 값을 읽는 칩은 한 단 낮춘다
 * (text-medium on gray-100 = 9.49:1). opsStyles.tag 에 색만 덧칠하지 않는 이유: cn 은 단순
 * join 이라 bg 클래스가 겹치면 어느 쪽이 이기는지 CSS 순서에 달린다.
 */
const codeChip =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-1 text-[12px] font-semibold '
  + 'bg-[var(--pl-gray-100)] text-[var(--pl-text-medium)]';
/** 칩 안의 라벨 — 값이 아니라 값의 이름이라 한 단 여리게, mono 도 쓰지 않는다. */
const codeChipLabel = 'font-medium text-[var(--pl-text-weak)]';
/** 섹션 제목 — 18px 마크 + 8px + 제목(Figma Heading 2). */
const sectionHead = 'flex items-center gap-2 mb-3';
/**
 * 한 페이지 3장 — 고정이다 (LIN-92).
 *
 * 카드는 표 행의 세 배 높이라, 이 섹션 아래 Jira 티켓 연결까지 한 화면에 들어오는 선이
 * 3장이다. 예전에는 표시 개수 셀렉트로 이 값을 사용자가 바꿀 수 있었는데, 그러면 섹션
 * 높이가 사용자 손에 달리게 되어 "대상 수와 무관하게 같은 높이"라는 목표와 정면으로
 * 부딪힌다. 개수는 이제 고정이고, 모자란 자리는 빈 슬롯이 지킨다.
 */
const PAGE_SIZE = 3;

/**
 * Jira 타일 — provider 5개는 열이 2개뿐인 표를 채우기엔 너무 짧고, 서로 비교할 값도
 * 없다. 244px 타일 3열(Figma 8VvnhFuRfLUniXG0SP4YSJ 6:6)로 접으면 같은 정보가
 * 표의 1/3 높이에 들어간다.
 */
const tileStyles = {
  /* 748 = 244*3 + 8*2 (Figma Row1), 1252 = 244*5 + 8*4. 폭을 묶지 않으면 열이 화면 폭을
     따라 늘어나 타일 하나가 400px 이 되고, 표를 걷어낸 이유(휑함)가 그대로 돌아온다.
   *
   * 5열은 넓을 때만이다. provider 가 5개니 한 줄에 다섯이면 그 줄이 곧 전체이고,
   * 3+2 가 없는 묶음을 있는 것처럼 말하던 것도 사라진다 (161.8px -> 76.9px).
   *
   * 1400px 이 하한인 근거는 실측이다. 타일 폭별로:
   *   >=168px  아무것도 잘리지 않음
   *   140~168  긴 티켓 키만 잘림 (원래 truncate + title 툴팁이 맡는 값이라 계약대로다)
   *   <=134    provider 이름이 줄바꿈해 타일이 76.9 -> 93.7px 로 자람 = 진짜 깨짐
   * 뷰포트에서 그리드까지의 고정 오버헤드는 634px(레일 296 + 패딩)이라, 1400px 화면의
   * 타일은 146.8px 로 깨짐 하한 위에 있다. 그 아래는 3열로 되돌아간다. */
  grid: 'grid grid-cols-3 gap-2 max-w-[748px] min-[1400px]:grid-cols-5 min-[1400px]:max-w-[1252px]',
  /** 시트 안의 타일이라 흰색이 아니라 한 단 내려간 면 — 표 블록과 같은 깊이. */
  base: 'flex items-center gap-2 rounded-[8px] border border-[var(--pl-border)] bg-[var(--pl-bg-inner)] px-4 py-3.5',
  /** 티켓 키 — 12 mono/600. 열 곳이 없으면 파랑·밑줄 없이 글자로만. */
  key: 'mt-1 block truncate text-[12px] font-semibold [font-family:var(--pl-font-mono)] text-[var(--pl-text-strong)]',
  /** 열 수 있을 때 — primary + 밑줄. ↗ 까지 밑줄이 이어지도록 inline 한 덩어리. */
  value:
    'mt-1 block truncate text-[12px] font-semibold [font-family:var(--pl-font-mono)] text-[var(--pl-primary)] underline underline-offset-2 hover:opacity-80',
  empty: 'mt-1 block text-[12px] font-medium text-[var(--pl-text-weak)]',
  kebab:
    'flex-none -mr-1.5 grid h-7 w-7 place-items-center rounded-md text-[var(--pl-text-weak)] cursor-pointer hover:bg-[var(--pl-gray-100)] hover:text-[var(--pl-text-medium)]',
} as const;

/**
 * 페이지 화살표 — /pass/services 의 마감 띠와 같은 컨트롤. 테두리 없는 32px 글리프라
 * 목록 아래에 버튼 두 개짜리 상자를 세우지 않는다.
 */
const PageArrow = ({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}): ReactElement => (
  <button
    type="button"
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      'grid h-8 w-8 place-items-center rounded-[8px] text-[16px] transition-colors',
      'text-[var(--pl-text-medium)] cursor-pointer hover:bg-[var(--pl-gray-100)]',
      'disabled:cursor-default disabled:text-[var(--pl-border-strong)] disabled:hover:bg-transparent',
    )}
  >
    {children}
  </button>
);

/** metadata → 그 provider 가 실제로 갖는 계정 식별자 1건. 없으면 null. */
function accountOf(
  target: OpsServiceTargetRow,
): { label: string; value: string; china: boolean } | null {
  const { aws_account_id, aws_region_type, subscription_id, gcp_project_id } = target.metadata;
  if (aws_account_id) {
    return { label: 'AWS Account', value: aws_account_id, china: aws_region_type === 'china' };
  }
  if (gcp_project_id) return { label: 'GCP Project', value: gcp_project_id, china: false };
  if (subscription_id) return { label: 'Azure Subscription', value: subscription_id, china: false };
  return null;
}

/**
 * 계정 식별자가 없는 대상의 2층에 놓을 말. 줄을 비우는 대신 그 대상이 무엇인지 말한다 —
 * 빈 줄은 카드 높이를 흔들면서(LIN-92 의 원인) 아무것도 알려주지 않는다.
 *
 * SDU 와 IDC 는 계정이 없는 것이 정상이라 그 사실을 그대로 적고, 그 밖의 provider 가
 * 계정 없이 오는 것은 정상이 아니라서 "없음"이라고 말한다 — 사내망이라고 둘러대면
 * metadata 가 비어서 생긴 문제를 화면이 사실인 것처럼 덮는다.
 */
function glossOf(target: OpsServiceTargetRow): string {
  if (target.is_sdu_type) return '서비스 담당자가 데이터를 직접 업로드';
  if (target.cloud_provider.toUpperCase() === 'IDC') return '사내망';
  return '계정 식별자 없음';
}

/** 스켈레톤 바 하나 — 실제 요소의 자리를 폭·높이로만 잡는다. */
const bar = (className: string) => (
  <div className={cn(pipelineStyles.skeletonBar, className)} />
);

/**
 * Skeleton frame for the detail sheet — mirrors the loaded layout so the sheet does
 * not change shape when the service lands: 머리(분류 태그 · 서비스명 · 코드칩) →
 * 가로줄 → Target Source 목록(제목 · 설명 · 툴바를 낀 블록 · 카드 PAGE_SIZE 장) →
 * 가로줄 → Jira Ticket 연결(제목 · 설명 · 3열 타일 5장).
 *
 * 카드가 PAGE_SIZE 장인 것도 같은 이유다. 목록의 기본 표시 개수라, 더 적게 깔면 데이터가
 * 도착하는 순간 시트 아래쪽이 밀린다. Jira 타일이 5개인 건 provider 수가 고정이라
 * (JIRA_CLOUD_PROVIDERS) 로딩 중에도 이미 아는 값이기 때문.
 */
function DetailSkeleton(): ReactElement {
  const { text } = pipelineStyles;
  return (
    <div className={s.sheet} aria-busy="true" aria-live="polite">
      {/* 머리 — 태그 / 제목 + 코드칩 */}
      <div className="flex min-w-0 flex-col gap-2">
        {bar('h-[22px] w-[68px] rounded-[6px]')}
        <div className="flex items-center gap-2">
          {bar(cn(text.pageTitle, 'h-7 w-[220px] rounded'))}
          {bar('h-[26px] w-[112px] rounded')}
        </div>
      </div>

      <hr className={s.sheetRule} />

      {/* Target Source 목록 — 제목·설명·블록 */}
      <section aria-label="Target Source 목록 불러오는 중">
        <div className={cn(sectionHead, 'items-center')}>
          {bar('h-[18px] w-[18px] rounded')}
          {bar('h-5 w-[150px] rounded')}
          {bar('h-[22px] w-11 rounded-full')}
        </div>
        {bar('mb-3 h-4 w-[420px] max-w-full rounded')}
        {/* 실제 목록과 같은 간격·여백·마크 크기 — 스스로 치수를 어림잡는 스켈레톤은
            자기가 막으려던 리플로우를 그대로 되돌려 놓는다. 카드가 PAGE_SIZE 장인 것도
            같은 이유고, 이제 그 수는 데이터와 무관하게 언제나 맞다. */}
        <div className={cn('flex flex-col', CARD_GAP)}>
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <div
              key={i}
              aria-hidden="true"
              className={cn(
                'flex items-start gap-3.5 rounded-[12px] border',
                borderColors.card,
                'bg-[var(--pl-bg-card)] px-[21px] py-[19px]',
                CARD_H,
              )}
            >
              {bar('h-16 w-16 shrink-0 self-center rounded-[12px]')}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  {bar('h-6 w-16 rounded')}
                  {bar('h-5 w-12 rounded')}
                </div>
                {bar('h-[21px] w-[240px] max-w-full rounded')}
                {bar('h-[21px] w-[320px] max-w-full rounded')}
              </div>
              {bar('h-5 w-20 shrink-0 self-center rounded')}
            </div>
          ))}
        </div>
        {/* 페이지 바 자리 — 화살표와 "n/m 페이지"는 아직 모르는 값이라 비워 둔다.
            스켈레톤은 질문에 답하지 않는다. */}
        <div className={tsTable.pager} aria-hidden="true" />
      </section>

      <hr className={s.sheetRule} />

      {/* Jira Ticket 연결 — provider 수는 고정이라 타일 수도 고정 */}
      <section aria-label="Jira Ticket 연결 불러오는 중">
        <div className={cn(sectionHead, 'items-center')}>
          {bar('h-[18px] w-[18px] rounded')}
          {bar('h-5 w-[130px] rounded')}
        </div>
        {bar('mb-3 h-4 w-[520px] max-w-full rounded')}
        <div className={tileStyles.grid}>
          {JIRA_CLOUD_PROVIDERS.map((provider) => (
            <div key={provider} className={tileStyles.base} aria-hidden="true">
              <div className="min-w-0 flex-1">
                {bar('h-5 w-20 rounded')}
                {bar('mt-1 h-4 w-24 rounded')}
              </div>
              {bar('h-7 w-7 shrink-0 rounded-md')}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export interface ServiceDetailViewProps {
  serviceCode: string;
}

export function ServiceDetailView({ serviceCode }: ServiceDetailViewProps): ReactElement {
  const router = useRouter();
  const [detail, setDetail] = useState<OpsServiceDetail | null>(null);
  const [tickets, setTickets] = useState<JiraTicket[]>([]);
  const [failed, setFailed] = useState(false);
  // ⋮ 는 드롭다운을 열고, 고른 동작만 모달로 간다 (메뉴 단계를 모달에서 뺐다).
  const [menuFor, setMenuFor] = useState<JiraCloudProvider | null>(null);
  const [jiraAction, setJiraAction] = useState<
    { provider: JiraCloudProvider; action: JiraTicketAction } | null
  >(null);
  // 목록은 한 번에 다 온다(assumed 계약에 page 파라미터가 없다) — 자르는 건 화면 몫.
  // 페이지는 0-based. 서비스를 옮기면 부모(ServicesView)가 key={serviceCode} 로 이
  // 컴포넌트를 갈아끼우므로 이 상태는 초기값에서 다시 시작한다.
  const [page, setPage] = useState(0);

  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    // 레일과 같은 최소 노출 — 서비스를 옮겨 다닐 때 우측 시트가 매번 번쩍이지 않게,
    // 로딩 상태를 붙잡는 대신 데이터 반영을 최소 시간까지 미룬다.
    const startedAt = Date.now();
    (async () => {
      try {
        // 티켓은 별도 계약 — 티켓 조회가 실패해도 서비스 화면은 서야 한다.
        const [loaded, jira] = await Promise.all([
          getOpsService(serviceCode),
          getServiceJiraTickets(serviceCode).catch(() => [] as JiraTicket[]),
        ]);
        await holdFor(startedAt, SKELETON_MIN_MS);
        if (cancelled) return;
        setFailed(false);
        setDetail(loaded);
        setTickets(jira);
      } catch {
        await holdFor(startedAt, SKELETON_MIN_MS);
        if (cancelled) return;
        setDetail(null);
        setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serviceCode, reloadKey]);

  // 실패·로딩도 같은 시트 안에서 — 상태가 바뀔 때마다 본문의 면이 나타났다 사라지면
  // 화면의 틀 자체가 깜빡인다.
  if (failed) {
    return (
      <div className={cn(s.sheet, 'items-center justify-center')}>
        <div className={cn(pipelineStyles.empty.base, pipelineStyles.empty.center)}>
          <p>서비스 {serviceCode} 정보를 불러오지 못했습니다.</p>
          <PlButton variant="secondary" className="mt-3" onClick={reload}>
            다시 시도
          </PlButton>
        </div>
      </div>
    );
  }

  if (!detail) return <DetailSkeleton />;

  const { section, text } = pipelineStyles;
  // 건수는 업스트림 총계로 적는다 — 라우트가 집계 상한에 걸려 목록이 잘려도, 잘린 길이를
  // 총계로 그리면 화면이 "이게 전부"라고 사실처럼 말하게 된다.
  const targetCount = detail.total_count;
  const loadedCount = detail.target_sources.length;

  // 검색·필터는 없앴다 — 한 서비스가 가진 대상은 눈으로 훑을 만한 수라, 목록보다 큰
  // 컨트롤을 앞에 세울 값이 없었다. 라우트가 대상을 한 번에 다 주므로 자르기만 남는다.
  const rows = detail.target_sources;

  // 다시 읽어 행이 줄면 마지막 페이지 밖에 머물 수 있다 — 마지막 장으로 당긴다.
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = rows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const ticketOf = (provider: JiraCloudProvider): JiraTicket | undefined =>
    tickets.find((ticket) => ticket.cloudProvider.toUpperCase() === provider);

  return (
    // 레일과 그 뒤 바닥이 하나의 뒤쪽 면이고, 본문은 그 위에 뜬 시트 한 장이다.
    // 섹션마다 시트를 따로 두면 그 사이로 바닥이 비쳐 본문이 다시 조각난다 —
    // 구분은 시트 안에서 여백과 가로줄로만 한다.
    <div className={s.sheet}>
      {/* 좌측 레일이 곧 현재 위치라 breadcrumb 은 두지 않는다. */}
      <div className="flex min-w-0 flex-col gap-2">
        {/* 이름보다 먼저 읽히는 분류 — 이 시트가 무엇을 다루는 화면인지. */}
        <span className={s.pageTag}>서비스 관리</span>
        <div className="flex items-center gap-2">
          {/* 페이지의 h1 은 좌측 레일 제목("서비스 운영") — 상세는 그 아래 h2 다. */}
          <h2 className={cn(text.pageTitle, 'truncate')}>{detail.service_name}</h2>
          <span className={codeChip}>
            <span className={codeChipLabel}>서비스코드</span>
            <span className="[font-family:var(--pl-font-mono)]">{detail.service_code}</span>
          </span>
        </div>
      </div>

      <hr className={s.sheetRule} />

      {/* 제목·건수·설명은 섹션 머리 — 아래 Jira 섹션과 같은 문법이라 두 섹션이 같은
          높이에서 읽힌다. Target Source = 이 서비스가 가진 인프라라 표시는 CSP 아이콘. */}
      <section aria-label="Target Source 목록">
        <h2 className={cn(text.sectionTitle, sectionHead)}>
          <Icon name="cloud" size={18} className="text-[var(--pl-text-weak)]" />
          Target Source 목록
          <span className={tsTable.badge}>{targetCount}건</span>
        </h2>
        <p className={section.descFirst}>
          이 서비스가 보유한 인프라입니다. 행을 누르면 해당 Target Source 운영 화면으로
          이동합니다.
          {loadedCount < targetCount && (
            // 조용히 자르지 않는다 — 목록이 총계보다 짧으면 그 사실을 문장으로 말한다.
            <>
              {' '}
              <b className="font-semibold text-[var(--pl-warn-text)]">
                대상이 많아 {loadedCount}건까지만 표시합니다.
              </b>
            </>
          )}
        </p>

        {/* 표 껍데기를 걷은 목록 — 테두리 블록도 툴바도 없다. 카드가 이 시트 위에 바로
            놓이고, 아래 가로줄 한 줄이 목록의 끝을 말한다. 검색·필터를 뺀 것도 같은
            이유다: 한 서비스가 가진 대상은 눈으로 훑을 만한 수라, 목록보다 큰 컨트롤이
            앞에 서 있었다. */}
        <div className={cn('flex flex-col', CARD_GAP)}>
          {pageRows.map((target) => {
            // SDU 행은 밑에 깔린 CSP 를 숨긴다 — /pass/services 와 같은 규칙이다.
            // 1층이 "SDU"라고 말하는데 2층이 "AWS Account …"를 내보이면 한 카드가 서로
            // 다른 말을 한다. metadata 에 계정이 실려 와도 여기서는 gloss 로 간다.
            const account = target.is_sdu_type ? null : accountOf(target);
            // 같은 규칙 — SDU 는 하부 CSP 의 Tenant 도 내보이지 않는다.
            const tenantId = target.is_sdu_type ? null : target.metadata.tenant_id;
            return (
              <div
                key={target.target_source_id}
                className={cn(tsTable.card, CARD_H)}
                // 행 아무 데나 눌러도 이동한다(마우스 편의). 키보드·새 탭은 아래 링크가
                // 맡으므로, 링크 위 클릭은 여기서 흘려보내 이동이 두 번 일어나지 않게 한다.
                onClick={(event) => {
                  if (event.target instanceof HTMLElement && event.target.closest('a')) return;
                  router.push(passRoutes.pipelines.ops.targetSource(target.target_source_id));
                }}
              >
                <ProviderLogo
                  provider={target.cloud_provider as CloudProvider}
                  isSdu={target.is_sdu_type}
                  variant="bare"
                  // 마크는 64px 한 덩어리고 글자는 3층이다 — 위로 맞추면 마크가 높이 뜨고
                  // 카드가 아래로 무거워진다. 위에서 시작해야 하는 건 글자뿐.
                  className="flex-none self-center"
                />

                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={tsTable.id}>
                      <span className={tsTable.idHash}>#</span>
                      {target.target_source_id}
                    </span>
                    {/* Plain label: the glyph on the left already names the provider,
                        so ProvTag's own mark would say it a second time. */}
                    <span className="text-[14px] font-medium text-[var(--pl-text-medium)]">
                      {providerLabel(displayProvider(target.cloud_provider, target.is_sdu_type))}
                    </span>
                    {account?.china && <span className={opsStyles.regionTag}>중국</span>}
                  </div>

                  {/* 2층·3층은 값이 없어도 사라지지 않는다 — 조건부로 두면 대상마다 카드
                      높이가 달라지고, 그게 이 화면이 흔들리던 원인이었다(LIN-92).
                   *
                   * Tenant 는 Azure 만 갖는 두 번째 식별자라 구독 옆에 붙는다. 여기서
                   * flex-wrap 을 쓰지 않는 것이 중요하다 — GUID 두 개가 줄바꿈하면 카드가
                   * 120px 을 넘겨 잘린다. 좁아지면 줄이 늘어나는 대신 값이 잘린다. */}
                  <div className="flex min-w-0 items-center gap-x-5 pl-0.5">
                    {account ? (
                      <>
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className={cn(tsTable.metaLabel, 'flex-none')}>
                            {account.label}
                          </span>
                          <span className={tsTable.account}>{account.value}</span>
                        </span>
                        {tenantId && (
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className={cn(tsTable.metaLabel, 'flex-none')}>Tenant</span>
                            <span className={tsTable.account}>{tenantId}</span>
                          </span>
                        )}
                      </>
                    ) : (
                      <span className={tsTable.gloss}>{glossOf(target)}</span>
                    )}
                  </div>

                  <div className="flex min-w-0 gap-1.5 pl-0.5">
                    <span className={cn(tsTable.metaLabel, 'flex-none pt-0.5')}>설명</span>
                    {target.description ? (
                      <span className={tsTable.desc} title={target.description}>
                        {target.description}
                      </span>
                    ) : (
                      <span className={tsTable.descEmpty}>없음</span>
                    )}
                  </div>
                </div>

                {/* The link is this element, not a stretched overlay over the whole
                    card. An overlay is the only positioned child, so it paints above
                    everything: it swallowed the 설명 tooltip and made the account id
                    unselectable — a value that exists to be compared and copied. The
                    card keeps its own onClick for the mouse shortcut. */}
                <Link
                  href={passRoutes.pipelines.ops.targetSource(target.target_source_id)}
                  aria-label={`Target Source #${target.target_source_id} 운영 화면으로 이동`}
                  className={cn(tsTable.go, 'flex-none self-center')}
                >
                  운영 화면 ↗
                </Link>
              </div>
            );
          })}

          {/* 0건일 때의 말은 첫 슬롯이 맡는다 — 목록 전체를 대체하는 문단으로 두면 그
              문단 높이가 곧 섹션 높이가 되어 3장짜리 페이지와 어긋난다. */}
          {rows.length === 0 && (
            <div
              className={cn(
                tsTable.ghost,
                CARD_H,
                'flex items-center justify-center px-6 text-center text-[14px] text-[var(--pl-text-weak)]',
              )}
            >
              등록된 Target Source가 없습니다.
            </div>
          )}

          {/* 빈 슬롯 — 마지막 페이지가 짧아도 목록이 차지하는 높이는 그대로다.
              `aria-hidden`: 자리를 지키는 것이 전부라 읽어줄 내용이 없다. */}
          {Array.from({ length: PAGE_SIZE - pageRows.length - (rows.length === 0 ? 1 : 0) }).map(
            (_, i) => (
              <div key={`ghost-${i}`} className={cn(tsTable.ghost, CARD_H)} aria-hidden="true" />
            ),
          )}
        </div>

        {/* 페이지가 하나뿐이어도 자리를 지킨다 — 조건부로 두면 대상이 3건 이하인
            서비스와 그렇지 않은 서비스의 섹션 높이가 52px 어긋난다. */}
        <div className={tsTable.pager}>
          <PageArrow
            label="이전 페이지"
            disabled={safePage <= 0}
            onClick={() => setPage(safePage - 1)}
          >
            ←
          </PageArrow>
          <span className={tsTable.pagerLabel}>
            {safePage + 1}/{totalPages} 페이지
          </span>
          <PageArrow
            label="다음 페이지"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage(safePage + 1)}
          >
            →
          </PageArrow>
        </div>
      </section>

      <hr className={s.sheetRule} />

      {/* 같은 시트 안의 두 번째 섹션 — 가로줄이 구분이고, 시트는 끊기지 않는다. */}
      <section aria-label="Jira Ticket 연결">
        <h2 className={cn(text.sectionTitle, sectionHead)}>
          <JiraLogo />
          Jira Ticket 연결
        </h2>
        <p className={section.descFirst}>
          CloudProvider 마다 Jira 티켓을 1건씩 연결합니다. 연결·해제는 이 서비스와 티켓의 연결
          정보만 바꾸며, <b className="font-semibold text-[var(--pl-text-medium)]">Jira 의 티켓을
          만들거나 삭제하지 않습니다.</b>
        </p>
        <div className={tileStyles.grid}>
        {JIRA_CLOUD_PROVIDERS.map((provider) => {
          const ticket = ticketOf(provider);
          const link = ticket ? jiraTicketLink(ticket.issueKey) : null;
          return (
            <div key={provider} className={tileStyles.base}>
              <div className="min-w-0 flex-1">
                {/* 타일에서는 provider 가 라벨이 아니라 제목이다 — 16/600. */}
                <ProvTag provider={provider} size="lg" />
                {link ? (
                  link.href ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className={tileStyles.value}
                      title={`${link.label} — Jira 에서 열기`}
                    >
                      {link.label} ↗
                    </a>
                  ) : (
                    <span className={tileStyles.key}>{link.label}</span>
                  )
                ) : (
                  <span className={tileStyles.empty}>연결된 티켓 없음</span>
                )}
              </div>
              <div className="relative flex-none">
                <button
                  type="button"
                  className={tileStyles.kebab}
                  aria-label={`${provider} Jira Ticket 연결 관리`}
                  aria-haspopup="menu"
                  aria-expanded={menuFor === provider}
                  onClick={() => setMenuFor((cur) => (cur === provider ? null : provider))}
                >
                  <Icon name="dots-v" />
                </button>
                {menuFor === provider && (
                  <JiraTicketMenu
                    label={`${provider} Jira Ticket 연결 관리`}
                    onClose={() => setMenuFor(null)}
                    items={[
                      {
                        icon: 'link',
                        label: ticket ? '티켓 변경' : '티켓 연결',
                        onSelect: () => setJiraAction({ provider, action: 'attach' }),
                      },
                      ...(ticket
                        ? [
                            {
                              icon: 'ban' as const,
                              label: '연결 해제',
                              danger: true,
                              onSelect: () =>
                                setJiraAction({ provider, action: 'detach' }),
                            },
                          ]
                        : []),
                    ]}
                  />
                )}
              </div>
            </div>
          );
        })}
        </div>
      </section>

      {jiraAction && (
        <JiraTicketModal
          onClose={() => setJiraAction(null)}
          serviceCode={detail.service_code}
          provider={jiraAction.provider}
          action={jiraAction.action}
          issueKey={ticketOf(jiraAction.provider)?.issueKey ?? null}
          onDone={reload}
        />
      )}
    </div>
  );
}
