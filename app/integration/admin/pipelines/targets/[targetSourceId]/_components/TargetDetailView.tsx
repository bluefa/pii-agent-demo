'use client';

/**
 * Target detail (C2-a) — design-inventory §2.3. Identity (provider + CSP metadata),
 * latest-run status bar, install/delete action row (gated), and the paged pipeline
 * history. Install/delete open the preview modal; the status-bar 취소 opens the
 * cancel modal. Raw target-source detail (process_status + CSP metadata) comes from
 * the reused BFF route via getRawTargetSourceDetail (getProject drops those fields).
 */
import { Fragment, useCallback, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useModal } from '@/app/hooks/useModal';
import { cn, pipelineStyles } from '@/lib/theme';
import { SectionHeader } from '@/app/integration/admin/pipelines/_components/SectionHeader';
import { Card } from '@/app/integration/admin/pipelines/_components/Card';
import { FilterBar } from '@/app/integration/admin/pipelines/_components/FilterBar';
import { PlButton } from '@/app/integration/admin/pipelines/_components/PlButton';
import { PlBreadcrumb } from '@/app/integration/admin/pipelines/_components/PlBreadcrumb';
import { PlEmptyState } from '@/app/integration/admin/pipelines/_components/PlEmptyState';
import { PlPagination } from '@/app/integration/admin/pipelines/_components/PlPagination';
import { StatusPill } from '@/app/integration/admin/pipelines/_components/StatusPill';
import { PipelineProgressBar } from '@/app/integration/admin/pipelines/_components/PipelineProgressBar';
import { usePlToast } from '@/app/integration/admin/pipelines/_components/usePlToast';
import {
  PlTable,
  PlTh,
  PlRow,
  PlTd,
  PlChevCell,
} from '@/app/integration/admin/pipelines/_components/PlTable';
import { IdentityBar } from '@/app/integration/admin/pipelines/_detail/IdentityBar';
import { PipelineStatusBar } from '@/app/integration/admin/pipelines/_detail/PipelineStatusBar';
import { PreviewModal } from '@/app/integration/admin/pipelines/_detail/PreviewModal';
import { CancelModal } from '@/app/integration/admin/pipelines/_detail/CancelModal';
import { detailStyles } from '@/app/integration/admin/pipelines/_detail/detailStyles';
import { targetButtons } from '@/app/integration/admin/pipelines/_detail/targetButtons';
import { targetCrumbs } from '@/app/integration/admin/pipelines/_detail/pipelineBreadcrumb';
import {
  buildPipelineHref,
  fmtDateTime,
  parsePipelineNavContext,
  providerAccentVar,
  providerKey,
  providerLabel,
  recipeDisplayName,
} from '@/lib/pipeline/format';
import {
  getLatestPipelineByTarget,
  getPipeline,
  getTaskDefinitions,
  listPipelinesByTarget,
} from '@/app/lib/api/pipeline';
import { taskDisplayName } from '@/app/integration/admin/pipelines/_detail/statusModel';
import {
  getRawTargetSourceDetail,
  type RawTargetSourceDetail,
} from '@/app/lib/api/pipeline-target';
import type { PipelineDetail, PipelineType, SpringPage, PipelineSummary, TaskSummary } from '@/lib/pipeline/types';

const HISTORY_SIZE = 5;

interface MetaRow {
  k: string;
  v: string;
}
interface MetaGroup {
  label: string;
  rows: MetaRow[];
  empty: string | null;
}

/** CSP metadata → logical groups (design cspMetaGroups; null rows filtered). */
function cspMetaGroups(provider: string, raw: RawTargetSourceDetail | null): MetaGroup[] {
  const m = raw?.metadata ?? {};
  const region = m.is_china_region != null ? (m.is_china_region ? 'China' : 'Global') : null;
  const byProvider: Record<string, Array<[string, string | null | undefined]>> = {
    aws: [
      ['AWS Account', m.aws_account_id],
      ['Region Type', region],
    ],
    azure: [
      ['Tenant ID', m.tenant_id],
      ['Subscription ID', m.subscription_id],
    ],
    gcp: [['GCP Project', m.gcp_project_id]],
  };
  const rows = (byProvider[provider] ?? [])
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => ({ k, v: String(v) }));
  const groups: MetaGroup[] = [
    { label: 'CSP 연결 정보', rows, empty: '이 CSP 유형은 연결 metadata가 없습니다' },
  ];
  if (m.grant_service_terraform_execution_permission != null) {
    groups.push({
      label: '실행 권한',
      rows: [{ k: 'TF 실행 권한', v: m.grant_service_terraform_execution_permission ? '허용' : '미허용' }],
      empty: null,
    });
  }
  return groups;
}

