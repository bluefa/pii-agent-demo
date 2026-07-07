import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CustomBuildStep } from '@/app/integration/admin/pipelines/_detail/CustomBuildStep';
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
      <CustomBuildStep
        catalog={null}
        catalogError={null}
        onRetry={noop}
        chosen={[]}
        onChange={noop}
        provider="AWS"
      />,
    );
    expect(html).toContain('animate-pulse');
  });

  it('shows the error line + 재시도 when the catalog load fails', () => {
    const html = renderToStaticMarkup(
      <CustomBuildStep
        catalog={null}
        catalogError="HTTP 502"
        onRetry={noop}
        chosen={[]}
        onChange={noop}
        provider="AWS"
      />,
    );
    expect(html).toContain('Task 카탈로그를 불러오지 못했습니다');
    expect(html).toContain('재시도');
  });

  it('shows the canvas placeholder before any task is added', () => {
    const html = renderToStaticMarkup(
      <CustomBuildStep
        catalog={[entry('A')]}
        catalogError={null}
        onRetry={noop}
        chosen={[]}
        onChange={noop}
        provider="AWS"
      />,
    );
    expect(html).toContain('카탈로그에서 Task를 추가해 실행 순서를 구성하세요');
    expect(html).toContain('Task 0개');
    // the shared FLOW_CSS text mentions .pl-tnode — match the class attribute, not the stylesheet
    expect(html).not.toContain('class="pl-tnode');
  });

  it('hides already-chosen entries from the add select (UI dedup)', () => {
    const catalog = [entry('A'), entry('B')];
    const html = renderToStaticMarkup(
      <CustomBuildStep
        catalog={catalog}
        catalogError={null}
        onRetry={noop}
        chosen={[catalog[0]]}
        onChange={noop}
        provider="AWS"
      />,
    );
    expect(html).toContain('<option value="B">');
    expect(html).not.toContain('<option value="A">');
  });

  it('renders one canvas node per task with connectors, seq badges, and a delete control', () => {
    const catalog = [entry('A'), entry('B', 'CONDITION_CHECK'), entry('C')];
    const html = renderToStaticMarkup(
      <CustomBuildStep
        catalog={catalog}
        catalogError={null}
        onRetry={noop}
        chosen={catalog}
        onChange={noop}
        provider="AWS"
      />,
    );
    expect(html.match(/class="pl-tnode/g)).toHaveLength(3);
    expect(html.match(/class="pl-connector"/g)).toHaveLength(2);
    expect(html).toContain('class="nd-badge b-seq"');
    // node identity: full name + catalog description as meta; no description input anywhere
    expect(html).toContain('표시명 B');
    expect(html).toContain('카탈로그 설명 C');
    expect(html).not.toContain('<input');
    // affordances: keyboard contract, per-node delete, drag hint
    expect(html).toContain('표시명 A — 1번째. 좌우 화살표로 순서 이동, Delete로 제거');
    expect(html.match(/aria-label="표시명 [ABC] 제거"/g)).toHaveLength(3);
    expect(html).toContain('노드를 드래그해 실행 순서를 바꿀 수 있어요');
    // CONDITION_CHECK keeps the clock mark vocabulary
    expect(html).toContain('조건 확인 — 폴링');
  });

  it('renders node names un-clamped (builder override over the FLOW_CSS 2-line clamp)', () => {
    const html = renderToStaticMarkup(
      <CustomBuildStep
        catalog={[entry('A')]}
        catalogError={null}
        onRetry={noop}
        chosen={[entry('A')]}
        onChange={noop}
        provider="AWS"
      />,
    );
    expect(html).toContain('.pl-flow.pl-build .nd-name{display:block;overflow:visible;-webkit-line-clamp:none');
  });
});
