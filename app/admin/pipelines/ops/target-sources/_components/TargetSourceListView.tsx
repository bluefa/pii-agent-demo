'use client';

/**
 * Target Source 운영 목록 — search a Target Source and jump to its ops screen
 * (design/pipeline/admin-ops.html `renderTsSearch()`, restyled to the ops
 * grammar). Search is server-side (query param); the pager is 0-based.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { cn, pipelineStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { fmtDateTime } from '@/lib/pipeline/format';
import { getOpsTargetSources, type OpsTargetSourceListItem } from '@/app/lib/api/ops';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { SearchBox } from '@/app/admin/pipelines/_components/SearchBox';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import { StepPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/StepPill';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

const dbTag =
  'inline-flex items-center rounded px-2 py-0.5 text-[12px] font-semibold bg-[var(--pl-info-bg)] text-[var(--pl-info-text)] whitespace-nowrap';

export function TargetSourceListView(): ReactElement {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<OpsTargetSourceListItem[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);
  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  // Debounce keystrokes into the fetched query; a new query restarts at page 0.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(input.trim());
      setPage(0);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    (async () => {
      try {
        const data = await getOpsTargetSources(query || undefined, page, PAGE_SIZE);
        if (cancelled) return;
        setRows(data.content ?? []);
        setTotalElements(data.totalElements ?? 0);
        setTotalPages(Math.max(1, data.totalPages ?? 1));
      } catch {
        if (cancelled) return;
        setRows([]);
        setTotalElements(0);
        setTotalPages(1);
        setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query, page, reloadKey]);

  return (
    <div>
      <h1 className={cn(pipelineStyles.text.pageTitle, 'mb-1.5')}>Target Source 운영</h1>
      <p className={cn(pipelineStyles.text.sectionDesc, 'mb-6')}>
        Target Source ID 또는 ServiceCode로 검색해 단건 운영 화면으로 이동합니다.
      </p>

      <section className={pipelineStyles.card.base} aria-label="Target Source 검색">
        <div className={pipelineStyles.filterBar}>
          <SearchBox
            wrapClassName="w-[320px]"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Target Source ID · ServiceCode · 서비스명"
            aria-label="Target Source 검색"
          />
          <span className={cn(pipelineStyles.text.meta, 'ml-auto')}>{totalElements}건</span>
        </div>

        {failed ? (
          <div className={cn(pipelineStyles.empty.base, 'mt-2')}>
            <p>Target Source 목록을 불러오지 못했습니다.</p>
            <PlButton variant="secondary" className="mt-3" onClick={retry}>
              다시 시도
            </PlButton>
          </div>
        ) : loading ? (
          <p className={cn(pipelineStyles.empty.base, 'mt-2')} aria-busy>
            불러오는 중…
          </p>
        ) : rows.length === 0 ? (
          <p className={cn(pipelineStyles.empty.base, 'mt-2')}>검색 결과가 없습니다.</p>
        ) : (
          <>
            <div className={cn(pipelineStyles.card.tableWrap, 'mt-3')}>
              <table className={opsStyles.table.base}>
                <thead>
                  <tr>
                    <th className={opsStyles.table.headCell}>ID</th>
                    <th className={opsStyles.table.headCell}>서비스</th>
                    <th className={opsStyles.table.headCell}>Provider</th>
                    <th className={opsStyles.table.headCell}>DB</th>
                    <th className={opsStyles.table.headCell}>현재 단계</th>
                    <th className={opsStyles.table.headCell}>마지막 변경</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.target_source_id}
                      // `relative` carries the stretched row link below.
                      className={cn(opsStyles.table.rowHover, 'relative cursor-pointer')}
                    >
                      <td className={cn(opsStyles.table.cell, 'whitespace-nowrap')}>
                        <Link
                          href={passRoutes.pipelines.ops.targetSource(String(row.target_source_id))}
                          aria-label={`Target Source ${row.target_source_id} 운영 화면으로 이동`}
                          className="absolute inset-0"
                        />
                        <span className={pipelineStyles.table.mono}>#{row.target_source_id}</span>
                      </td>
                      <td className={opsStyles.table.cell}>
                        <span className="font-medium">{row.service_name}</span>{' '}
                        <span className={pipelineStyles.text.meta}>{row.service_code}</span>
                      </td>
                      <td className={opsStyles.table.cell}>
                        <ProvTag provider={row.cloud_provider} isSdu={row.is_sdu_type} />
                      </td>
                      <td className={opsStyles.table.cell}>
                        {row.database_type ? (
                          <span className={dbTag}>{row.database_type}</span>
                        ) : (
                          <span className={pipelineStyles.text.muted}>—</span>
                        )}
                      </td>
                      <td className={cn(opsStyles.table.cell, 'whitespace-nowrap')}>
                        <StepPill status={row.process_status} />
                      </td>
                      <td
                        className={cn(
                          opsStyles.table.cell,
                          'whitespace-nowrap text-[var(--pl-text-medium)] tabular-nums',
                        )}
                      >
                        {fmtDateTime(row.last_changed_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <OpsPagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </section>
    </div>
  );
}
