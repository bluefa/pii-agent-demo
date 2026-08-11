import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PipelineStepStrip } from '@/app/admin/pipelines/_components/PipelineStepStrip';

const render = (props: Parameters<typeof PipelineStepStrip>[0]): string =>
  renderToStaticMarkup(<PipelineStepStrip {...props} />);

/** How many segments carry a given fill token. */
const count = (html: string, token: string): number => html.split(token).length - 1;

describe('PipelineStepStrip', () => {
  it('draws one segment per task', () => {
    expect(count(render({ n: 1, m: 4 }), 'h-1.5 flex-1')).toBe(4);
  });

  // The whole reason this exists: the summary bar can only say "1 of 4", never
  // WHICH one broke.
  it('FAILED paints the step after the done ones red, and names it', () => {
    const html = render({ n: 1, m: 4, status: 'FAILED' });
    expect(count(html, 'bg-[var(--pl-ok)]')).toBe(1); // step 1 finished
    expect(count(html, 'bg-[var(--pl-err)]')).toBe(1); // step 2 failed
    expect(count(html, 'bg-[var(--pl-gray-200)]')).toBe(2); // steps 3-4 untouched
    expect(html).toContain('2단계에서 실패 · 1/4');
  });

  it('RUNNING marks the current step blue and the finished ones green', () => {
    const html = render({ n: 1, m: 4, status: 'RUNNING' });
    expect(count(html, 'bg-[var(--pl-ok)]')).toBe(1);
    expect(count(html, 'bg-[var(--pl-info)]')).toBe(1);
    expect(count(html, 'bg-[var(--pl-gray-200)]')).toBe(2);
    expect(html).toContain('2단계 진행 중 · 1/4');
  });

  it('PENDING has entered no step — every segment is bare track', () => {
    const html = render({ n: 0, m: 4, status: 'PENDING' });
    expect(count(html, 'bg-[var(--pl-gray-200)]')).toBe(4);
    expect(html).toContain('시작 대기 · 0/4');
  });

  // Its steps ran, but the run did not succeed — green would say it did.
  it('CANCELLED greys the steps it did finish and claims no current one', () => {
    const html = render({ n: 2, m: 4, status: 'CANCELLED' });
    expect(count(html, 'bg-[var(--pl-gray-400)]')).toBe(2);
    expect(count(html, 'bg-[var(--pl-gray-200)]')).toBe(2);
    expect(html).not.toContain('bg-[var(--pl-ok)]');
    expect(html).toContain('2/4');
  });

  it('falls back to the summary bar when there are too many steps to tell apart', () => {
    const html = render({ n: 3, m: 12, status: 'RUNNING' });
    expect(html).toContain('w-[110px]');
    expect(html).not.toContain('h-1.5 flex-1');
    expect(html).toContain('3/12');
  });

  it('falls back when the task count is unknown (m = 0) instead of drawing nothing', () => {
    expect(render({ n: 0, m: 0 })).toContain('0/0');
  });
});
