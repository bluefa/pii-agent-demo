'use client';

/**
 * Target detail (C2-a) — R21 (r21-cta-lab A1+C1, owner-picked): the CSP
 * metadata is a front-matter STRIP under the h1 (12px reference line, not the
 * old IdentityBar card), and the action row is ONE primary CTA [파이프라인
 * 시작] — the type choice (설치/삭제/Custom) lives inside PreviewModal step 1.
 * Below: the paged pipeline history (R20: the history table's top row IS the
 * latest run; run-level actions live on the pipeline page). Raw target-source
 * detail (process_status + CSP metadata) comes from the reused BFF route via
 * getRawTargetSourceDetail (getProject drops those fields).
 */
import { Fragment, useCallback, useEffect, useState, type ReactElement } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useModal } from '@/app/hooks/useModal';
import { cn, pipelineStyles } from '@/lib/theme';
import { SectionHeader } from '@/app/integration/admin/pipelines/_components/SectionHeader';
import { Card } from '@/app/integration/admin/pipelines/_components/Card';
import { PlButton } from '@/app/integration/admin/pipelines/_components/PlButton';
import { Icon } from '@/app/integration/admin/pipelines/_components/icons';
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
import { PreviewModal } from '@/app/integration/admin/pipelines/_detail/PreviewModal';
import { detailStyles } from '@/app/integration/admin/pipelines/_detail/detailStyles';
import { targetCrumbs } from '@/app/integration/admin/pipelines/_detail/pipelineBreadcrumb';
import { PipelineTypeTag } from '@/app/integration/admin/pipelines/_components/PipelineTypeTag';
import { integrationRoutes } from '@/lib/routes';
import {
  fmtDateTime,
  providerAccentVar,
  providerKey,
  providerLabel,
  recipeDisplayName,
} from '@/lib/pipeline/format';
import { listPipelinesByTarget } from '@/app/lib/api/pipeline';
import {
  getRawTargetSourceDetail,
  type RawTargetSourceDetail,
} from '@/app/lib/api/pipeline-target';
import type { SpringPage, PipelineSummary } from '@/lib/pipeline/types';

const HISTORY_SIZE = 5;

interface MetaRow {
  k: string;
  v: string;
}

/** CSP metadata → flat front-matter rows (null values filtered; R21 §C1). */
function cspMetaRows(provider: string, raw: RawTargetSourceDetail | null): MetaRow[] {
  const m = raw?.metadata ?? {};
  const region = m.is_china_region != null ? (m.is_china_region ? 'China' : 'Global') : null;
  const byProvider: Record<string, Array<[string, string | null | undefined]>> = {
    aws: [
      ['Account', m.aws_account_id],
      ['Region', region],
    ],
    azure: [
      ['Tenant', m.tenant_id],
      ['Subscription', m.subscription_id],
    ],
    gcp: [['Project', m.gcp_project_id]],
  };
  const rows = (byProvider[provider] ?? [])
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => ({ k, v: String(v) }));
  if (m.grant_service_terraform_execution_permission != null) {
    rows.push({ k: 'TF 실행 권한', v: m.grant_service_terraform_execution_permission ? '허용' : '미허용' });
  }
  return rows;
}

export function TargetDetailView(): ReactElement {
  const router = useRouter();
  const params = useParams<{ targetSourceId: string }>();
  const targetSourceId = String(params.targetSourceId);
  const toast = usePlToast();
  const { text } = pipelineStyles;
  const fm = detailStyles.frontMeta;

  const [raw, setRaw] = useState<RawTargetSourceDetail | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);
  const [history, setHistory] = useState<SpringPage<PipelineSummary> | null>(null);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  // Repo rule: modal open/close flows go through useModal. R21 §A1 — the type
  // choice happens INSIDE the modal, so there is no payload to ride.
  const previewModal = useModal();

  // Raw detail (identity strip + CSP metadata).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRaw(null);
      setRawError(null);
      try {
        const d = await getRawTargetSourceDetail(targetSourceId);
        if (!cancelled) setRaw(d);
      } catch (e: unknown) {
        if (!cancelled) setRawError(e instanceof Error ? e.message : '불러오기 실패');
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
    (id: number) => router.push(integrationRoutes.pipelines.pipeline(id)),
    [router],
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
  const svcName = raw.service_name || serviceCode || targetSourceId;
  const metaRows = cspMetaRows(provider, raw);

  const totalElements = history?.totalElements ?? 0;
  const totalPages = history?.totalPages ?? 1;
  const rows = history?.content ?? [];

  return (
    <div>
      <PlBreadcrumb crumbs={targetCrumbs(svcName, targetSourceId)} />
      <h1 className={text.pageTitle}>
        {svcName} <span className={cn(text.muted, 'font-normal')}>({serviceCode})</span>
      </h1>

      {/* R21 §C1 — metadata as a front-matter strip: reference info, not the hero. */}
      <div className={fm.strip}>
        <span className={fm.item}>
          <span style={{ color: `var(${providerAccentVar(provider)})` }} className="inline-flex">
            <Icon name="cloud" size="sm" />
          </span>
          <span className={fm.strong}>{providerLabel(provider)}</span>
        </span>
        <span className={fm.sep} aria-hidden="true" />
        <span className={fm.item}>
          <span className={fm.k}>TargetSourceId</span>
          <span className={cn(fm.strong, 'tabular-nums')}>{targetSourceId}</span>
        </span>
        {metaRows.map((r) => (
          <Fragment key={r.k}>
            <span className={fm.sep} aria-hidden="true" />
            <span className={fm.item}>
              <span className={fm.k}>{r.k}</span>
              {r.v}
            </span>
          </Fragment>
        ))}
      </div>

      {/* R21 §A1 — ONE primary CTA; the type choice lives in the modal. */}
      <PlButton
        variant="primary"
        title="파이프라인 유형을 선택해 시작합니다"
        onClick={() => previewModal.open()}
      >
        <Icon name="play" size="sm" />
        파이프라인 시작
      </PlButton>

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
                  <PlTd>
                    <PipelineTypeTag type={p.type} />
                  </PlTd>
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
            {/* R20 — always visible so the history reads as a paged list. */}
            <PlPagination
              page={page}
              pages={totalPages}
              onPrev={() => setPage((n) => Math.max(1, n - 1))}
              onNext={() => setPage((n) => Math.min(totalPages, n + 1))}
            />
          </>
        ) : (
          <PlEmptyState icon="inbox" message="파이프라인 이력이 없어요" />
        )}
      </Card>

      <PreviewModal
        open={previewModal.isOpen}
        onClose={previewModal.close}
        targetSourceId={targetSourceId}
        providerLabel={providerLabel(provider)}
        showToast={toast.show}
      />
    </div>
  );
}
