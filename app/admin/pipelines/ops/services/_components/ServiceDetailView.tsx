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
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { displayProvider, providerLabel } from '@/lib/pipeline/format';
import { Pagination } from '@/app/components/ui/Pagination';
import { TableToolbar } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar';
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

const tsTable = {
  /**
   * 커서가 카드 위에 올 때만 파랑 — 행마다 하나씩 있는 링크를 상시 파랑으로 두면
   * 목록이 화면에서 가장 시끄러운 것이 된다.
   */
  go: 'whitespace-nowrap text-[14px] font-semibold text-[var(--pl-text-weak)] underline-offset-[3px] transition-colors group-hover:text-[var(--pl-primary)] group-hover:underline',
  /**
   * 블록은 흰 시트 안에 있다 — 테두리로 구획하고, 안쪽 카드 목록만 한 단 내려간 면을
   * 깐다. 카드가 흰색이라 바닥이 흰 시트면 카드가 면이 아니라 테두리로만 남는다.
   */
  block: 'overflow-hidden rounded-[8px] border border-[var(--pl-border)]',
  list: 'flex flex-col gap-2.5 bg-[var(--pl-bg-inner)] p-3',
  card:
    'group relative flex items-start gap-3.5 rounded-[8px] border border-[var(--pl-border)] '
    + 'bg-[var(--pl-bg-card)] px-[18px] py-4 cursor-pointer transition-colors hover:border-[var(--pl-border-strong)]',
  id: 'text-[16px] font-bold [font-family:var(--pl-font-mono)] text-[var(--pl-text-strong)] whitespace-nowrap transition-colors group-hover:text-[var(--pl-primary)]',
  /** 샾은 숫자가 아니라 문장부호다 — 한 단 여리게, 간격을 두고. */
  idHash: 'mr-0.5 font-normal text-[var(--pl-text-weak)] group-hover:text-[var(--pl-primary)]',
  metaLabel: 'text-[12px] text-[var(--pl-text-weak)]',
  /** 계정 값 — 12자리 숫자와 36자 UUID 가 섞여 있어 대조하는 값이라 mono. */
  account:
    'truncate text-[14px] [font-family:var(--pl-font-mono)] text-[var(--pl-text-strong)]',
  /** 설명 — 길이를 알 수 없는 유일한 값이라 잘리고 전문은 title 로 남긴다. */
  desc: 'truncate text-[14px] text-[var(--pl-text-medium)]',
  /** 건수 배지 — 제목 옆에서 바로 읽혀야 하는 값이라 회색이 아니라 primary 톤. */
  badge:
    'inline-flex items-center rounded-full bg-[var(--pl-primary-bg)] px-2 py-[3px] text-[12px] font-semibold text-[var(--pl-primary)] tabular-nums',
} as const;

/**
 * 제목 옆 ServiceCode 칩 — 회색. 이름 위 분류 태그가 파랑을 쓰므로 여기까지 primary 면
 * 머리에 파란 것이 둘이라 어느 쪽이 분류인지 흐려진다. 값을 읽는 칩은 한 단 낮춘다
 * (#344054 on #F2F4F7 = 9.49:1). opsStyles.tag 에 색만 덧칠하지 않는 이유: cn 은 단순
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
 * 기본 표시 개수 — 카드는 표 행의 세 배 높이라, 이 섹션 아래 Jira 티켓 연결까지 한 화면에
 * 들어오는 선이 3장이다. 더 보려면 페이지 크기를 올린다.
 */
const PAGE_SIZE = 3;

/**
 * Jira 타일 — provider 5개는 열이 2개뿐인 표를 채우기엔 너무 짧고, 서로 비교할 값도
 * 없다. 244px 타일 3열(Figma 8VvnhFuRfLUniXG0SP4YSJ 6:6)로 접으면 같은 정보가
 * 표의 1/3 높이에 들어간다.
 */
