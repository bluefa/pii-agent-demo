'use client';

/**
 * 서비스 운영 상세 — Target Source 목록 · Jira Ticket 연결 · EOS 처리.
 *
 * 두 데이터 소스가 섞여 있다: 서비스/대상은 assumed GET /admin/ops/services/{code},
 * Jira 티켓은 실계약 GET /services/{code}/jira-tickets. 후자는 CloudProvider 가 키라
 * 5개 provider 를 항상 전부 그린다 — 빈 표가 아니라 "무엇을 연결할 수 있는지"를 보여야
 * 연결 지점이 화면에서 읽힌다.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { cn, idcStyles, pipelineStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { fmtDateTime } from '@/lib/pipeline/format';
import { Pagination } from '@/app/components/ui/Pagination';
import { JiraLogo } from '@/app/admin/pipelines/_components/brandMarks';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import { StepPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/StepPill';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { EosModal } from '@/app/admin/pipelines/ops/services/_components/EosModal';
import { JiraTicketModal } from '@/app/admin/pipelines/ops/services/_components/JiraTicketModal';
import {
  getOpsService,
  getServiceJiraTickets,
  JIRA_CLOUD_PROVIDERS,
  type JiraCloudProvider,
  type JiraTicket,
  type OpsServiceDetail,
  type OpsTargetSourceListItem,
} from '@/app/lib/api/ops';

const TS_COLUMNS = ['ID', 'Provider', '계정', '현재 단계', '마지막 변경'] as const;
/** 섹션 제목 — 18px 마크 + 8px + 제목(Figma Heading 2). */
const sectionHead = 'flex items-center gap-2 mb-3';
const PAGE_SIZE = 10;

/**
 * JiraTicketResponse 에는 티켓 URL 이 없다(issueKey 만 온다) — 계약이 url 을 싣기 전까지
 * 브라우즈 주소는 env 로 받는다. 기본값을 두지 않는 이유: NEXT_PUBLIC_* 는 빌드 시점에
 * 박히므로, 안 넣고 배포하면 남의 도메인으로 가는 링크가 그대로 굳는다. 없으면 링크가
 * 아니라 글자로 보여준다.
 */
const JIRA_BROWSE_BASE = process.env.NEXT_PUBLIC_JIRA_BROWSE_BASE ?? null;

/**
 * Step 1 리소스 표(idcStyles.table.approval*)를 그대로 쓰고, 이 화면에만 필요한 것만
 * 얹는다. frame 은 Pagination 마감 바가 아래 테두리·라운드를 맡으므로 위쪽 반쪽만
 * 그린다 — Step 1 에서 툴바가 하던 역할을 여기선 표 머리가 한다.
 */
const tsTable = {
  frame: 'overflow-hidden rounded-t-[10px] border border-b-0 border-[#E5E7EB] bg-white',
  id: 'text-[13px] font-semibold [font-family:var(--pl-font-mono)] text-[#191F28] whitespace-nowrap',
  time: 'text-[14px] text-[#6B7684] whitespace-nowrap',
  go: 'inline-flex text-[#3182F6] hover:opacity-70',
} as const;

/**
 * Jira 타일 — provider 5개는 열이 2개뿐인 표를 채우기엔 너무 짧고, 서로 비교할 값도
 * 없다. 244px 타일 3열(Figma 8VvnhFuRfLUniXG0SP4YSJ 6:6)로 접으면 같은 정보가
 * 표의 1/3 높이에 들어간다.
 */
