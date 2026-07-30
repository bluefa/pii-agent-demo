'use client';

/**
 * 서비스 운영 상세 (design/pipeline/admin-ops.html renderService) — Target Source
 * 목록 · Jira Ticket 사용자 등록 · EOS 처리. Reads GET /admin/ops/services/{code};
 * both modals reload the detail on success (status/users live on the server).
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
import { JiraUserModal } from '@/app/admin/pipelines/ops/services/_components/JiraUserModal';
import {
  getOpsService,
  type OpsJiraTicket,
  type OpsJiraTicketStatus,
  type OpsServiceDetail,
} from '@/app/lib/api/ops';

const TS_COLUMNS = ['ID', 'Provider', 'DB', '현재 단계', '마지막 변경'] as const;
const JIRA_COLUMNS = ['Ticket', '요약', '상태', '등록 사용자'] as const;

/** Jira 상태 tag — DONE ok / IN_PROGRESS blue / TO_DO gray. */
const JIRA_TONE: Record<OpsJiraTicketStatus, { label: string; cls: string }> = {
  DONE: { label: 'Done', cls: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]' },
  IN_PROGRESS: {
    label: 'In Progress',
    cls: 'bg-[var(--pl-tag-blue-bg)] text-[var(--pl-tag-blue-text)]',
  },
  TO_DO: { label: 'To Do', cls: 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)]' },
};

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

export interface ServiceDetailViewProps {
  serviceCode: string;
}

export function ServiceDetailView({ serviceCode }: ServiceDetailViewProps): ReactElement {
  const router = useRouter();
  const [detail, setDetail] = useState<OpsServiceDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [eosOpen, setEosOpen] = useState(false);
  const [jiraTicket, setJiraTicket] = useState<OpsJiraTicket | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await getOpsService(serviceCode);
        if (cancelled) return;
        setFailed(false);
        setDetail(loaded);
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

      <h2 className={section.title}>Jira Ticket</h2>
      <p className={section.desc}>
        서비스에 연결된 티켓을 관리하고, 티켓 알림을 받을 사용자를 등록합니다.
      </p>
      <section className={pipelineStyles.card.base} aria-label="Jira Ticket">
        <div className={pipelineStyles.card.tableWrap}>
          <table className={table.base}>
            <thead>
              <tr>
                {JIRA_COLUMNS.map((column) => (
                  <th key={column} className={table.headCell}>
                    {column}
                  </th>
                ))}
                <th className={cn(table.headCell, 'w-[110px]')} aria-label="사용자 등록" />
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {detail.jira_tickets.length === 0 ? (
                <tr>
                  <td colSpan={JIRA_COLUMNS.length + 1}>
                    <p className={pipelineStyles.empty.base}>연결된 Jira Ticket이 없습니다.</p>
                  </td>
                </tr>
              ) : (
                detail.jira_tickets.map((ticket) => (
                  <tr key={ticket.ticket_key}>
                    <td className={table.cell}>
                      <span className={cn(text.mono, 'font-semibold')}>{ticket.ticket_key}</span>
                    </td>
                    <td className={table.cell}>{ticket.summary}</td>
                    <td className={table.cell}>
                      <span className={cn(opsStyles.statusTag, JIRA_TONE[ticket.status].cls)}>
                        {JIRA_TONE[ticket.status].label}
                      </span>
                    </td>
                    <td className={table.cell}>
                      {ticket.users.length > 0 ? (
                        <span className="flex flex-wrap gap-1.5">
                          {ticket.users.map((user) => (
                            <span key={user} className={opsStyles.tag}>
                              {user}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className={text.muted}>—</span>
                      )}
                    </td>
                    <td className={cn(table.cell, 'text-right')}>
                      <PlButton variant="secondary" size="sm" onClick={() => setJiraTicket(ticket)}>
                        <Icon name="plus" size="sm" />
                        User 등록
                      </PlButton>
                    </td>
                  </tr>
                ))
              )}
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
      {jiraTicket && (
        <JiraUserModal
          open
          onClose={() => setJiraTicket(null)}
          serviceCode={detail.service_code}
          ticket={jiraTicket}
          onDone={reload}
        />
      )}
    </div>
  );
}
