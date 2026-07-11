import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AddTaskMenu, CustomBuildStep } from '@/app/admin/pipelines/_detail/CustomBuildStep';
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

  it('shows a labeled "+" ghost CTA on the empty canvas (no dropdown anywhere)', () => {
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
    expect(html).toContain('nd-add-first');
    expect(html).toContain('Task 추가 — 카탈로그에서 골라 실행 순서를 구성하세요');
    expect(html).not.toContain('<select');
    // the shared FLOW_CSS text mentions .pl-tnode — match the class attribute, not the stylesheet
    expect(html).not.toContain('class="pl-tnode');
    // popover is closed by default
    expect(html).not.toContain('role="menu"');
  });

  it('renders nodes + connectors + a trailing "+" ghost node; "+" disables when the catalog is exhausted', () => {
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
    // node→node connectors (2) + one before the trailing "+"
    expect(html.match(/class="pl-connector"/g)).toHaveLength(3);
    expect(html).toContain('class="nd-badge b-seq"');
    // trailing "+" — all 3 catalog entries chosen, so it is disabled with the reason
    expect(html).toContain('class="nd-add"');
    expect(html).toContain('추가할 Task 없음');
    // node identity: full name + catalog description as meta; no input/select anywhere
    expect(html).toContain('표시명 B');
    expect(html).toContain('카탈로그 설명 C');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('<select');
    // affordances: keyboard contract, per-node delete, count + drag hint
    expect(html).toContain('표시명 A — 1번째. 좌우 화살표로 순서 이동, Delete로 제거');
    expect(html.match(/aria-label="표시명 [ABC] 제거"/g)).toHaveLength(3);
    expect(html).toContain('Task 3개 · 노드를 드래그해 실행 순서를 바꿀 수 있어요');
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

describe('AddTaskMenu', () => {
  it('renders one rich row per entry — kind mark, full name, description', () => {
    const html = renderToStaticMarkup(
      <AddTaskMenu entries={[entry('A'), entry('B', 'CONDITION_CHECK')]} onPick={noop} />,
    );
    expect(html).toContain('role="menu"');
    expect(html.match(/role="menuitem"/g)).toHaveLength(2);
    expect(html).toContain('표시명 A');
    expect(html).toContain('카탈로그 설명 A');
    expect(html).toContain('조건 확인 — 폴링'); // CONDITION_CHECK clock mark
    expect(html).toContain('Terraform'); // TERRAFORM_JOB mark
  });
});
