import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  InstallTaskDetailModal,
  countDetailTabs,
  filterRowsByDetailTab,
} from '@/app/components/features/process-status/install-task-pipeline/InstallTaskDetailModal';
import type { Step4ResourceRow } from '@/app/components/features/process-status/install-task-pipeline/join-installation-resources';
import type { GcpResourceStatus, GcpStepStatusValue } from '@/app/api/_lib/v1-types';

const sourceWith = (
  resourceId: string,
  step: { service?: GcpStepStatusValue; bdc?: GcpStepStatusValue; subnet?: GcpStepStatusValue } = {},
): GcpResourceStatus => ({
  resourceId,
  resourceName: `${resourceId}-name`,
  resourceType: 'CLOUD_SQL',
  installationStatus: 'IN_PROGRESS',
  serviceSideSubnetCreation: { status: step.subnet ?? 'COMPLETED' },
  serviceSideTerraformApply: { status: step.service ?? 'IN_PROGRESS' },
  bdcSideTerraformApply: { status: step.bdc ?? 'COMPLETED' },
});

const row = (
  resourceId: string,
  step: { service?: GcpStepStatusValue; bdc?: GcpStepStatusValue; subnet?: GcpStepStatusValue } = {},
): Step4ResourceRow => ({
  resourceId,
  databaseType: 'MYSQL',
  region: null,
  databaseName: `${resourceId}-db`,
  installationStatus: 'IN_PROGRESS',
  source: sourceWith(resourceId, step),
});

describe('filterRowsByDetailTab', () => {
  const rows: Step4ResourceRow[] = [
    row('a', { service: 'COMPLETED' }),
    row('b', { service: 'IN_PROGRESS' }),
    row('c', { service: 'FAIL' }),
    row('d', { service: 'SKIP' }),
  ];

  it('all tab includes everything except SKIP', () => {
    const result = filterRowsByDetailTab(rows, 'serviceSideTerraformApply', 'all');
    expect(result.map((r) => r.resourceId)).toEqual(['a', 'b', 'c']);
  });

  it('done tab includes only COMPLETED', () => {
    const result = filterRowsByDetailTab(rows, 'serviceSideTerraformApply', 'done');
    expect(result.map((r) => r.resourceId)).toEqual(['a']);
  });

  it('running tab includes IN_PROGRESS and FAIL (per spec note line 241)', () => {
    const result = filterRowsByDetailTab(rows, 'serviceSideTerraformApply', 'running');
    expect(result.map((r) => r.resourceId)).toEqual(['b', 'c']);
  });

  it('SKIP rows are excluded from every tab', () => {
    expect(filterRowsByDetailTab(rows, 'serviceSideTerraformApply', 'all'))
      .not.toContainEqual(expect.objectContaining({ resourceId: 'd' }));
    expect(filterRowsByDetailTab(rows, 'serviceSideTerraformApply', 'done'))
      .not.toContainEqual(expect.objectContaining({ resourceId: 'd' }));
    expect(filterRowsByDetailTab(rows, 'serviceSideTerraformApply', 'running'))
      .not.toContainEqual(expect.objectContaining({ resourceId: 'd' }));
  });

  it('different stepKey produces independent filtering', () => {
    const rows2: Step4ResourceRow[] = [
      row('x', { service: 'COMPLETED', bdc: 'IN_PROGRESS' }),
      row('y', { service: 'IN_PROGRESS', bdc: 'COMPLETED' }),
    ];
    expect(filterRowsByDetailTab(rows2, 'serviceSideTerraformApply', 'done'))
      .toHaveLength(1);
    expect(filterRowsByDetailTab(rows2, 'bdcSideTerraformApply', 'done'))
      .toHaveLength(1);
    expect(filterRowsByDetailTab(rows2, 'serviceSideTerraformApply', 'done')[0].resourceId)
      .toBe('x');
    expect(filterRowsByDetailTab(rows2, 'bdcSideTerraformApply', 'done')[0].resourceId)
      .toBe('y');
  });
});

