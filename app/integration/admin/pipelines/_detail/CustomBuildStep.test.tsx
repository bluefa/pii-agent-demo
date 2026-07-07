import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CustomBuildStep } from '@/app/integration/admin/pipelines/_detail/CustomBuildStep';
import type { BuilderTask } from '@/app/integration/admin/pipelines/_detail/customBuilder';
import type { TaskCatalogEntry } from '@/lib/pipeline/types';

const entry = (name: string, kind: TaskCatalogEntry['kind'] = 'TERRAFORM_JOB'): TaskCatalogEntry => ({
  name,
  display_name: `표시명 ${name}`,
  description: `카탈로그 설명 ${name}`,
  provider: 'AWS',
  kind,
  consumes_terraform_slot: kind === 'TERRAFORM_JOB',
});

const noop = vi.fn();

describe('CustomBuildStep', () => {
  it('shows a skeleton while the catalog loads', () => {
    const html = renderToStaticMarkup(
      <CustomBuildStep catalog={null} catalogError={null} onRetry={noop} chosen={[]} onChange={noop} />,
    );
    expect(html).toContain('animate-pulse');
  });

  it('shows the error line + 재시도 when the catalog load fails', () => {
    const html = renderToStaticMarkup(
      <CustomBuildStep catalog={null} catalogError="HTTP 502" onRetry={noop} chosen={[]} onChange={noop} />,
    );
    expect(html).toContain('Task 카탈로그를 불러오지 못했습니다');
    expect(html).toContain('재시도');
  });

  it('shows the dashed placeholder before any task is added', () => {
    const html = renderToStaticMarkup(
      <CustomBuildStep catalog={[entry('A')]} catalogError={null} onRetry={noop} chosen={[]} onChange={noop} />,
    );
    expect(html).toContain('카탈로그에서 Task를 추가해 실행 순서를 구성하세요');
    expect(html).toContain('Task 0개');
  });

  it('hides already-chosen entries from the add select (UI dedup)', () => {
    const catalog = [entry('A'), entry('B')];
    const chosen: BuilderTask[] = [{ entry: catalog[0], description: '' }];
    const html = renderToStaticMarkup(
      <CustomBuildStep catalog={catalog} catalogError={null} onRetry={noop} chosen={chosen} onChange={noop} />,
    );
    expect(html).toContain('<option value="B">');
    expect(html).not.toContain('<option value="A">');
  });

  it('renders rows with a live counter; over-limit flags counter + row border', () => {
    const catalog = [entry('A'), entry('B', 'CONDITION_CHECK')];
    const chosen: BuilderTask[] = [
      { entry: catalog[0], description: '정상 설명' },
      { entry: catalog[1], description: 'x'.repeat(101) },
    ];
    const html = renderToStaticMarkup(
      <CustomBuildStep catalog={catalog} catalogError={null} onRetry={noop} chosen={chosen} onChange={noop} />,
    );
    expect(html).toContain('5/100');
    expect(html).toContain('101/100');
    expect(html).toContain('text-[var(--pl-err-text)]');
    expect(html).toContain('border-[var(--pl-err-border)]');
    // reorder/remove affordances are labeled per task
    expect(html).toContain('표시명 A 위로 이동');
    expect(html).toContain('표시명 B 제거');
  });
});
