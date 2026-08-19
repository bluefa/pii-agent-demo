'use client';

/**
 * Ops masthead (design-benchmark `ops-detail-ia-redesign.md`, R1) — the old
 * five-tier identity stack compressed to two lines on one gray-100 wash:
 * breadcrumb (서비스 운영 / 서비스 이름 / #id) and the identity line (provider
 * mark + "{provider} #{id}" h1 + step pill + first-install stamp + the
 * service-side link at the far edge). Everything else the header used to stack —
 * service code, Jira ticket, account/region, install mode, role ARNs, 실데이터 —
 * lives in the meta rail (OpsMetaRail) so it reads as metadata, not as headline.
 */
import Link from 'next/link';
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { displayProvider, providerLabel } from '@/lib/pipeline/format';
import { normalizeCloudProvider } from '@/lib/types';
import { ProviderGlyph } from '@/app/components/ui/CloudProviderIcon';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import type { ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';
import { StepPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/StepPill';
import { CompletedStamp } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/CompletedStamp';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

export interface OpsHeaderProps {
  targetSourceId: number;
  detail: RawTargetSourceDetail;
  processStatus: ProcessStatus | null;
}

export function OpsHeader({ targetSourceId, detail, processStatus }: OpsHeaderProps): ReactElement {
  const { button } = pipelineStyles;
  const provider = providerLabel(displayProvider(detail.cloud_provider, detail.metadata?.is_sdu_type));
  return (
    <>
      {/* The service is the container this target lives in, so it is the path,
          not a side block: the first crumb goes to its ops screen when we know
          the code, and the target id closes the path as "you are here". */}
      <nav className={opsStyles.crumb} aria-label="현재 위치">
        {detail.service_code ? (
          <Link
            href={passRoutes.pipelines.ops.service(detail.service_code)}
            className={opsStyles.crumbLink}
            title={`서비스 ${detail.service_code} 운영`}
          >
            서비스 운영
          </Link>
        ) : (
          <span>서비스 운영</span>
        )}
        <span className={opsStyles.crumbSep}>/</span>
        <span className="max-w-[280px] truncate" title={detail.service_name ?? undefined}>
          {detail.service_name ?? '-'}
        </span>
        <span className={opsStyles.crumbSep}>/</span>
        <span className={opsStyles.crumbHere}>#{targetSourceId}</span>
      </nav>

      <div className={opsStyles.idLine}>
        <ProviderGlyph
          provider={normalizeCloudProvider(detail.cloud_provider)}
          isSdu={detail.metadata?.is_sdu_type === true}
          className="h-6 w-6 flex-none text-[var(--pl-text-medium)]"
        />
        {/* The subject IS the title — the fixed page label went into the crumb's
            first segment, so the h1 can finally say which target is open. */}
        <h1 className={opsStyles.idTitle}>
          {provider} <span className={opsStyles.idHash}>#</span>
          <span className="tabular-nums">{targetSourceId}</span>
        </h1>
        {processStatus && <StepPill status={processStatus} />}
        {/* 도장과 알약은 다른 축이다: 알약은 "지금 어디", 도장은 "최초로 마친 적
            있다 · 언제". 초기화된 대상은 둘이 같이 보이는 것이 말해야 하는 사실이다. */}
        <CompletedStamp firstInstalledAt={detail.pii_agent_first_installed_at} size="md" />
        <span className="flex-1" aria-hidden />
        {/* 같은 대상의 서비스측 화면 — 운영자가 "담당자한테는 지금 뭐가 보이나"를
            묻는 자리가 여기뿐이다. */}
        <Link
          href={passRoutes.targetSource(targetSourceId)}
          className={cn(button.base, button.sm, button.secondary, 'hover:bg-[var(--pl-gray-50)]')}
          title="PII Agent 설치 화면 — 서비스 담당자가 보는 진행 화면"
        >
          서비스가 보는 화면 <Icon name="arrow-ur" size="sm" />
        </Link>
      </div>
    </>
  );
}
