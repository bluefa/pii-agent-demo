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

  /** Every fill this strip can draw, split into the coloured ones and the neutrals. */
  const HUES = ['bg-[var(--pl-info-text)]', 'bg-[var(--pl-err)]'];
  const colouredSegments = (html: string): number =>
    HUES.reduce((sum, hue) => sum + count(html, hue), 0);

  // The whole reason this exists: the summary bar can only say "1 of 4", never
  // WHICH one broke.
  it('FAILED paints the step it stopped on, and names it', () => {
    const html = render({ n: 1, m: 4, status: 'FAILED' });
    expect(count(html, 'bg-[var(--pl-gray-400)]')).toBe(1); // step 1 finished — neutral
    expect(count(html, 'bg-[var(--pl-err)]')).toBe(1); // step 2 failed
    expect(count(html, 'bg-[var(--pl-gray-200)]')).toBe(2); // steps 3-4 untouched
    expect(html).toContain('2단계에서 실패 · 1/4');
  });

  it('RUNNING colours the current step — the finished ones stay neutral', () => {
    const html = render({ n: 1, m: 4, status: 'RUNNING' });
    expect(count(html, 'bg-[var(--pl-gray-400)]')).toBe(1);
    expect(count(html, 'bg-[var(--pl-info-text)]')).toBe(1);
    expect(count(html, 'bg-[var(--pl-gray-200)]')).toBe(2);
    expect(html).toContain('2단계 진행 중 · 1/4');
  });

  /**
   * The rule the whole strip now rests on (오너 2026-08-14, "색상이 강하지 않게"):
   * colour marks the step the run is SITTING ON and nothing else, so a row is
   * coloured exactly when something is still happening on it. Finished steps used
   * to be green, which put the largest block of colour on the page on the rows
   * that needed nobody.
   */
  it('never colours more than the one step the run is on', () => {
    expect(colouredSegments(render({ n: 1, m: 4, status: 'RUNNING' }))).toBe(1);
    expect(colouredSegments(render({ n: 1, m: 4, status: 'FAILED' }))).toBe(1);
    expect(colouredSegments(render({ n: 0, m: 4, status: 'PENDING' }))).toBe(0);
    expect(colouredSegments(render({ n: 2, m: 4, status: 'CANCELLED' }))).toBe(0);
    expect(colouredSegments(render({ n: 3, m: 3, status: 'DONE' }))).toBe(0);
  });

  it('DONE is entirely neutral — a finished run asks for nothing', () => {
    const html = render({ n: 3, m: 3, status: 'DONE' });
    expect(count(html, 'bg-[var(--pl-gray-400)]')).toBe(3);
    expect(html).toContain('3/3');
  });

  it('PENDING has entered no step — every segment is bare track', () => {
    const html = render({ n: 0, m: 4, status: 'PENDING' });
    expect(count(html, 'bg-[var(--pl-gray-200)]')).toBe(4);
    expect(html).toContain('시작 대기 · 0/4');
  });

  // A cancelled run's finished steps now read exactly like every other finished
  // step: the branch that told them apart existed only to keep green off a run
  // that never succeeded, and there is no green left to keep off.
  it('CANCELLED greys the steps it did finish and claims no current one', () => {
    const html = render({ n: 2, m: 4, status: 'CANCELLED' });
    expect(count(html, 'bg-[var(--pl-gray-400)]')).toBe(2);
    expect(count(html, 'bg-[var(--pl-gray-200)]')).toBe(2);
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
