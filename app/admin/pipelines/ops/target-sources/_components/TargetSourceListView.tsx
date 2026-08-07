'use client';

/**
 * Target Source 운영 목록 — search a Target Source and jump to its ops screen.
 * Cards, not table rows: the user-side 연동 대상 계정 list moved to this grammar
 * because a row of repeated provider names carries no discriminating power, and
 * the same is true here. The operator's key is the Target Source ID, so unlike
 * the user side it leads the card.
 * Search is server-side (query param); the pager is 0-based.
 */
import { useCallback, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import Link from 'next/link';
import { cn, pipelineStyles } from '@/lib/theme';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { passRoutes } from '@/lib/routes';
import { fmtDateTime } from '@/lib/pipeline/format';
import { getOpsTargetSources, type OpsTargetSourceListItem } from '@/app/lib/api/ops';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { SearchBox } from '@/app/admin/pipelines/_components/SearchBox';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import { ProviderLogo } from '@/app/components/features/admin/v7';
import { StepPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/StepPill';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import type { CloudProvider } from '@/lib/types';

// A card is roughly three table rows tall, so the page holds fewer of them —
// twenty would be a 2500px scroll before the pager came into view.
const PAGE_SIZE = 10;
const DEBOUNCE_MS = 300;

const dbTag =
  'inline-flex items-center rounded px-2 py-0.5 text-[12px] font-semibold bg-[var(--pl-info-bg)] text-[var(--pl-info-text)] whitespace-nowrap';

const card =
  'group relative flex items-start gap-3.5 rounded-[12px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] px-[21px] py-[19px] cursor-pointer transition-colors hover:bg-[var(--pl-gray-50)]';

/** The operator's key — mono so ids of different lengths still line up down the list. */
const idText =
  'text-[16px] font-bold [font-family:var(--pl-font-mono)] text-[var(--pl-text-strong)] transition-colors group-hover:text-[var(--pl-primary)]';

const metaLabel = 'text-[12px] text-[var(--pl-text-weak)]';
const metaValue = 'text-[14px] text-[var(--pl-text-medium)]';

/** Grey until the cursor is on the card — one blue link per row would out-shout the page. */
const goLink =
  'whitespace-nowrap text-[14px] font-semibold text-[var(--pl-text-weak)] underline-offset-[3px] transition-colors group-hover:text-[var(--pl-primary)] group-hover:underline';

/** metadata → the one account identifier this provider actually has. IDC·SDU have none. */
function accountOf(target: OpsTargetSourceListItem): { label: string; value: string } | null {
  const { aws_account_id, subscription_id, gcp_project_id } = target.metadata;
  if (aws_account_id) return { label: 'AWS Account', value: aws_account_id };
  if (subscription_id) return { label: 'Azure Subscription', value: subscription_id };
  if (gcp_project_id) return { label: 'GCP Project', value: gcp_project_id };
  return null;
}

function MetaPair({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <span className="flex items-center gap-1.5">
      <span className={metaLabel}>{label}</span>
      {children}
    </span>
  );
}

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
            <div className="mt-3 flex flex-col gap-3.5">
              {rows.map((row) => {
                const account = accountOf(row);
                return (
                  <div key={row.target_source_id} className={card}>
                    {/* The stretched link makes the whole card the click target while
                        keeping a real anchor for keyboard and middle-click. */}
                    <Link
                      href={passRoutes.pipelines.ops.targetSource(String(row.target_source_id))}
                      aria-label={`Target Source #${row.target_source_id} 운영 화면으로 이동`}
                      className="absolute inset-0"
                    />
                    <ProviderLogo
                      provider={row.cloud_provider as CloudProvider}
                      isSdu={row.is_sdu_type}
                      variant="bare"
                      className="flex-none"
                    />

                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={idText}>#{row.target_source_id}</span>
                        <ProvTag provider={row.cloud_provider} isSdu={row.is_sdu_type} />
                        <StepPill status={row.process_status} />
                      </div>

                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pl-0.5">
                        <MetaPair label="서비스">
                          <span className="text-[14px] font-medium text-[var(--pl-text-strong)]">
                            {row.service_name}
                          </span>
                          <span className={metaLabel}>{row.service_code}</span>
                        </MetaPair>
                        {account && (
                          <MetaPair label={account.label}>
                            <span
                              className={cn(metaValue, '[font-family:var(--pl-font-mono)]')}
                            >
                              {account.value}
                            </span>
                          </MetaPair>
                        )}
                        {row.database_type && (
                          <MetaPair label="DB">
                            <span className={dbTag}>
                              {getDatabaseShortLabel(row.database_type)}
                            </span>
                          </MetaPair>
                        )}
                        <MetaPair label="마지막 변경">
                          <span className={cn(metaValue, 'tabular-nums')}>
                            {fmtDateTime(row.last_changed_at)}
                          </span>
                        </MetaPair>
                      </div>

                      {row.description && (
                        <div className="flex min-w-0 gap-1.5 pl-0.5">
                          <span className={cn(metaLabel, 'flex-none pt-0.5')}>설명</span>
                          <span className={cn(metaValue, 'truncate')}>{row.description}</span>
                        </div>
                      )}
                    </div>

                    <span className={cn(goLink, 'flex-none pt-0.5')}>운영 화면 ↗</span>
                  </div>
                );
              })}
            </div>
            <OpsPagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </section>
    </div>
  );
}
