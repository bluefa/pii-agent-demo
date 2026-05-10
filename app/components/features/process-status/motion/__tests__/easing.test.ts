import { describe, it, expect } from 'vitest';
import {
  easeOutQuart,
  easeOutCubic,
  invEaseOutQuart,
  clamp01,
} from '@/app/components/features/process-status/motion/easing';

describe('easing', () => {
  it('easeOutQuart maps 0 -> 0 and 1 -> 1', () => {
    expect(easeOutQuart(0)).toBe(0);
    expect(easeOutQuart(1)).toBe(1);
  });

  it('easeOutQuart at 0.5 is around 0.9375', () => {
    expect(easeOutQuart(0.5)).toBeCloseTo(0.9375, 4);
  });

  it('easeOutCubic maps 0 -> 0 and 1 -> 1', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it('invEaseOutQuart inverts easeOutQuart', () => {
    [0.1, 0.3, 0.5, 0.7, 0.9].forEach((t) => {
      const y = easeOutQuart(t);
      expect(invEaseOutQuart(y)).toBeCloseTo(t, 6);
    });
  });

  it('invEaseOutQuart(0.98) is around 0.624', () => {
    expect(invEaseOutQuart(0.98)).toBeCloseTo(0.624, 3);
  });

  it('clamp01 clamps below 0 and above 1', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1)).toBe(1);
    expect(clamp01(1.5)).toBe(1);
  });
});
