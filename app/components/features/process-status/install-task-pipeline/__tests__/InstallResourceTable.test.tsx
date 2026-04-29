import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { InstallResourceTable } from '@/app/components/features/process-status/install-task-pipeline/InstallResourceTable';
import type { InstallResourceRow } from '@/app/components/features/process-status/install-task-pipeline/join-installation-resources';
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

const row = (overrides: Partial<InstallResourceRow> = {}): InstallResourceRow => ({
  resourceId: 'r1',
  databaseType: 'MYSQL',
  region: null,
  databaseName: 'svc-db',
  installationStatus: 'COMPLETED',
  source: stubSource,
  ...overrides,
});

describe('InstallResourceTable — empty state', () => {
  it('renders empty-state message when rows is empty', () => {
    const html = renderToStaticMarkup(<InstallResourceTable rows={[]} />);
    expect(html).toContain('설치 대상 리소스가 없습니다');
    expect(html).not.toContain('<table');
  });
});

describe('InstallResourceTable — column headers', () => {
  it('renders all 5 column headers in order', () => {
    const html = renderToStaticMarkup(<InstallResourceTable rows={[row()]} />);
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

describe('InstallResourceTable — installationStatus pill', () => {
  it('COMPLETED renders 완료 with green tag classes', () => {
    const html = renderToStaticMarkup(
      <InstallResourceTable rows={[row({ installationStatus: 'COMPLETED' })]} />,
    );
    expect(html).toContain('완료');
    expect(html).toContain(tagStyles.green);
  });

  it('IN_PROGRESS renders 진행중 with orange tag classes', () => {
    const html = renderToStaticMarkup(
      <InstallResourceTable rows={[row({ installationStatus: 'IN_PROGRESS' })]} />,
    );
    expect(html).toContain('진행중');
    expect(html).toContain(tagStyles.orange);
  });

  it('FAIL renders 실패 with red tag classes', () => {
    const html = renderToStaticMarkup(
      <InstallResourceTable rows={[row({ installationStatus: 'FAIL' })]} />,
    );
    expect(html).toContain('실패');
    expect(html).toContain(tagStyles.red);
  });
});

describe('InstallResourceTable — null fallback to em-dash', () => {
  it('null databaseType renders em-dash', () => {
    const html = renderToStaticMarkup(
      <InstallResourceTable rows={[row({ databaseType: null })]} />,
    );
    expect(html).toContain('—');
  });

  it('null region renders em-dash', () => {
    const html = renderToStaticMarkup(
      <InstallResourceTable rows={[row({ region: null })]} />,
    );
    expect(html).toContain('—');
  });

  it('null databaseName renders em-dash', () => {
    const html = renderToStaticMarkup(
      <InstallResourceTable rows={[row({ databaseName: null })]} />,
    );
    expect(html).toContain('—');
  });
});

describe('InstallResourceTable — multiple rows', () => {
  it('renders one tr per row', () => {
    const html = renderToStaticMarkup(
      <InstallResourceTable
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
      <InstallResourceTable
        rows={[row({ resourceId: 'gcp-r1' }), row({ resourceId: 'gcp-r2' })]}
      />,
    );
    expect(html).toContain('gcp-r1');
    expect(html).toContain('gcp-r2');
  });
});
