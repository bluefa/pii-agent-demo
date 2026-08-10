/**
 * Resource Name column geometry — the four tokens that share one 30px seat.
 *
 * `nameCell`'s padding is not a spacing choice, it is a budget: the `verdictRail`
 * inset, the clearance from it, the hanging chevron box, and the gap to the first
 * letter. The budget lived only in a comment, and the comment was wrong — it read
 * "4px clears the verdictRail" for a 4px rail, which is touching, not clearing. An
 * excluded RDS cluster in step 2 showed a blue control glued to the magenta bar.
 *
 * Each `it` below is one term of that budget, derived from the tokens themselves so
 * changing a token re-runs the arithmetic instead of aging a comment.
 */
import { describe, expect, it } from 'vitest';
import { idcStyles, verdictRail } from '@/lib/theme';

/** `pl-[30px]` / `before:left-[16px]` → 30 / 16. */
const px = (token: string, pattern: RegExp): number => {
  const m = token.match(pattern);
  if (!m) throw new Error(`no ${pattern} in ${token}`);
  return Number(m[1]);
};

const { nameCell, group } = idcStyles.table;

const RAIL_WIDTH = px(verdictRail.excluded, /inset_(\d+)px/);
/** `h-4 w-4` — Tailwind spacing 4. */
const CHEVRON_BOX = 16;
/** `after:-inset-1` — the hit halo grows the pressable target on every side. */
const HALO = 4;
/** The tier between a group parent's name and its children's. */
const CHILD_INDENT = 24;

const namePad = px(nameCell, /pl-\[(\d+)px\]/);
const chevronLeft = namePad - px(group.toggle, /-left-\[(\d+)px\]/);
const chevronRight = chevronLeft + CHEVRON_BOX;

describe('Resource Name cell geometry', () => {
  it('keeps the chevron box clear of the verdict rail, not merely adjacent', () => {
    expect(chevronLeft).toBeGreaterThanOrEqual(RAIL_WIDTH + 4);
  });

  it('keeps the chevron hit halo off the rail too', () => {
    expect(chevronLeft - HALO).toBeGreaterThanOrEqual(RAIL_WIDTH);
  });

  it('leaves the chevron room before the first letter of the name', () => {
    expect(namePad - chevronRight).toBeGreaterThanOrEqual(6);
  });

  it('centres the group trunk and elbow under the chevron', () => {
    const centre = chevronLeft + CHEVRON_BOX / 2;
    expect(px(group.childCell, /before:left-\[(\d+)px\]/)).toBe(centre);
    expect(px(group.childCell, /after:left-\[(\d+)px\]/)).toBe(centre);
    expect(px(group.parentCell, /after:left-\[(\d+)px\]/)).toBe(centre);
  });

  it('holds the child indent one tier below the name column', () => {
    expect(px(group.childCell, /pl-\[(\d+)px\]/) - namePad).toBe(CHILD_INDENT);
  });
});
