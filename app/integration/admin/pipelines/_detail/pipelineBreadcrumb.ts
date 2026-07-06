/**
 * Breadcrumb crumb builders for the target + pipeline detail pages (pure).
 *
 * R20: the svc/svcName query-param nav-context is gone — detail URLs carry only
 * their path id. The target page names its service from the raw target-source
 * detail (`service_name`), and the pipeline breadcrumb goes straight
 * 서비스 검색 › {targetId} › 파이프라인 #{id} (no service crumb).
 */
import { integrationRoutes } from '@/lib/routes';

export interface BreadcrumbCrumb {
  label: string;
  href?: string;
}

/** Target-detail breadcrumb: 서비스 검색 › {svcName} › {targetId}. */
export function targetCrumbs(svcName: string, targetId: string | number): BreadcrumbCrumb[] {
  return [
    { label: '서비스 검색', href: integrationRoutes.pipelines.services },
    { label: svcName },
    { label: String(targetId) },
  ];
}

/** Pipeline-detail breadcrumb: 서비스 검색 › {targetId}(→target) › 파이프라인 #{id}. */
export function pipelineCrumbs(
  pipelineId: string | number,
  targetSourceId: string,
): BreadcrumbCrumb[] {
  return [
    { label: '서비스 검색', href: integrationRoutes.pipelines.services },
    { label: targetSourceId, href: integrationRoutes.pipelines.target(targetSourceId) },
    { label: `파이프라인 #${pipelineId}` },
  ];
}
