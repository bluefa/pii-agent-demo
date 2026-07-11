import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PipelineProgressBar } from '@/app/admin/pipelines/_components/PipelineProgressBar';

const render = (props: Parameters<typeof PipelineProgressBar>[0]): string =>
  renderToStaticMarkup(<PipelineProgressBar {...props} />);

describe('PipelineProgressBar', () => {
  it('renders the N/M label and fill width', () => {
    const html = render({ n: 1, m: 2 });
    expect(html).toContain('1/2');
    expect(html).toContain('width:50%');
  });

  it('complete (N==M) fills ok green', () => {
    const html = render({ n: 4, m: 4, status: 'DONE' });
    expect(html).toContain('bg-[var(--pl-ok)]');
    expect(html).toContain('width:100%');
  });

  it('FAILED fills err red regardless of N/M', () => {
    const html = render({ n: 1, m: 3, status: 'FAILED' });
    expect(html).toContain('bg-[var(--pl-err)]');
    expect(html).not.toContain('bg-[var(--pl-primary)]');
  });

  it('CANCELLED fills off grey', () => {
    expect(render({ n: 0, m: 2, status: 'CANCELLED' })).toContain('bg-[var(--pl-off)]');
  });

  it('in-progress (partial, no terminal status) fills primary', () => {
    const html = render({ n: 2, m: 4, status: 'RUNNING' });
    expect(html).toContain('bg-[var(--pl-primary)]');
  });

  it('wide variant uses the 160px track', () => {
    expect(render({ n: 1, m: 2, wide: true })).toContain('w-[160px]');
  });
});
