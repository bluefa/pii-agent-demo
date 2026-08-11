import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StatusPill, type PillStatus } from '@/app/admin/pipelines/_components/StatusPill';

const render = (status: PillStatus, size?: 'md' | 'lg'): string =>
  renderToStaticMarkup(<StatusPill status={status} size={size} />);

/**
 * Status is hue-coded (owner: Running 파랑 / FAILED 빨강 / DONE 초록 / PENDING
 * 회색, 채도비만 맞춰, 아이콘 없이). Hue is the ONLY channel left once the glyph is
 * gone, so these cases pin the ramp family per state — not a specific hex — and
 * pin that no two differently-meaning states land on the same family.
 */
const RUNNING_HUE = 'info';
const DONE_HUE = 'ok';
const FAILED_HUE = 'err';
const WAITING_HUE = 'off';

const CASES: Array<[PillStatus, string]> = [
  ['PENDING', WAITING_HUE],
  ['READY', WAITING_HUE],
  ['CANCELLED', WAITING_HUE],
  ['BLOCKED', WAITING_HUE],
  ['DONE', DONE_HUE],
  ['RUNNING', RUNNING_HUE],
  ['IN_PROGRESS', RUNNING_HUE],
  ['FAILED', FAILED_HUE],
];

describe('StatusPill', () => {
  it.each(CASES)('renders %s verbatim in its hue family', (status, hue) => {
    const html = render(status);
    expect(html).toContain(`>${status}`);
    expect(html).toContain(`bg-[var(--pl-${hue}-bg)]`);
    expect(html).toContain(`text-[var(--pl-${hue}-text)]`);
  });

  it('keeps 채도비 by taking all three roles from the SAME ramp', () => {
    // The whole point of the hue map: fill/ink/stroke are the same rung of one
    // ramp per state, so saturation matches across the four by construction. A
    // tone that borrows an ink from another family would break that silently.
    for (const [status, hue] of CASES) {
      const html = render(status);
      expect(html).toContain(`border-[var(--pl-${hue}-border)]`);
      for (const other of [RUNNING_HUE, DONE_HUE, FAILED_HUE, WAITING_HUE]) {
        if (other !== hue) expect(html).not.toContain(`--pl-${other}-`);
      }
    }
  });

  it('gives each meaning its own hue — nothing reads like FAILED but is not', () => {
    const tone = (status: PillStatus): string =>
      render(status).match(/bg-\[var\(--pl-[a-z]+-bg\)\]/)?.[0] ?? '';
    const [running, done, failed, pending] = (
      ['RUNNING', 'DONE', 'FAILED', 'PENDING'] as PillStatus[]
    ).map(tone);
    expect(new Set([running, done, failed, pending]).size).toBe(4);
  });

  it('is text only — the glyph that made RUNNING read as a button is gone', () => {
    for (const [status] of CASES) {
      expect(render(status)).not.toContain('<svg');
    }
  });

  it('lg size switches to the h28 pill', () => {
    expect(render('RUNNING', 'lg')).toContain('h-7');
  });
});