const tileStyles = {
  /* 748 = 244*3 + 8*2 (Figma Row1). 폭을 묶지 않으면 3열이 화면 폭을 따라 늘어나 타일
     하나가 400px 이 되고, 표를 걷어낸 이유(휑함)가 그대로 돌아온다. */
  grid: 'grid grid-cols-3 gap-2 max-w-[748px]',
  base: 'flex items-center gap-2 rounded-[8px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] px-4 py-3.5',
  /** 티켓 키 — 12 mono/600. 열 곳이 없으면 파랑·밑줄 없이 글자로만. */
  key: 'mt-1 block truncate text-[12px] font-semibold [font-family:var(--pl-font-mono)] text-[var(--pl-text-strong)]',
  /** 열 수 있을 때 — primary + 밑줄. ↗ 까지 밑줄이 이어지도록 inline 한 덩어리. */
  value:
    'mt-1 block truncate text-[12px] font-semibold [font-family:var(--pl-font-mono)] text-[var(--pl-primary)] underline underline-offset-2 hover:opacity-80',
  empty: 'mt-1 block text-[11px] font-medium text-[var(--pl-text-faint)]',
  kebab:
    'flex-none -mr-1.5 grid h-7 w-7 place-items-center rounded-md text-[var(--pl-text-faint)] cursor-pointer hover:bg-[var(--pl-gray-100)] hover:text-[var(--pl-text-medium)]',
} as const;

/** 운영중 / EOS — ok vs err tones (목록과 같은 문법). */
function ServiceStatusTag({ status }: { status: OpsServiceDetail['status'] }): ReactElement {
  const eos = status === 'EOS';
  return (
    <span
      className={cn(
        opsStyles.statusTag,
        eos
          ? 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]'
          : 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]',
      )}
    >
      {eos ? 'EOS' : '운영중'}
    </span>
  );
}

