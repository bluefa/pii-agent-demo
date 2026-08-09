/**
 * Breadcrumb crumb builders for the target + pipeline detail pages (pure).
 *
 * R20: the svc/svcName query-param nav-context is gone — detail URLs carry only
 * their path id. The target page names its service from the raw target-source
 * detail (`service_name`), and the pipeline breadcrumb goes straight
 * 서비스 검색 › {targetId} › 작업 #{id} (no service crumb).
 */
import { passRoutes } from '@/lib/routes';

export interface BreadcrumbCrumb {
  label: string;
  href?: string;
}

/** Target-detail breadcrumb: 서비스 검색 › {svcName} › {targetId}. */
export function targetCrumbs(svcName: string, targetId: string | number): BreadcrumbCrumb[] {
  return [
    { label: '서비스 검색', href: passRoutes.pipelines.services },
    { label: svcName },
    { label: String(targetId) },
  ];
}

/** Pipeline-detail breadcrumb: 대시보드 › {targetId}(→target) › 작업 #{id}.
 *  The parent list is the pipeline dashboard (the sidebar's 대시보드), not the
 *  services search this helper pointed at before it went unused. */
export function pipelineCrumbs(
  pipelineId: string | number,
  targetSourceId: string,
): BreadcrumbCrumb[] {
  return [
    { label: '대시보드', href: passRoutes.pipelines.dashboard },
    { label: targetSourceId, href: passRoutes.pipelines.ops.targetSource(targetSourceId, 'infra') },
    { label: `작업 #${pipelineId}` },
  ];
}
