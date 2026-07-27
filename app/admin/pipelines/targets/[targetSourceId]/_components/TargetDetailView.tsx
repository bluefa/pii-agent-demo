'use client';

/**
 * Target detail (C2-a) — R24 redesign (Figma SzifNRYweRXhiIDI0uyK3R node 9-2).
 * Layout: h1 + CSP front-matter strip (R21 §C1 kept) → 현재 작업 + 작업 이력
 * (extracted to the shared TargetPipelineSections so the ops console 인프라 작업
 * tab renders the same experience). Raw target-source detail (CSP metadata)
 * comes from the reused BFF route via getRawTargetSourceDetail (getProject
 * drops those fields).
 */
import { Fragment, useEffect, useState, type ReactElement } from 'react';
import { useParams } from 'next/navigation';
import { cn, pipelineStyles } from '@/lib/theme';
import { Card } from '@/app/admin/pipelines/_components/Card';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { PlBreadcrumb } from '@/app/admin/pipelines/_components/PlBreadcrumb';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { detailStyles } from '@/app/admin/pipelines/_detail/detailStyles';
import { targetCrumbs } from '@/app/admin/pipelines/_detail/pipelineBreadcrumb';
import { TargetPipelineSections } from '@/app/admin/pipelines/_detail/TargetPipelineSections';
import { providerAccentVar, providerKey, providerLabel } from '@/lib/pipeline/format';
import {
  getRawTargetSourceDetail,
  type RawTargetSourceDetail,
} from '@/app/lib/api/pipeline-target';

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
  return (byProvider[provider] ?? [])
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => ({ k, v: String(v) }));
}

/** Install method → self-labelling chip text (수동/자동 설치), or null if unset. */
function installTagLabel(raw: RawTargetSourceDetail | null): string | null {
  const perm = raw?.metadata?.grant_service_terraform_execution_permission;
  return perm == null ? null : perm ? '자동 설치' : '수동 설치';
}

export function TargetDetailView(): ReactElement {
  const params = useParams<{ targetSourceId: string }>();
  const targetSourceId = String(params.targetSourceId);
  const { text } = pipelineStyles;
  const fm = detailStyles.frontMeta;

  const [raw, setRaw] = useState<RawTargetSourceDetail | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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

  // An SDU account is surfaced as SDU regardless of its underlying CSP
  // (metadata.is_sdu_type wins over cloud_provider — owner call): SDU has no
  // CSP metadata rows and no orchestrator wire provider (Custom stays disabled).
  const provider = raw.metadata?.is_sdu_type ? 'sdu' : providerKey(raw.cloud_provider ?? '');
  const serviceCode = raw.service_code ?? '';
  const svcName = raw.service_name || serviceCode || targetSourceId;
  const metaRows = cspMetaRows(provider, raw);
  const installTag = installTagLabel(raw);

  return (
    <div>
      <PlBreadcrumb crumbs={targetCrumbs(svcName, targetSourceId)} />

      {/* Page head — title only. R24: the start CTA lives in the 현재 작업
          empty card (and its modal), not a top-right header button. */}
      <h1 className={text.pageTitle}>
        {svcName} <span className={cn(text.muted, 'font-normal')}>({serviceCode})</span>
      </h1>

      {/* R21 §C1 — metadata as a front-matter strip: reference info, not the hero.
          Stays on one line (flex-nowrap); scrolls horizontally when it can't fit. */}
      <div className={cn(fm.strip, 'overflow-x-auto')}>
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
        {installTag && (
          <>
            <span className={fm.sep} aria-hidden="true" />
            <span className={fm.tag}>{installTag}</span>
          </>
        )}
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

      <TargetPipelineSections targetSourceId={targetSourceId} raw={raw} />
    </div>
  );
}
