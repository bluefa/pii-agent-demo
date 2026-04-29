import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { Step4DbListTable } from '@/app/components/features/process-status/install-task-pipeline/Step4DbListTable';
import type { Step4ResourceRow } from '@/app/components/features/process-status/install-task-pipeline/join-installation-resources';
import type { GcpResourceStatus } from '@/app/api/_lib/v1-types';
import { tagStyles } from '@/lib/theme';

const stubSource: GcpResourceStatus = {
  resourceId: 'r1',
  resourceName: 'name',
  resourceType: 'CLOUD_SQL',
  installationStatus: 'COMPLETED',
  serviceSideSubnetCreation: { status: 'COMPLETED' },
  serviceSideTerraformApply: { status: 'COMPLETED' },
  bdcSideTerraformApply: { status: 'COMPLETED' },
};

const row = (overrides: Partial<Step4ResourceRow> = {}): Step4ResourceRow => ({
  resourceId: 'r1',
  databaseType: 'MYSQL',
  region: null,
  databaseName: 'svc-db',
  installationStatus: 'COMPLETED',
  source: stubSource,
  ...overrides,
});

describe('Step4DbListTable — empty state', () => {
  it('renders empty-state message when rows is empty', () => {
    const html = renderToStaticMarkup(<Step4DbListTable rows={[]} />);
    expect(html).toContain('설치 대상 리소스가 없습니다');
    expect(html).not.toContain('<table');
  });
});

describe('Step4DbListTable — column headers', () => {
  it('renders all 5 column headers in order', () => {
    const html = renderToStaticMarkup(<Step4DbListTable rows={[row()]} />);
    const dbTypeIdx = html.indexOf('DB Type');
    const resourceIdx = html.indexOf('Resource ID');
    const regionIdx = html.indexOf('Region');
    const dbNameIdx = html.indexOf('DB Name');
    const statusIdx = html.indexOf('서비스 리소스 상태');
    expect(dbTypeIdx).toBeGreaterThan(0);
    expect(resourceIdx).toBeGreaterThan(dbTypeIdx);
    expect(regionIdx).toBeGreaterThan(resourceIdx);
    expect(dbNameIdx).toBeGreaterThan(regionIdx);
    expect(statusIdx).toBeGreaterThan(dbNameIdx);
  });
});

describe('Step4DbListTable — installationStatus pill', () => {
  it('COMPLETED renders 완료 with green tag classes', () => {
    const html = renderToStaticMarkup(
      <Step4DbListTable rows={[row({ installationStatus: 'COMPLETED' })]} />,
    );
    expect(html).toContain('완료');
    expect(html).toContain(tagStyles.green);
  });

  it('IN_PROGRESS renders 진행중 with orange tag classes', () => {
    const html = renderToStaticMarkup(
      <Step4DbListTable rows={[row({ installationStatus: 'IN_PROGRESS' })]} />,
    );
    expect(html).toContain('진행중');
    expect(html).toContain(tagStyles.orange);
  });

  it('FAIL renders 실패 with red tag classes', () => {
    const html = renderToStaticMarkup(
      <Step4DbListTable rows={[row({ installationStatus: 'FAIL' })]} />,
    );
    expect(html).toContain('실패');
    expect(html).toContain(tagStyles.red);
  });
});

describe('Step4DbListTable — null fallback to em-dash', () => {
  it('null databaseType renders em-dash', () => {
    const html = renderToStaticMarkup(
      <Step4DbListTable rows={[row({ databaseType: null })]} />,
    );
    expect(html).toContain('—');
  });

  it('null region renders em-dash', () => {
    const html = renderToStaticMarkup(
      <Step4DbListTable rows={[row({ region: null })]} />,
    );
    expect(html).toContain('—');
  });

  it('null databaseName renders em-dash', () => {
    const html = renderToStaticMarkup(
      <Step4DbListTable rows={[row({ databaseName: null })]} />,
    );
    expect(html).toContain('—');
  });
});

describe('Step4DbListTable — multiple rows', () => {
  it('renders one tr per row', () => {
    const html = renderToStaticMarkup(
      <Step4DbListTable
        rows={[
          row({ resourceId: 'a' }),
          row({ resourceId: 'b' }),
          row({ resourceId: 'c' }),
        ]}
      />,
    );
    const trMatches = html.match(/<tr\b/g) ?? [];
    expect(trMatches.length).toBe(4);
  });

  it('renders the resourceId text for each row', () => {
    const html = renderToStaticMarkup(
      <Step4DbListTable
        rows={[row({ resourceId: 'gcp-r1' }), row({ resourceId: 'gcp-r2' })]}
      />,
    );
    expect(html).toContain('gcp-r1');
    expect(html).toContain('gcp-r2');
  });
});
