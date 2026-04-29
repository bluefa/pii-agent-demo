import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  InstallTaskPipeline,
  type InstallTaskPipelineItem,
} from '@/app/components/features/process-status/install-task-pipeline/InstallTaskPipeline';

const item = (key: string, title: string, idx: number): InstallTaskPipelineItem => ({
  key,
  title,
  sub: `${title}-sub`,
  status: idx === 0 ? 'done' : idx === 1 ? 'running' : 'pending',
  completedCount: idx === 1 ? 1 : undefined,
  activeCount: idx === 1 ? 3 : undefined,
});

describe('InstallTaskPipeline', () => {
  it('renders nothing for empty items', () => {
    const html = renderToStaticMarkup(<InstallTaskPipeline items={[]} />);
    expect(html).toBe('');
  });

  it('renders all titles for 3 items', () => {
    const items: InstallTaskPipelineItem[] = [
      item('a', 'Subnet 생성 진행', 0),
      item('b', '서비스 측 리소스 설치 진행', 1),
      item('c', 'BDC 측 리소스 설치 진행', 2),
    ];
    const html = renderToStaticMarkup(<InstallTaskPipeline items={items} />);
    expect(html).toContain('Subnet 생성 진행');
    expect(html).toContain('서비스 측 리소스 설치 진행');
    expect(html).toContain('BDC 측 리소스 설치 진행');
  });

  it('renders N-1 chevrons for N items (3 items → 2 chevrons)', () => {
    const items: InstallTaskPipelineItem[] = [
      item('a', 't1', 0),
      item('b', 't2', 1),
      item('c', 't3', 2),
    ];
    const html = renderToStaticMarkup(<InstallTaskPipeline items={items} />);
    const chevronMatches = html.match(/right-\[-7px\]/g) ?? [];
    expect(chevronMatches).toHaveLength(2);
  });

  it('uses grid-cols-3 for 3 items', () => {
    const items: InstallTaskPipelineItem[] = [
      item('a', 't1', 0),
      item('b', 't2', 1),
      item('c', 't3', 2),
    ];
    const html = renderToStaticMarkup(<InstallTaskPipeline items={items} />);
    expect(html).toContain('grid-cols-3');
  });

  it('does not use inline left:% style anywhere (AP-E2)', () => {
    const items: InstallTaskPipelineItem[] = [
      item('a', 't1', 0),
      item('b', 't2', 1),
      item('c', 't3', 2),
    ];
    const html = renderToStaticMarkup(<InstallTaskPipeline items={items} />);
    expect(html).not.toMatch(/left:\s*\d/);
  });

  it('passes M/N count through to running cards', () => {
    const items: InstallTaskPipelineItem[] = [
      { key: 'a', title: 't1', status: 'running', completedCount: 2, activeCount: 7 },
    ];
    const html = renderToStaticMarkup(<InstallTaskPipeline items={items} />);
    expect(html).toContain('진행중 (2/7)');
  });

  it('renders a button for items with onClick', () => {
    const items: InstallTaskPipelineItem[] = [
      { key: 'a', title: 't', status: 'running', onClick: () => undefined },
    ];
    const html = renderToStaticMarkup(<InstallTaskPipeline items={items} />);
    expect(html).toMatch(/<button\b/);
  });
});
