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

/** Pipeline-detail breadcrumb: 서비스 검색 › {targetId}(→target) › 작업 #{id}. */
export function pipelineCrumbs(
  pipelineId: string | number,
  targetSourceId: string,
): BreadcrumbCrumb[] {
  return [
    { label: '서비스 검색', href: passRoutes.pipelines.services },
    { label: targetSourceId, href: passRoutes.pipelines.target(targetSourceId) },
    { label: `작업 #${pipelineId}` },
  ];
}
