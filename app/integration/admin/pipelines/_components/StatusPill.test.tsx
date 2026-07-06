import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StatusPill, type PillStatus } from '@/app/integration/admin/pipelines/_components/StatusPill';

const render = (status: PillStatus, size?: 'md' | 'lg'): string =>
  renderToStaticMarkup(<StatusPill status={status} size={size} />);

// The 11 pill states (5 pipeline + 6 task) → expected background-tint var.
const CASES: Array<[PillStatus, string]> = [
  ['PENDING', '--pl-warn-bg'],
  ['RUNNING', '--pl-info-bg'],
  ['DONE', '--pl-ok-bg'],
  ['FAILED', '--pl-err-bg'],
  ['CANCELLED', '--pl-off-bg'],
  ['BLOCKED', '--pl-off-bg'],
  ['READY', '--pl-primary-bg'],
  ['IN_PROGRESS', '--pl-info-bg'],
];

describe('StatusPill', () => {
  it.each(CASES)('renders %s verbatim with the correct tone', (status, toneVar) => {
    const html = render(status);
    expect(html).toContain(`>${status}`);
    expect(html).toContain(toneVar);
  });

  it('also renders the task-only aliases (all 11 states covered)', () => {
    // The three overlapping states re-asserted from the task enum perspective.
    for (const status of ['DONE', 'FAILED', 'CANCELLED'] as PillStatus[]) {
      expect(render(status)).toContain(`>${status}`);
    }
  });

  it('READY is PRIMARY (blue), not warn — prototype CSS wins over the inventory', () => {
    const html = render('READY');
    expect(html).toContain('bg-[var(--pl-primary-bg)]');
    expect(html).toContain('text-[var(--pl-primary)]');
    expect(html).not.toContain('--pl-warn');
  });

  it('pulses the dot for RUNNING and IN_PROGRESS only', () => {
    expect(render('RUNNING')).toContain('pl-pulse');
    expect(render('IN_PROGRESS')).toContain('pl-pulse');
    expect(render('DONE')).not.toContain('pl-pulse');
    expect(render('BLOCKED')).not.toContain('pl-pulse');
  });

  it('BLOCKED dot uses gray-300 (distinct from the off text)', () => {
    expect(render('BLOCKED')).toContain('bg-[var(--pl-gray-300)]');
  });

  it('lg size switches to the h28 pill', () => {
    expect(render('RUNNING', 'lg')).toContain('h-7');
  });
});
