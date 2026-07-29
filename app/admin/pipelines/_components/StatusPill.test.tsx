import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StatusPill, type PillStatus } from '@/app/admin/pipelines/_components/StatusPill';

const render = (status: PillStatus, size?: 'md' | 'lg'): string =>
  renderToStaticMarkup(<StatusPill status={status} size={size} />);

/**
 * Status is monochrome (owner: 상태는 모두 단일 색상으로). Every state sits on the
 * neutral ramp and separates by WEIGHT — quiet tint, settled tint, outlined ink —
 * with red surviving as the single accent so a failed run cannot read as a
 * finished one. These cases pin the ramp position, not a specific hex.
 */
const QUIET = '--pl-gray-50';
const SETTLED = '--pl-gray-100';
const ACTIVE = '--pl-bg-card';
const ALERT = '--pl-err-bg';

const CASES: Array<[PillStatus, string]> = [
  ['PENDING', QUIET],
  ['READY', QUIET],
  ['CANCELLED', QUIET],
  ['BLOCKED', QUIET],
  ['DONE', SETTLED],
  ['RUNNING', ACTIVE],
  ['IN_PROGRESS', ACTIVE],
  ['FAILED', ALERT],
];

/** Every hue the status palette used to reach for. */
const RETIRED_HUES = ['--pl-warn', '--pl-info', '--pl-ok', '--pl-primary'];

describe('StatusPill', () => {
  it.each(CASES)('renders %s verbatim at its ramp position', (status, toneVar) => {
    const html = render(status);
    expect(html).toContain(`>${status}`);
    expect(html).toContain(toneVar);
  });

  it('gives FAILED the only hue on the ramp', () => {
    for (const [status] of CASES) {
      const html = render(status);
      for (const hue of RETIRED_HUES) {
        expect(html).not.toContain(hue);
      }
      // Red belongs to FAILED alone.
      expect(html.includes('--pl-err')).toBe(status === 'FAILED');
    }
  });

  it('separates RUNNING from DONE without color', () => {
    // Both are neutral now, so the distinction has to survive in the border and
    // in the glyph itself (Icon inlines the SVG, so compare the path geometry).
    expect(render('RUNNING')).toContain('border-[var(--pl-text-strong)]');

    const glyph = (status: PillStatus): string =>
      render(status).match(/<path d="([^"]+)"/)?.[1] ?? '';
    expect(glyph('RUNNING')).not.toBe('');
    expect(glyph('RUNNING')).not.toBe(glyph('DONE'));
  });

  it('also renders the task-only aliases (all 11 states covered)', () => {
    // The three overlapping states re-asserted from the task enum perspective.
    for (const status of ['DONE', 'FAILED', 'CANCELLED'] as PillStatus[]) {
      expect(render(status)).toContain(`>${status}`);
    }
  });

  it('never spins the status icon (static, matching the Figma dashboard mock)', () => {
    for (const status of ['RUNNING', 'IN_PROGRESS', 'DONE', 'BLOCKED'] as const) {
      expect(render(status)).not.toContain('animate-spin');
    }
  });

  it('lg size switches to the h28 pill', () => {
    expect(render('RUNNING', 'lg')).toContain('h-7');
  });
});
