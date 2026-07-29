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

  // Monochrome status ramp (theme.ts PILL_*): the bar's LENGTH carries progress,
  // so only failure still needs a hue.
  it('complete (N==M) fills the strongest neutral', () => {
    const html = render({ n: 4, m: 4, status: 'DONE' });
    expect(html).toContain('bg-[var(--pl-text-strong)]');
    expect(html).toContain('width:100%');
  });

  it('FAILED keeps the one hue on the ramp, regardless of N/M', () => {
    const html = render({ n: 1, m: 3, status: 'FAILED' });
    expect(html).toContain('bg-[var(--pl-err)]');
    expect(html).not.toContain('bg-[var(--pl-primary)]');
  });

  it('CANCELLED fills the faintest neutral', () => {
    expect(render({ n: 0, m: 2, status: 'CANCELLED' })).toContain('bg-[var(--pl-gray-400)]');
  });

  it('in-progress (partial, no terminal status) stays neutral', () => {
    const html = render({ n: 2, m: 4, status: 'RUNNING' });
    expect(html).toContain('bg-[var(--pl-text-medium)]');
    expect(html).not.toContain('bg-[var(--pl-primary)]');
  });

  it('wide variant uses the 160px track', () => {
    expect(render({ n: 1, m: 2, wide: true })).toContain('w-[160px]');
  });
});
