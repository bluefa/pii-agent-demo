import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BuilderEditorRow, CustomBuildStep } from '@/app/integration/admin/pipelines/_detail/CustomBuildStep';
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
    const chosen: BuilderTask[] = [{ entry: catalog[0], description: '' }];
    const html = renderToStaticMarkup(
      <CustomBuildStep
        catalog={catalog}
        catalogError={null}
        onRetry={noop}
        chosen={chosen}
        onChange={noop}
        provider="AWS"
      />,
    );
    expect(html).toContain('<option value="B">');
    expect(html).not.toContain('<option value="A">');
  });

  it('renders one canvas node per task on the flow grid, with connectors and seq badges', () => {
    const catalog = [entry('A'), entry('B', 'CONDITION_CHECK'), entry('C')];
    const chosen: BuilderTask[] = catalog.map((e) => ({ entry: e, description: '' }));
    const html = renderToStaticMarkup(
      <CustomBuildStep
        catalog={catalog}
        catalogError={null}
        onRetry={noop}
        chosen={chosen}
        onChange={noop}
        provider="AWS"
      />,
    );
    expect(html.match(/class="pl-tnode/g)).toHaveLength(3);
    expect(html.match(/class="pl-connector"/g)).toHaveLength(2);
    expect(html).toContain('class="nd-badge b-seq"');
    // node identity + affordances: name, catalog description as meta, keyboard contract
    expect(html).toContain('표시명 B');
    expect(html).toContain('카탈로그 설명 C');
    expect(html).toContain('표시명 A — 1번째. Enter로 선택, 좌우 화살표로 순서 이동');
    expect(html).toContain('노드를 드래그해 순서를 바꾸고, 클릭해 설명을 입력하세요');
    // CONDITION_CHECK keeps the clock mark vocabulary
    expect(html).toContain('조건 확인 — 폴링');
  });

  it('flags an over-limit task on the node itself (border class + spelled-out meta)', () => {
    const catalog = [entry('A')];
    const chosen: BuilderTask[] = [{ entry: catalog[0], description: 'x'.repeat(101) }];
    const html = renderToStaticMarkup(
      <CustomBuildStep
        catalog={catalog}
        catalogError={null}
        onRetry={noop}
        chosen={chosen}
        onChange={noop}
        provider="AWS"
      />,
    );
    expect(html).toContain('class="pl-tnode b-over"');
    expect(html).toContain('101/100 — 설명이 너무 깁니다');
  });
});

describe('BuilderEditorRow', () => {
  it('renders the note input with a live counter and a labeled remove button', () => {
    const task: BuilderTask = { entry: entry('A'), description: '정상 설명' };
    const html = renderToStaticMarkup(
      <BuilderEditorRow task={task} index={1} onDescription={noop} onRemove={noop} />,
    );
    expect(html).toContain('표시명 A 설명');
    expect(html).toContain('5/100');
    expect(html).toContain('표시명 A 제거');
    expect(html).not.toContain('border-[var(--pl-err-border)]');
  });

  it('flags counter + row border when the note exceeds 100 chars', () => {
    const task: BuilderTask = { entry: entry('B'), description: 'x'.repeat(101) };
    const html = renderToStaticMarkup(
      <BuilderEditorRow task={task} index={0} onDescription={noop} onRemove={noop} />,
    );
    expect(html).toContain('101/100');
    expect(html).toContain('text-[var(--pl-err-text)]');
    expect(html).toContain('border-[var(--pl-err-border)]');
  });
});
