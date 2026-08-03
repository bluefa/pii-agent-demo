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
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { passRoutes } from '@/lib/routes';
import { fmtDateTime } from '@/lib/pipeline/format';
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

const TS_COLUMNS = ['ID', 'Provider', '계정', 'DB', '현재 단계', '마지막 변경'] as const;
const JIRA_COLUMNS = ['CloudProvider', 'Ticket'] as const;

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
  const { table } = opsStyles;
  const isEos = detail.status === 'EOS';
  const targetCount = detail.target_sources.length;
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
      <h2 className={cn(text.sectionTitle, 'mt-6 mb-3')}>Target Source 목록</h2>
      <section className={pipelineStyles.card.base} aria-label="Target Source 목록">
        <div className={pipelineStyles.card.tableWrap}>
          <table className={table.base}>
            <thead>
              <tr>
                {TS_COLUMNS.map((column) => (
                  <th key={column} className={table.headCell}>
                    {column}
                  </th>
                ))}
                <th className={cn(table.headCell, 'w-10')} aria-label="이동" />
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {targetCount === 0 ? (
                <tr>
                  <td colSpan={TS_COLUMNS.length + 1}>
                    <p className={pipelineStyles.empty.base}>등록된 Target Source가 없습니다.</p>
                  </td>
                </tr>
              ) : (
                detail.target_sources.map((target) => {
                  const href = passRoutes.pipelines.ops.targetSource(target.target_source_id);
                  return (
                    // Mouse convenience only — the #id/chev anchors are the accessible
                    // (keyboard, new-tab) control, so the row keeps no role.
                    <tr
                      key={target.target_source_id}
                      className={cn(table.rowHover, 'cursor-pointer')}
                      onClick={(event) => {
                        if (event.target instanceof HTMLElement && event.target.closest('a')) return;
                        router.push(href);
                      }}
                    >
                      <td className={table.cell}>
                        <Link
                          href={href}
                          className={cn(text.mono, 'font-semibold hover:underline')}
                        >
                          #{target.target_source_id}
                        </Link>
                      </td>
                      <td className={table.cell}>
                        <ProvTag provider={target.cloud_provider} isSdu={target.is_sdu_type} />
                      </td>
                      <td className={table.cell}>
                        <AccountCell target={target} />
                      </td>
                      <td className={table.cell}>
                        {target.database_type ? (
                          <span
                            className={cn(
                              opsStyles.statusTag,
                              'bg-[var(--pl-tag-blue-bg)] text-[var(--pl-tag-blue-text)]',
                            )}
                          >
                            {getDatabaseShortLabel(target.database_type)}
                          </span>
                        ) : (
                          <span className={text.muted}>—</span>
                        )}
                      </td>
                      <td className={table.cell}>
                        <StepPill status={target.process_status} />
                      </td>
                      <td className={cn(table.cell, 'whitespace-nowrap')}>
                        <span className={text.muted}>{fmtDateTime(target.last_changed_at)}</span>
                      </td>
                      <td className={cn(table.cell, 'text-right')}>
                        <Link
                          href={href}
                          aria-label={`Target Source #${target.target_source_id} 운영 상세로 이동`}
                          className="inline-flex text-[var(--pl-text-faint)] hover:text-[var(--pl-primary)]"
                        >
                          <Icon name="chev-r" size="sm" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <h2 className={section.title}>Jira Ticket 연결</h2>
      <p className={section.desc}>
        CloudProvider 마다 Jira 티켓을 1건씩 연결합니다. 연결·해제는 이 서비스와 티켓의 연결
        정보만 바꾸며, <b className="font-semibold text-[var(--pl-text-medium)]">Jira 의 티켓을
        만들거나 삭제하지 않습니다.</b>
      </p>
      <section className={pipelineStyles.card.base} aria-label="Jira Ticket 연결">
        <div className={pipelineStyles.card.tableWrap}>
          <table className={table.base}>
            <thead>
              <tr>
                {JIRA_COLUMNS.map((column) => (
                  <th key={column} className={table.headCell}>
                    {column}
                  </th>
                ))}
                <th className={cn(table.headCell, 'w-[130px]')} aria-label="연결 관리" />
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {JIRA_CLOUD_PROVIDERS.map((provider) => {
                const ticket = ticketOf(provider);
                return (
                  <tr key={provider}>
                    <td className={cn(table.cell, 'w-[160px]')}>
                      <ProvTag provider={provider} />
                    </td>
                    <td className={table.cell}>
                      {ticket ? (
                        <span className={cn(text.mono, 'font-semibold')}>{ticket.issueKey}</span>
                      ) : (
                        <span className={text.muted}>연결된 티켓 없음</span>
                      )}
                    </td>
                    <td className={cn(table.cell, 'text-right')}>
                      <PlButton
                        variant="secondary"
                        size="sm"
                        onClick={() => setJiraTarget(provider)}
                      >
                        {ticket ? (
                          '연결 해제'
                        ) : (
                          <>
                            <Icon name="plus" size="sm" />
                            연결
                          </>
                        )}
                      </PlButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
