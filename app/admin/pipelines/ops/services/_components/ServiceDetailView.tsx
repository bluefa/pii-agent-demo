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
import { cn, pipelineStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { fmtDateTime } from '@/lib/pipeline/format';
import { JiraLogo } from '@/app/admin/pipelines/_components/brandMarks';
import { Card } from '@/app/admin/pipelines/_components/Card';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlPagination } from '@/app/admin/pipelines/_components/PlPagination';
import {
  PlChevCell,
  PlRow,
  PlTable,
  PlTd,
} from '@/app/admin/pipelines/_components/PlTable';
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
 * 브라우즈 주소는 여기서 조립한다. 배포 환경이 다르면 env 로 덮는다.
 */
const JIRA_BROWSE_BASE = process.env.NEXT_PUBLIC_JIRA_BROWSE_BASE ?? 'https://jira.example.com/browse';

/**
 * 머리글 셀 — PlTh(=table.th) 와 같은 밴드지만 대문자 변환만 뺐다. 시안의 머리글은
 * "Provider", "계정" 처럼 원문 그대로고, 한글에는 대문자가 없어 한 표 안에서 영문 열만
 * 커진다. PlTh 에 클래스로 덮으면 uppercase 와 같은 속성끼리 캐스케이드 싸움이 되므로
 * 아예 th 를 직접 쓴다.
 */
const TH =
  'text-left h-[34px] px-3 text-[12px] font-semibold text-[var(--pl-text-weak)] bg-[var(--pl-gray-50)] border-b border-[var(--pl-border)] whitespace-nowrap';

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
  name: 'block text-[12px] font-medium text-[var(--pl-text-medium)]',
  /** 티켓 키 — 12 mono/600, primary, 밑줄. ↗ 까지 밑줄이 이어지도록 inline 한 덩어리. */
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
  const [page, setPage] = useState(1);

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
  const pages = Math.max(1, Math.ceil(targetCount / PAGE_SIZE));
  // 다시 읽어 대상이 줄면 마지막 페이지 밖에 머물 수 있다 — 빈 표 대신 마지막 장으로.
  const current = Math.min(page, pages);
  const pageRows = detail.target_sources.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
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
      <Card>
        <PlTable
          head={
            <>
              {TS_COLUMNS.map((column) => (
                <th key={column} className={TH}>
                  {column}
                </th>
              ))}
              <th className={cn(TH, 'w-12')} aria-label="이동" />
            </>
          }
        >
          {targetCount === 0 ? (
            <tr>
              <td colSpan={TS_COLUMNS.length + 1}>
                <p className={pipelineStyles.empty.base}>등록된 Target Source가 없습니다.</p>
              </td>
            </tr>
          ) : (
            pageRows.map((target) => (
              <PlRow
                key={target.target_source_id}
                onActivate={() =>
                  router.push(passRoutes.pipelines.ops.targetSource(target.target_source_id))
                }
              >
                <PlTd mono className="font-semibold">
                  #{target.target_source_id}
                </PlTd>
                <PlTd>
                  <ProvTag provider={target.cloud_provider} isSdu={target.is_sdu_type} />
                </PlTd>
                <PlTd>
                  <AccountCell target={target} />
                </PlTd>
                <PlTd>
                  <StepPill status={target.process_status} />
                </PlTd>
                <PlTd muted className="whitespace-nowrap">
                  {fmtDateTime(target.last_changed_at)}
                </PlTd>
                <PlChevCell title={`Target Source #${target.target_source_id} 운영 상세로 이동`} />
              </PlRow>
            ))
          )}
        </PlTable>
        {/* 대상이 1건이어도 자리를 지킨다 — 목록의 끝이 어디인지, 뒤에 더 있는지를
            표 자체가 말해야 한다(Step 1 리소스 표와 같은 규칙). */}
        <PlPagination
          page={current}
          pages={pages}
          onPrev={() => setPage(Math.max(1, current - 1))}
          onNext={() => setPage(Math.min(pages, current + 1))}
        />
      </Card>

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
