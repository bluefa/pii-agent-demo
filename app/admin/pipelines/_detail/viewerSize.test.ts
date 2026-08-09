import { describe, expect, it } from 'vitest';
import { resizeFromDrag } from '@/app/admin/pipelines/_detail/JobViewer';

const base = { w: 720, h: 572 };
const room = { vw: 4000, vh: 4000 };

describe('resizeFromDrag — job viewer grip', () => {
  it('doubles the pointer delta so the grip tracks the cursor on a centered dialog', () => {
    expect(resizeFromDrag(base, 100, 50, room.vw, room.vh)).toEqual({ w: 920, h: 672 });
  });

  it('shrinks on a negative drag but never below the minimum', () => {
    expect(resizeFromDrag(base, -60, -40, room.vw, room.vh)).toEqual({ w: 600, h: 492 });
    expect(resizeFromDrag(base, -900, -900, room.vw, room.vh)).toEqual({ w: 480, h: 360 });
  });

  it('stops at the viewport ceiling', () => {
    expect(resizeFromDrag(base, 5000, 5000, 1000, 800)).toEqual({ w: 950, h: 720 });
  });
});
