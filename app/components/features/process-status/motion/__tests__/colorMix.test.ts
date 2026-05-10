import { describe, it, expect } from 'vitest';
import { mixHex } from '@/app/components/features/process-status/motion/colorMix';

describe('mixHex', () => {
  it('returns the from color at t=0', () => {
    expect(mixHex('#000000', '#FFFFFF', 0)).toBe('rgb(0 0 0)');
  });

  it('returns the to color at t=1', () => {
    expect(mixHex('#000000', '#FFFFFF', 1)).toBe('rgb(255 255 255)');
  });

  it('interpolates midpoint at t=0.5', () => {
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('rgb(128 128 128)');
  });

  it('interpolates per channel for primary -> success', () => {
    // primary #0064FF (R=0, G=100, B=255) -> success #45CB85 (R=69, G=203, B=133) at t=0.5
    // R: 0   + (69  - 0)   * 0.5 = 34.5  -> 35
    // G: 100 + (203 - 100) * 0.5 = 151.5 -> 152
    // B: 255 + (133 - 255) * 0.5 = 194   -> 194
    expect(mixHex('#0064FF', '#45CB85', 0.5)).toBe('rgb(35 152 194)');
  });

  it('handles short hex without alpha cleanly', () => {
    expect(mixHex('#0064FF', '#0064FF', 0.7)).toBe('rgb(0 100 255)');
  });
});
