import { describe, expect, it } from 'vitest';
import {
  pipelineCrumbs,
  targetCrumbs,
} from '@/app/admin/pipelines/_detail/pipelineBreadcrumb';

describe('targetCrumbs', () => {
  it('서비스 검색(→services) › {svcName}(inert) › {targetId}(cur)', () => {
    const crumbs = targetCrumbs('svc-alpha', '1006');
    expect(crumbs).toHaveLength(3);
    expect(crumbs[0]).toEqual({ label: '서비스 검색', href: '/admin/pipelines/services' });
    expect(crumbs[1]).toEqual({ label: 'svc-alpha' }); // inert (no href)
    expect(crumbs[2]).toEqual({ label: '1006' }); // current (no href)
  });
});

describe('pipelineCrumbs — R20: no query-param nav-context', () => {
  it('서비스 검색 › {targetId}(→target, bare path) › 작업 #{id}(cur)', () => {
    const crumbs = pipelineCrumbs(128, '1006');
    expect(crumbs.map((c) => c.label)).toEqual(['서비스 검색', '1006', '작업 #128']);
    expect(crumbs[1].href).toBe('/admin/pipelines/targets/1006');
    expect(crumbs[2].href).toBeUndefined(); // current is inert
  });
});