const tileStyles = {
  /* 748 = 244*3 + 8*2 (Figma Row1). 폭을 묶지 않으면 3열이 화면 폭을 따라 늘어나 타일
     하나가 400px 이 되고, 표를 걷어낸 이유(휑함)가 그대로 돌아온다. */
  grid: 'grid grid-cols-3 gap-2 max-w-[748px]',
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
  // Pagination 은 0-based. 서비스를 옮기면 부모(ServicesView)가 key={serviceCode} 로 이
  // 컴포넌트를 갈아끼우므로 여기 상태는 전부 초기값에서 다시 시작한다 — 페이지만 따로
  // serviceCode 에 매어두면 검색어·필터는 그대로 남아 규칙이 둘로 갈린다.
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [query, setQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState('');

  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 티켓은 별도 계약 — 티켓 조회가 실패해도 서비스 화면은 서야 한다.
        const [loaded, jira] = await Promise.all([
          getOpsService(serviceCode),
          getServiceJiraTickets(serviceCode).catch(() => [] as JiraTicket[]),
        ]);
        if (cancelled) return;
        setFailed(false);
        setDetail(loaded);
        setTickets(jira);
      } catch {
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

  if (!detail) {
    return (
      <div className={cn(s.sheet, 'items-center justify-center')} aria-busy>
        <div className={cn(pipelineStyles.empty.base, pipelineStyles.empty.center)}>
          불러오는 중…
        </div>
      </div>
    );
  }

  const { section, text } = pipelineStyles;
  const targetCount = detail.target_sources.length;

  // 라우트가 이 서비스의 대상을 한 번에 다 주므로(계약에 대상 검색어 파라미터가 없다)
  // 검색·필터 자르기는 화면 몫이다. 검색은 사람이 목록에서 눈으로 찾는 값
  // (대상 번호·설명·계정)만 훑는다.
  const needle = query.trim().toLowerCase();
  const rows = detail.target_sources.filter((target) => {
    if (
      providerFilter
      && displayProvider(target.cloud_provider, target.is_sdu_type) !== providerFilter
    ) {
      return false;
    }
    if (!needle) return true;
    return [
      `#${target.target_source_id}`,
      target.description ?? '',
      accountOf(target)?.value ?? '',
    ].some((value) => value.toLowerCase().includes(needle));
  });

  // 옵션은 이 서비스가 실제로 가진 값만 — 고를 수 없는 조건을 열어두면 빈 표만 나온다.
  const providerOptions = [...new Set(
    detail.target_sources.map((t) => displayProvider(t.cloud_provider, t.is_sdu_type)),
  )].map((value) => ({ value, label: providerLabel(value) }));

  // 다시 읽거나 필터를 걸어 행이 줄면 마지막 페이지 밖에 머물 수 있다 — 마지막 장으로.
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = rows.slice(safePage * pageSize, (safePage + 1) * pageSize);
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
        </p>

        {/* Step 1 리소스 표와 같은 실루엣: 툴바(검색·필터) → 헤더 밴드 표 → Pagination 마감 바. */}
        <div className={tsTable.block}>
          <TableToolbar
            searchValue={query}
            onSearchChange={(next) => {
              setQuery(next);
              setPage(0);
            }}
            searchPlaceholder="대상 번호·설명·계정 검색"
            searchLabel="Target Source 검색"
            groups={[
              {
                key: 'provider',
                label: '클라우드',
                value: providerFilter,
                onChange: (next) => {
                  setProviderFilter(next);
                  setPage(0);
                },
                options: providerOptions,
              },
            ]}
          />
          {/* Cards, not rows — same grammar as the Target Source 운영 list and the user
              side. White cards on the block's tinted ground, so the block still reads as
              one object and each target still reads as its own. */}
          <div className={tsTable.list}>
            {rows.length === 0 ? (
              <p className={pipelineStyles.empty.base}>
                {targetCount === 0
                  ? '등록된 Target Source가 없습니다.'
                  : '조건에 맞는 Target Source가 없습니다.'}
              </p>
            ) : (
              pageRows.map((target) => {
                const account = accountOf(target);
                return (
                  <div
                    key={target.target_source_id}
                    className={tsTable.card}
                    // 행 아무 데나 눌러도 이동한다(마우스 편의). 키보드·새 탭은 stretched
                    // 링크가 맡으므로, 링크 위 클릭은 여기서 흘려보내 이동이 두 번 일어나지
                    // 않게 한다.
                    onClick={(event) => {
                      if (event.target instanceof HTMLElement && event.target.closest('a')) return;
                      router.push(passRoutes.pipelines.ops.targetSource(target.target_source_id));
                    }}
                  >
                    <ProviderLogo
                      provider={target.cloud_provider as CloudProvider}
                      isSdu={target.is_sdu_type}
                      variant="bare"
                      className="flex-none"
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

                      {account && (
                        <div className="flex items-center gap-1.5 pl-0.5">
                          <span className={tsTable.metaLabel}>{account.label}</span>
                          <span className={tsTable.account}>{account.value}</span>
                        </div>
                      )}

                      {target.description && (
                        <div className="flex min-w-0 gap-1.5 pl-0.5">
                          <span className={cn(tsTable.metaLabel, 'flex-none pt-0.5')}>설명</span>
                          <span className={tsTable.desc} title={target.description}>
                            {target.description}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* The link is this element, not a stretched overlay over the whole
                        card. An overlay is the only positioned child, so it paints above
                        everything: it swallowed the 설명 tooltip and made the account id
                        unselectable — a value that exists to be compared and copied. The
                        card keeps its own onClick for the mouse shortcut. */}
                    <Link
                      href={passRoutes.pipelines.ops.targetSource(target.target_source_id)}
                      aria-label={`Target Source #${target.target_source_id} 운영 화면으로 이동`}
                      className={cn(tsTable.go, 'flex-none pt-0.5')}
                    >
                      운영 화면 ↗
                    </Link>
                  </div>
                );
              })
            )}
          </div>
          <Pagination
            page={safePage}
            pageSize={pageSize}
            totalCount={rows.length}
            // 기본값이 선택지에 없으면 셀렉트가 다른 값을 가리킨다(목록은 3장, 컨트롤은 5).
            pageSizeOptions={[3, 5, 10, 20, 50]}
            onPageChange={setPage}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setPage(0);
            }}
          />
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