/** metadata → 그 provider 가 실제로 갖는 계정 식별자 1건. 없으면 null. */
function accountOf(
  target: OpsTargetSourceListItem,
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
 * 계정 셀 — 라벨 위 / 값 아래 2줄. 값이 12자리 숫자, 30자 UUID, 20자 문자열로 제각각이라
 * 한 줄에 "라벨: 값"으로 붙이면 열 폭이 provider 마다 튀고 값이 라벨에 묻힌다.
 * IDC·SDU 는 CSP 계정이 없는 게 정상이므로 결측(—)이 아니라 조용히 비운다.
 */
function AccountCell({ target }: { target: OpsTargetSourceListItem }): ReactElement {
  const account = accountOf(target);
  if (!account) return <span className={pipelineStyles.text.muted}>—</span>;
  return (
    // 300px = Azure subscription UUID(36자) 가 13px mono 로 잘리지 않는 폭. 가장 긴
    // 식별자에 맞춘다 — 여기서 줄이면 UUID 앞부분이 같은 행들이 서로 구분되지 않는다.
    <span className="block max-w-[300px]">
      <span className="flex items-center gap-1.5">
        <span className="text-[12px] text-[var(--pl-text-weak)]">{account.label}</span>
        {account.china && <span className={opsStyles.regionTag}>중국</span>}
      </span>
      <span
        title={account.value}
        className="mt-0.5 block truncate text-[13px] [font-family:var(--pl-font-mono)] text-[var(--pl-text-strong)]"
      >
        {account.value}
      </span>
    </span>
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
  const [eosOpen, setEosOpen] = useState(false);
  const [jiraTarget, setJiraTarget] = useState<JiraCloudProvider | null>(null);
  // 목록은 한 번에 다 온다(assumed 계약에 page 파라미터가 없다) — 자르는 건 화면 몫.
  // Pagination 은 0-based. 페이지는 serviceCode 에 매여 있다: 다른 서비스로 이동하면
  // 남아 있던 3페이지가 되살아나면 안 되고, 그 초기화를 effect 로 하면 렌더가 한 번 더 돈다.
  const [pageAt, setPageAt] = useState({ code: serviceCode, page: 0 });
  const page = pageAt.code === serviceCode ? pageAt.page : 0;
  const setPage = (next: number): void => setPageAt({ code: serviceCode, page: next });
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

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

  if (failed) {
    return (
      <div className={cn(pipelineStyles.empty.base, pipelineStyles.empty.center)}>
        <p>서비스 {serviceCode} 정보를 불러오지 못했습니다.</p>
        <PlButton variant="secondary" className="mt-3" onClick={reload}>
          다시 시도
        </PlButton>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className={cn(pipelineStyles.empty.base, pipelineStyles.empty.center)} aria-busy>
        불러오는 중…
      </div>
    );
  }

  const { breadcrumb, section, text } = pipelineStyles;
  const isEos = detail.status === 'EOS';
  const targetCount = detail.target_sources.length;
  // 다시 읽어 대상이 줄면 마지막 페이지 밖에 머물 수 있다 — 빈 표 대신 마지막 장으로.
  const safePage = Math.min(page, Math.max(0, Math.ceil(targetCount / pageSize) - 1));
  const pageRows = detail.target_sources.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const ticketOf = (provider: JiraCloudProvider): JiraTicket | undefined =>
    tickets.find((ticket) => ticket.cloudProvider.toUpperCase() === provider);

  const eosButton = isEos ? (
    <PlButton variant="secondary" disabled>
      EOS 처리됨
    </PlButton>
  ) : (
    <PlButton variant="danger" onClick={() => setEosOpen(true)}>
      <Icon name="trash" size="sm" />
      EOS 처리
    </PlButton>
  );

  return (
    <div>
      <nav aria-label="현재 위치" className={breadcrumb.base}>
        <Link href={passRoutes.pipelines.ops.services} className={breadcrumb.crumb}>
          서비스 운영
        </Link>
        <span className={breadcrumb.sep}>/</span>
        <span className={breadcrumb.cur}>{detail.service_name}</span>
      </nav>

      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className={cn(text.pageTitle, 'truncate')}>{detail.service_name}</h1>
            <span className={cn(opsStyles.tag, '[font-family:var(--pl-font-mono)]')}>
              {detail.service_code}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={text.kvKey}>담당</span>
            <span className={text.kvValue}>{detail.owner}</span>
            <span className={opsStyles.cloudSep}>·</span>
            <span className={text.kvKey}>상태</span>
            <ServiceStatusTag status={detail.status} />
            <span className={opsStyles.cloudSep}>·</span>
            <span className={text.kvKey}>Target Source</span>
            <span className={cn(text.kvValue, 'tabular-nums')}>{targetCount}건</span>
          </div>
        </div>
        <div className="flex-none">{eosButton}</div>
      </div>

      {/* First section sits 24px under the header (design override of the 64px default). */}
      <h2 className={cn(text.sectionTitle, sectionHead, 'mt-6')}>
        <Icon name="table" size={18} className="text-[var(--pl-text-weak)]" />
        Target Source 목록
      </h2>
      {/* Step 1 리소스 표 스택 그대로: 무카드 · 표 세그먼트(상단 라운드) + Pagination
          마감 바(하단 라운드). 카드에 넣으면 카드 패딩이 표를 안쪽으로 밀어 머리글
          밴드가 컨테이너에서 떨어지고, 페이저도 표에 붙지 못한다. */}
      <div>
        <div className={tsTable.frame}>
          <table className="w-full">
            <thead className={idcStyles.table.approvalHeader}>
              <tr className="whitespace-nowrap">
                {TS_COLUMNS.map((column) => (
                  <th key={column} className={idcStyles.table.approvalHeaderCell}>
                    {column}
                  </th>
                ))}
                <th className={cn(idcStyles.table.approvalHeaderCell, 'w-12')} aria-label="이동" />
              </tr>
            </thead>
            <tbody className={idcStyles.table.body}>
              {targetCount === 0 ? (
                <tr>
                  <td colSpan={TS_COLUMNS.length + 1} className={idcStyles.table.approvalCell}>
                    <p className={pipelineStyles.empty.base}>등록된 Target Source가 없습니다.</p>
                  </td>
                </tr>
              ) : (
                pageRows.map((target) => {
                  const href = passRoutes.pipelines.ops.targetSource(target.target_source_id);
                  return (
                    <tr
                      key={target.target_source_id}
                      className={cn(idcStyles.table.row, 'cursor-pointer')}
                      onClick={(event) => {
                        if (event.target instanceof HTMLElement && event.target.closest('a')) return;
                        router.push(href);
                      }}
                    >
                      <td className={cn(idcStyles.table.approvalCell, tsTable.id)}>
                        #{target.target_source_id}
                      </td>
                      <td className={idcStyles.table.approvalCell}>
                        <ProvTag provider={target.cloud_provider} isSdu={target.is_sdu_type} />
                      </td>
                      <td className={idcStyles.table.approvalCell}>
                        <AccountCell target={target} />
                      </td>
                      <td className={idcStyles.table.approvalCell}>
                        <StepPill status={target.process_status} />
                      </td>
                      <td className={cn(idcStyles.table.approvalCell, tsTable.time)}>
                        {fmtDateTime(target.last_changed_at)}
                      </td>
                      <td className={cn(idcStyles.table.approvalCell, 'text-right')}>
                        <Link
                          href={href}
                          aria-label={`Target Source #${target.target_source_id} 운영 상세로 이동`}
                          className={tsTable.go}
                        >
                          <Icon name="arrow-ur" size="sm" strokeWidth={2.75} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={safePage}
          pageSize={pageSize}
          totalCount={targetCount}
          onPageChange={setPage}
          onPageSizeChange={(next) => {
            setPageSize(next);
            setPage(0);
          }}
        />
      </div>

      {/* 시안 간격: 표 아래 32px (기본 64 는 두 섹션을 다른 페이지처럼 갈라 놓는다). */}
      <h2 className={cn(text.sectionTitle, sectionHead, 'mt-8')}>
        <JiraLogo />
        Jira Ticket 연결
      </h2>
      <p className={section.desc}>
        CloudProvider 마다 Jira 티켓을 1건씩 연결합니다. 연결·해제는 이 서비스와 티켓의 연결
        정보만 바꾸며, <b className="font-semibold text-[var(--pl-text-medium)]">Jira 의 티켓을
        만들거나 삭제하지 않습니다.</b>
      </p>
      <section className={tileStyles.grid} aria-label="Jira Ticket 연결">
        {JIRA_CLOUD_PROVIDERS.map((provider) => {
          const ticket = ticketOf(provider);
          return (
            <div key={provider} className={tileStyles.base}>
              <div className="min-w-0 flex-1">
                <ProvTag provider={provider} />
                {ticket ? (
                  JIRA_BROWSE_BASE ? (
                    <a
                      href={`${JIRA_BROWSE_BASE}/${encodeURIComponent(ticket.issueKey)}`}
                      target="_blank"
                      rel="noreferrer"
                      className={tileStyles.value}
                      title={`${ticket.issueKey} — Jira 에서 열기`}
                    >
                      {ticket.issueKey} ↗
                    </a>
                  ) : (
                    <span className={tileStyles.key}>{ticket.issueKey}</span>
                  )
                ) : (
                  <span className={tileStyles.empty}>연결된 티켓 없음</span>
                )}
              </div>
              <button
                type="button"
                className={tileStyles.kebab}
                aria-label={`${provider} Jira Ticket 연결 관리`}
                onClick={() => setJiraTarget(provider)}
              >
                <Icon name="dots-v" />
              </button>
            </div>
          );
        })}
      </section>

      <EosModal
        open={eosOpen}
        onClose={() => setEosOpen(false)}
        serviceCode={detail.service_code}
        serviceName={detail.service_name}
        targetSourceCount={targetCount}
        onDone={reload}
      />
      {jiraTarget && (
        <JiraTicketModal
          onClose={() => setJiraTarget(null)}
          serviceCode={detail.service_code}
          provider={jiraTarget}
          issueKey={ticketOf(jiraTarget)?.issueKey ?? null}
          onDone={reload}
        />
      )}
    </div>
  );
}
