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
    const html = renderToStaticMarkup(<InstallResourceTable rows={[]} provider="GCP" />);
    expect(html).toContain('설치 대상 리소스가 없습니다');
    expect(html).not.toContain('<table');
  });
});

describe('InstallResourceTable — column headers', () => {
  it('renders all 5 column headers in order', () => {
    const html = renderToStaticMarkup(
      <InstallResourceTable rows={[row()]} provider="GCP" />,
    );
    const dbTypeIdx = html.indexOf('DB Type');
    const resourceIdx = html.indexOf('Resource ID');
    const regionIdx = html.indexOf('Region');
    const resourceNameIdx = html.indexOf('Resource Name');
    const statusIdx = html.indexOf('서비스 리소스 상태');
    expect(dbTypeIdx).toBeGreaterThan(0);
    expect(resourceIdx).toBeGreaterThan(dbTypeIdx);
    expect(regionIdx).toBeGreaterThan(resourceIdx);
    expect(resourceNameIdx).toBeGreaterThan(regionIdx);
    expect(statusIdx).toBeGreaterThan(resourceNameIdx);
  });
});

describe('InstallResourceTable — installationStatus pill', () => {
  it('COMPLETED renders 완료 with green tag classes', () => {
    const html = renderToStaticMarkup(
      <InstallResourceTable rows={[row({ installationStatus: 'COMPLETED' })]} provider="GCP" />,
    );
    expect(html).toContain('완료');
    expect(html).toContain(tagStyles.green);
  });

  it('IN_PROGRESS renders 진행중 with orange tag classes', () => {
    const html = renderToStaticMarkup(
      <InstallResourceTable rows={[row({ installationStatus: 'IN_PROGRESS' })]} provider="GCP" />,
    );
    expect(html).toContain('진행중');
    expect(html).toContain(tagStyles.orange);
  });

  it('FAIL renders 실패 with red tag classes', () => {
    const html = renderToStaticMarkup(
      <InstallResourceTable rows={[row({ installationStatus: 'FAIL' })]} provider="GCP" />,
    );
    expect(html).toContain('실패');
    expect(html).toContain(tagStyles.red);
  });
});

describe('InstallResourceTable — null fallback to em-dash', () => {
  it('null databaseType renders em-dash', () => {
    const html = renderToStaticMarkup(
      <InstallResourceTable rows={[row({ databaseType: null })]} provider="GCP" />,
    );
    expect(html).toContain('—');
  });

  it('null region renders em-dash', () => {
    const html = renderToStaticMarkup(
      <InstallResourceTable rows={[row({ region: null })]} provider="GCP" />,
    );
    expect(html).toContain('—');
  });

  it('null databaseName renders em-dash', () => {
    const html = renderToStaticMarkup(
      <InstallResourceTable rows={[row({ databaseName: null })]} provider="GCP" />,
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
        provider="GCP"
      />,
    );
    const trMatches = html.match(/<tr\b/g) ?? [];
    expect(trMatches.length).toBe(4);
  });

  it('renders the resourceId text for each row', () => {
    const html = renderToStaticMarkup(
      <InstallResourceTable
        rows={[row({ resourceId: 'gcp-r1' }), row({ resourceId: 'gcp-r2' })]}
        provider="GCP"
      />,
    );
    expect(html).toContain('gcp-r1');
    expect(html).toContain('gcp-r2');
  });
});

describe('InstallResourceTable — provider-aware status column label', () => {
  it('AWS provider shows "VPC Endpoint 상태"', () => {
    const html = renderToStaticMarkup(
      <InstallResourceTable rows={[row()]} provider="AWS" />,
    );
    expect(html).toContain('VPC Endpoint 상태');
    expect(html).not.toContain('Private Link 상태');
    expect(html).not.toContain('서비스 리소스 상태');
  });

  it('Azure provider shows "Private Link 상태"', () => {
    const html = renderToStaticMarkup(
      <InstallResourceTable rows={[row()]} provider="Azure" />,
    );
    expect(html).toContain('Private Link 상태');
    expect(html).not.toContain('VPC Endpoint 상태');
  });

  it('GCP provider shows "서비스 리소스 상태"', () => {
    const html = renderToStaticMarkup(
      <InstallResourceTable rows={[row()]} provider="GCP" />,
    );
    expect(html).toContain('서비스 리소스 상태');
  });

  it('IDC provider shows "서비스 리소스 상태" (matches GCP label)', () => {
    const html = renderToStaticMarkup(
      <InstallResourceTable rows={[row()]} provider="IDC" />,
    );
    expect(html).toContain('서비스 리소스 상태');
  });
});

describe('InstallResourceTable — CopyButton on Resource ID', () => {
  it('mounts a copy button next to every resourceId cell', () => {
    const html = renderToStaticMarkup(
      <InstallResourceTable
        rows={[row({ resourceId: 'gcp-r1' }), row({ resourceId: 'gcp-r2' })]}
        provider="GCP"
      />,
    );
    expect(html).toContain('aria-label="gcp-r1 복사"');
    expect(html).toContain('aria-label="gcp-r2 복사"');
  });

  it('hides the copy button by default (row-hover reveal)', () => {
    const html = renderToStaticMarkup(
      <InstallResourceTable rows={[row()]} provider="GCP" />,
    );
    expect(html).toContain('opacity-0');
    expect(html).toContain('group-hover:opacity-100');
  });
});
