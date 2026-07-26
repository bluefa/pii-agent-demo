'use client';

/**
 * 서비스 운영 목록 (design/pipeline/admin-ops.html renderServices) — ServiceCode
 * 단위 운영 진입점. GET /admin/ops/services returns the whole array, so the
 * search filters client-side (code / name).
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { SearchBox } from '@/app/admin/pipelines/_components/SearchBox';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { getOpsServices, type OpsServiceSummary } from '@/app/lib/api/ops';

const COLUMNS = ['ServiceCode', '서비스', '담당', 'Target Source', 'Jira Ticket', '상태'] as const;

/** 운영중 / EOS — ok vs err tones. */
function ServiceStatusTag({ status }: { status: OpsServiceSummary['status'] }): ReactElement {
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

export function ServicesView(): ReactElement {
  const router = useRouter();
  const [services, setServices] = useState<OpsServiceSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await getOpsServices();
        if (cancelled) return;
        setFailed(false);
        setServices(loaded);
      } catch {
        if (cancelled) return;
        setServices(null);
        setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const rows = useMemo(() => {
    if (!services) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return services;
    return services.filter(
      (service) =>
        service.service_code.toLowerCase().includes(needle)
        || service.service_name.toLowerCase().includes(needle),
    );
  }, [services, query]);

  const { table } = opsStyles;

  return (
    <div>
      <div className="mb-4">
        <h1 className={pipelineStyles.text.pageTitle}>서비스 운영</h1>
        <p className={cn(pipelineStyles.text.sectionDesc, 'mt-1.5')}>
          ServiceCode 단위 운영 작업 — Target Source 목록 · Jira Ticket · EOS 처리
        </p>
      </div>

      <section className={pipelineStyles.card.base} aria-label="서비스 목록">
        {failed ? (
          <div className={cn(pipelineStyles.empty.base, pipelineStyles.empty.center)}>
            <p>서비스 목록을 불러오지 못했습니다.</p>
            <PlButton variant="secondary" className="mt-3" onClick={retry}>
              다시 시도
            </PlButton>
          </div>
        ) : !services ? (
          <div className={cn(pipelineStyles.empty.base, pipelineStyles.empty.center)} aria-busy>
            불러오는 중…
          </div>
        ) : (
          <>
            <div className={cn(pipelineStyles.filterBar, 'justify-between')}>
              <SearchBox
                wrapClassName="w-[280px]"
                placeholder="ServiceCode·서비스명 검색"
                aria-label="ServiceCode·서비스명 검색"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <span className={pipelineStyles.text.meta}>{rows.length}개 서비스</span>
            </div>

            <div className={cn(pipelineStyles.card.tableWrap, 'mt-3')}>
              <table className={table.base}>
                <thead>
                  <tr>
                    {COLUMNS.map((column) => (
                      <th key={column} className={table.headCell}>
                        {column}
                      </th>
                    ))}
                    <th className={cn(table.headCell, 'w-10')} aria-label="이동" />
                  </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={COLUMNS.length + 1}>
                        <p className={pipelineStyles.empty.base}>검색 결과가 없습니다.</p>
                      </td>
                    </tr>
                  ) : (
                    rows.map((service) => {
                      const href = passRoutes.pipelines.ops.service(service.service_code);
                      return (
                      // Mouse convenience only — the ServiceCode/chev anchors are the
                      // accessible (keyboard, new-tab) control, so the row keeps no role.
                      <tr
                        key={service.service_code}
                        className={cn(table.rowHover, 'cursor-pointer')}
                        onClick={(event) => {
                          if (event.target instanceof HTMLElement && event.target.closest('a')) return;
                          router.push(href);
                        }}
                      >
                        <td className={table.cell}>
                          <Link
                            href={href}
                            className={cn(pipelineStyles.text.mono, 'font-semibold hover:underline')}
                          >
                            {service.service_code}
                          </Link>
                        </td>
                        <td className={cn(table.cell, 'font-medium')}>{service.service_name}</td>
                        <td className={table.cell}>{service.owner}</td>
                        <td className={cn(table.cell, 'tabular-nums')}>
                          {service.target_source_count}건
                        </td>
                        <td className={cn(table.cell, 'tabular-nums')}>
                          {service.jira_ticket_count > 0 ? (
                            `${service.jira_ticket_count}건`
                          ) : (
                            <span className={pipelineStyles.text.muted}>—</span>
                          )}
                        </td>
                        <td className={table.cell}>
                          <ServiceStatusTag status={service.status} />
                        </td>
                        <td className={cn(table.cell, 'text-right')}>
                          <Link
                            href={href}
                            aria-label={`${service.service_name} 운영 상세로 이동`}
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
          </>
        )}
      </section>
    </div>
  );
}