export function TargetDetailView(): ReactElement {
  const router = useRouter();
  const params = useParams<{ targetSourceId: string }>();
  const searchParams = useSearchParams();
  const targetSourceId = String(params.targetSourceId);
  const ctx = parsePipelineNavContext(searchParams);
  const toast = usePlToast();
  const { text } = pipelineStyles;
  const idbarStyles = detailStyles.idbar;

  const [raw, setRaw] = useState<RawTargetSourceDetail | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);
  const [latestDetail, setLatestDetail] = useState<PipelineDetail | null>(null);
  const [latestChecked, setLatestChecked] = useState(false);
  const [history, setHistory] = useState<SpringPage<PipelineSummary> | null>(null);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  // Repo rule: modal open/close flows go through useModal (payload rides `data`).
  const previewModal = useModal<PipelineType>();
  const cancelModal = useModal<number>();
  const [catalog, setCatalog] = useState<ReadonlyMap<string, string> | null>(null);

  // Task-definition catalog — display names for the status bar's sb-cur label.
  useEffect(() => {
    let cancelled = false;
    getTaskDefinitions()
      .then((res) => {
        if (cancelled) return;
        setCatalog(new Map(res.task_definitions.map((d) => [d.name, d.display_name])));
      })
      .catch(() => {
        /* enum fallback via taskDisplayName */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Raw detail + latest run (+ its full detail).
  useEffect(() => {
    let cancelled = false;
    setRaw(null);
    setRawError(null);
    setLatestChecked(false);
    setLatestDetail(null);
    getRawTargetSourceDetail(targetSourceId)
      .then((d) => !cancelled && setRaw(d))
      .catch((e: unknown) => !cancelled && setRawError(e instanceof Error ? e.message : '불러오기 실패'));
    (async () => {
      try {
        const summary = await getLatestPipelineByTarget(targetSourceId);
        if (cancelled) return;
        if (summary) {
          const detail = await getPipeline(summary.pipeline_id);
          if (!cancelled) setLatestDetail(detail);
        }
      } catch {
        /* leave latestDetail null — status bar shows the empty state */
      } finally {
        if (!cancelled) setLatestChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetSourceId, reloadKey]);

  // History page (server pagination; 5/page).
  useEffect(() => {
    let cancelled = false;
    listPipelinesByTarget(targetSourceId, { page: page - 1, size: HISTORY_SIZE })
      .then((p) => !cancelled && setHistory(p))
      .catch(() => !cancelled && setHistory(null));
    return () => {
      cancelled = true;
    };
  }, [targetSourceId, page, reloadKey]);

  const goPipeline = useCallback(
    (id: number) => router.push(buildPipelineHref(id, ctx)),
    // ctx is derived from searchParams each render; depend on the stable href inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, ctx.svc, ctx.svcName],
  );

  if (rawError) {
    return (
      <Card>
        <PlEmptyState icon="inbox" message="대상 정보를 불러오지 못했습니다" center />
        <div className="flex justify-center">
          <PlButton variant="secondary" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
            재시도
          </PlButton>
        </div>
      </Card>
    );
  }

  if (!raw) {
    return <div className={cn(detailStyles.skeleton, 'h-40')} aria-hidden="true" />;
  }

  const provider = providerKey(raw.cloud_provider);
  const serviceCode = raw.service_code ?? '';
  const svcName = ctx.svcName || raw.service_name || serviceCode || targetSourceId;
  const groups = cspMetaGroups(provider, raw);

  const activeRunId =
    latestDetail && (latestDetail.status === 'RUNNING' || latestDetail.status === 'PENDING')
      ? latestDetail.pipeline_id
      : null;
  const btns = targetButtons(raw.process_status, activeRunId);

  const resolveTargetTaskName = (t: TaskSummary): string => taskDisplayName(t, null, catalog);

  const metaNode: ReactNode = (
    <div className={idbarStyles.metaRow}>
      {groups.map((g, i) => (
        <Fragment key={g.label}>
          {i > 0 && <span className={idbarStyles.div} aria-hidden="true" />}
          <div className={idbarStyles.mgroup}>
            <div className={idbarStyles.mgLabel}>{g.label}</div>
            {g.rows.length ? (
              <div className={detailStyles.kv.wide}>
                {g.rows.map((r) => (
                  <Fragment key={r.k}>
                    <div className={detailStyles.kv.k}>{r.k}</div>
                    <div className={detailStyles.kv.vMono}>{r.v}</div>
                  </Fragment>
                ))}
              </div>
            ) : (
              <div className={idbarStyles.mgEmpty}>{g.empty}</div>
            )}
          </div>
        </Fragment>
      ))}
    </div>
  );

  const totalElements = history?.totalElements ?? 0;
  const totalPages = history?.totalPages ?? 1;
  const rows = history?.content ?? [];

  return (
    <div>
      <PlBreadcrumb crumbs={targetCrumbs(svcName, targetSourceId)} />
      <div className="mb-6">
        <h1 className={text.pageTitle}>
          {svcName} <span className={cn(text.muted, 'font-normal')}>({serviceCode})</span>
        </h1>
      </div>

      <IdentityBar
        accentVar={providerAccentVar(provider)}
        icon="cloud"
        pname={providerLabel(provider)}
        psub={provider === 'idc' ? undefined : 'Cloud Provider'}
        fields={[{ key: 'TargetSourceId', value: targetSourceId }]}
        meta={metaNode}
      />

      <SectionHeader
        title="파이프라인 상태"
        desc="이 대상의 현재 상태 — 할 수 있는 액션은 상태에서 결정됩니다"
      />
      {latestDetail ? (
        <PipelineStatusBar
          detail={latestDetail}
          variant="target"
          resolveName={resolveTargetTaskName}
          onCancel={() => cancelModal.open(latestDetail.pipeline_id)}
          openHref={buildPipelineHref(latestDetail.pipeline_id, ctx)}
        />
      ) : latestChecked ? (
        <Card>
          <PlEmptyState
            icon="inbox"
            message="실행 이력 없음"
            meta="[설치 시작]으로 첫 파이프라인을 만드세요"
          />
        </Card>
      ) : (
        <div className={cn(detailStyles.skeleton, 'h-20')} aria-hidden="true" />
      )}

      <FilterBar className="mt-3">
        <PlButton
          variant="primary"
          disabled={!btns.install}
          title={btns.installTitle}
          onClick={() => previewModal.open('INSTALL')}
        >
          설치 시작
        </PlButton>
        <PlButton
          variant="secondary"
          disabled={!btns.delete}
          title={btns.deleteTitle}
          onClick={() => previewModal.open('DELETE')}
        >
          삭제 시작
        </PlButton>
        <span className={cn(text.meta, 'ml-auto')}>{btns.lockMsg}</span>
      </FilterBar>

      <SectionHeader
        title="파이프라인 이력"
        desc={`이 대상에서 실행된 파이프라인 전체 ${totalElements}건 · 최신순`}
      />
      <Card>
        {rows.length ? (
          <>
            <PlTable
              head={
                <>
                  <PlTh>#</PlTh>
                  <PlTh>파이프라인 유형</PlTh>
                  <PlTh>레시피</PlTh>
                  <PlTh>상태</PlTh>
                  <PlTh>진행도</PlTh>
                  <PlTh>생성시간</PlTh>
                  <PlTh />
                </>
              }
            >
              {rows.map((p) => (
                <PlRow key={p.pipeline_id} onActivate={() => goPipeline(p.pipeline_id)}>
                  <PlTd mono>#{p.pipeline_id}</PlTd>
                  <PlTd>{p.type}</PlTd>
                  <PlTd>
                    <span title={p.recipe_definition ?? ''}>{recipeDisplayName(p.recipe_definition)}</span>
                  </PlTd>
                  <PlTd>
                    <StatusPill status={p.status} />
                  </PlTd>
                  <PlTd>
                    <PipelineProgressBar n={p.done_task_count} m={p.total_task_count} status={p.status} />
                  </PlTd>
                  <PlTd muted>{fmtDateTime(p.created_at)}</PlTd>
                  <PlChevCell title="파이프라인 상세로 이동" />
                </PlRow>
              ))}
            </PlTable>
            {totalPages > 1 && (
              <PlPagination
                page={page}
                pages={totalPages}
                onPrev={() => setPage((n) => Math.max(1, n - 1))}
                onNext={() => setPage((n) => Math.min(totalPages, n + 1))}
              />
            )}
          </>
        ) : (
          <PlEmptyState icon="inbox" message="파이프라인 이력이 없어요" />
        )}
      </Card>

      <PreviewModal
        open={previewModal.isOpen}
        onClose={previewModal.close}
        targetSourceId={targetSourceId}
        type={previewModal.data ?? 'INSTALL'}
        providerLabel={providerLabel(provider)}
        ctx={ctx}
        showToast={toast.show}
      />
      <CancelModal
        open={cancelModal.isOpen}
        onClose={cancelModal.close}
        pipelineId={cancelModal.data ?? 0}
        onCancelled={(detail) => {
          setLatestDetail(detail);
          setReloadKey((k) => k + 1);
        }}
        showToast={toast.show}
      />
    </div>
  );
}