describe('countDetailTabs', () => {
  it('reports counts for all/done/running for the given step', () => {
    const rows: Step4ResourceRow[] = [
      row('a', { service: 'COMPLETED' }),
      row('b', { service: 'COMPLETED' }),
      row('c', { service: 'IN_PROGRESS' }),
      row('d', { service: 'FAIL' }),
      row('e', { service: 'SKIP' }),
    ];
    expect(countDetailTabs(rows, 'serviceSideTerraformApply')).toEqual({
      all: 4,
      done: 2,
      running: 2,
    });
  });

  it('all-zero when every row is SKIP for the step', () => {
    const rows: Step4ResourceRow[] = [
      row('a', { service: 'SKIP' }),
      row('b', { service: 'SKIP' }),
    ];
    expect(countDetailTabs(rows, 'serviceSideTerraformApply')).toEqual({
      all: 0,
      done: 0,
      running: 0,
    });
  });
});

describe('InstallTaskDetailModal — render', () => {
  it('renders nothing when open is false', () => {
    const html = renderToStaticMarkup(
      <InstallTaskDetailModal
        open={false}
        onClose={() => undefined}
        stepKey="serviceSideTerraformApply"
        rows={[]}
      />,
    );
    expect(html).toBe('');
  });

  it('renders nothing when stepKey is null', () => {
    const html = renderToStaticMarkup(
      <InstallTaskDetailModal
        open
        onClose={() => undefined}
        stepKey={null}
        rows={[]}
      />,
    );
    expect(html).toBe('');
  });

  it('renders the matching pipeline title for the stepKey', () => {
    const html = renderToStaticMarkup(
      <InstallTaskDetailModal
        open
        onClose={() => undefined}
        stepKey="serviceSideTerraformApply"
        rows={[]}
      />,
    );
    expect(html).toContain('서비스 측 리소스 설치 진행');
  });

  it('switches title with stepKey', () => {
    const subnetHtml = renderToStaticMarkup(
      <InstallTaskDetailModal
        open
        onClose={() => undefined}
        stepKey="serviceSideSubnetCreation"
        rows={[]}
      />,
    );
    const bdcHtml = renderToStaticMarkup(
      <InstallTaskDetailModal
        open
        onClose={() => undefined}
        stepKey="bdcSideTerraformApply"
        rows={[]}
      />,
    );
    expect(subnetHtml).toContain('Subnet 생성 진행');
    expect(bdcHtml).toContain('BDC 측 리소스 설치 진행');
  });

  it('renders the design subtitle copy verbatim', () => {
    const html = renderToStaticMarkup(
      <InstallTaskDetailModal
        open
        onClose={() => undefined}
        stepKey="serviceSideTerraformApply"
        rows={[]}
      />,
    );
    expect(html).toContain('리소스별 설치 진행 현황을 확인할 수 있어요.');
  });

  it('renders 4 column headers', () => {
    const html = renderToStaticMarkup(
      <InstallTaskDetailModal
        open
        onClose={() => undefined}
        stepKey="serviceSideTerraformApply"
        rows={[row('a')]}
      />,
    );
    expect(html).toContain('Resource ID');
    expect(html).toContain('DB Type');
    expect(html).toContain('Region');
    expect(html).toContain('진행 완료 여부');
  });

  it('renders 3 tabs and a 확인 footer button', () => {
    const html = renderToStaticMarkup(
      <InstallTaskDetailModal
        open
        onClose={() => undefined}
        stepKey="serviceSideTerraformApply"
        rows={[]}
      />,
    );
    expect(html).toContain('전체');
    expect(html).toContain('완료');
    expect(html).toContain('진행중');
    expect(html).toContain('확인');
  });

  it('default tab is 전체 — empty rows produce empty-state', () => {
    const html = renderToStaticMarkup(
      <InstallTaskDetailModal
        open
        onClose={() => undefined}
        stepKey="serviceSideTerraformApply"
        rows={[]}
      />,
    );
    expect(html).toContain('해당 상태의 리소스가 없어요');
  });

  it('renders rows with non-SKIP step status under the 전체 default tab', () => {
    const html = renderToStaticMarkup(
      <InstallTaskDetailModal
        open
        onClose={() => undefined}
        stepKey="serviceSideTerraformApply"
        rows={[row('visible-1', { service: 'COMPLETED' }), row('skip-1', { service: 'SKIP' })]}
      />,
    );
    expect(html).toContain('visible-1');
    expect(html).not.toContain('skip-1');
  });

  it('renders the close button with a Korean aria-label', () => {
    const html = renderToStaticMarkup(
      <InstallTaskDetailModal
        open
        onClose={() => undefined}
        stepKey="serviceSideTerraformApply"
        rows={[]}
      />,
    );
    expect(html).toContain('aria-label="닫기"');
  });
});
