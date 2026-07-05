/**
 * Breadcrumb crumb builders for the target + pipeline detail pages (pure).
 *
 * design-inventory §1:
 *  - Target page:  서비스 검색(→services) › {svcName}(inert) › {targetId}(cur)
 *  - Pipeline page: 서비스 검색 › [{svcName}(inert) › ] {targetId}(→target) › 파이프라인 #{id}(cur)
 *
 * CONTRACT GAP (reported): the prototype shows the svcName crumb only when
 * `navState.serviceCode !== null && navState.targetId === p.target_source_id`.
 * The App-Router nav-context (lib/pipeline/format) carries only `svc`/`svcName`
 * as query params — there is no `target` param and threading one would diverge
 * from that SSOT and would not cover the other agent's links. So the
 * degraded rule here is: show the svcName crumb whenever `svc` is present. The
 * target-id match guard is intentionally dropped (documented, not silent).
 */
import { integrationRoutes } from '@/lib/routes';
import { buildTargetHref, type PipelineNavContext } from '@/lib/pipeline/format';

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

/**
 * Pipeline-detail breadcrumb. `ctx.svc` present (non-empty) ⇒ include the inert
 * svcName crumb (label = ctx.svcName || ctx.svc). The target crumb links back to
 * the target page carrying the same nav-context.
 */
export function pipelineCrumbs(
  ctx: PipelineNavContext,
  pipelineId: string | number,
  targetSourceId: string,
): BreadcrumbCrumb[] {
  const crumbs: BreadcrumbCrumb[] = [
    { label: '서비스 검색', href: integrationRoutes.pipelines.services },
  ];
  const hasSvc = ctx.svc != null && ctx.svc !== '';
  if (hasSvc) crumbs.push({ label: ctx.svcName || (ctx.svc as string) });
  crumbs.push({ label: targetSourceId, href: buildTargetHref(targetSourceId, ctx) });
  crumbs.push({ label: `파이프라인 #${pipelineId}` });
  return crumbs;
}
