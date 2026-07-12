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

  it('shows the ghost "Task 추가" card on the empty canvas (no dropdown anywhere)', () => {
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
    expect(html).toContain('class="r24-tnode ghost"');
    expect(html).toContain('Task 추가');
    expect(html).not.toContain('<select');
    // no order cards yet — only the ghost slot
    expect(html).not.toContain('class="r24-tnode"');
    // popover is closed by default
    expect(html).not.toContain('role="menu"');
  });

  it('renders seq cards + arrows + a trailing ghost card; ghost disables when the catalog is exhausted', () => {
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
    expect(html.match(/class="r24-tnode"/g)).toHaveLength(3);
    // card→card arrows (2) + one before the trailing ghost
    expect(html.match(/class="r24-arrow"/g)).toHaveLength(3);
    // black order chips, one per card (R24)
    expect(html.match(/class="r24-seq"/g)).toHaveLength(3);
    // trailing ghost — all 3 catalog entries chosen, so it is disabled with the reason
    expect(html).toContain('class="r24-tnode ghost"');
    expect(html).toContain('추가할 Task 없음');
    // card identity: full name + catalog description; no input/select anywhere
    expect(html).toContain('표시명 B');
    expect(html).toContain('카탈로그 설명 C');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('<select');
    // affordances: keyboard contract, per-card delete, count + drag hint
    expect(html).toContain('표시명 A — 1번째. 좌우 화살표로 순서 이동, Delete로 제거');
    expect(html.match(/aria-label="표시명 [ABC] 제거"/g)).toHaveLength(3);
    expect(html).toContain('Task 3개 · 노드를 드래그해 실행 순서를 바꿀 수 있어요');
    // CONDITION_CHECK keeps the clock mark vocabulary
    expect(html).toContain('조건 확인 — 폴링');
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
