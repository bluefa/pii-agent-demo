import { describe, expect, it } from 'vitest';
import {
  pipelineCrumbs,
  targetCrumbs,
} from '@/app/integration/admin/pipelines/_detail/pipelineBreadcrumb';

describe('targetCrumbs', () => {
  it('서비스 검색(→services) › {svcName}(inert) › {targetId}(cur)', () => {
    const crumbs = targetCrumbs('svc-alpha', '1006');
    expect(crumbs).toHaveLength(3);
    expect(crumbs[0]).toEqual({ label: '서비스 검색', href: '/integration/admin/pipelines/services' });
    expect(crumbs[1]).toEqual({ label: 'svc-alpha' }); // inert (no href)
    expect(crumbs[2]).toEqual({ label: '1006' }); // current (no href)
  });
});

describe('pipelineCrumbs — nav-context rules', () => {
  it('omits the svcName crumb when svc is absent', () => {
    const crumbs = pipelineCrumbs({ svc: null, svcName: null }, 128, '1006');
    expect(crumbs.map((c) => c.label)).toEqual(['서비스 검색', '1006', '파이프라인 #128']);
    // target crumb links back to the target page (no nav-context appended).
    expect(crumbs[1].href).toBe('/integration/admin/pipelines/targets/1006');
    expect(crumbs[2].href).toBeUndefined(); // current is inert
  });

  it('includes the svcName crumb (label = svcName) when svc is present', () => {
    const crumbs = pipelineCrumbs({ svc: 'SVC001', svcName: 'svc-alpha' }, 128, '1006');
    expect(crumbs.map((c) => c.label)).toEqual([
      '서비스 검색',
      'svc-alpha',
      '1006',
      '파이프라인 #128',
    ]);
    // target crumb carries the nav-context forward as query params.
    expect(crumbs[2].href).toBe(
      '/integration/admin/pipelines/targets/1006?svc=SVC001&svcName=svc-alpha',
    );
  });

  it('falls back to svc code as the crumb label when svcName is empty', () => {
    const crumbs = pipelineCrumbs({ svc: 'SVC001', svcName: null }, 5, '1006');
    expect(crumbs[1].label).toBe('SVC001');
  });

  it('treats an empty-string svc as absent', () => {
    const crumbs = pipelineCrumbs({ svc: '', svcName: '' }, 5, '1006');
    expect(crumbs.map((c) => c.label)).toEqual(['서비스 검색', '1006', '파이프라인 #5']);
  });
});
