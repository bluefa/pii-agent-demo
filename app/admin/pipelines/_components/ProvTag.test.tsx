// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';

afterEach(cleanup);

describe('ProvTag', () => {
  it('reads an SDU target as SDU, not as its underlying CSP', () => {
    render(<ProvTag provider="AWS" isSdu />);
    expect(screen.getByText('SDU')).toBeTruthy();
    expect(screen.queryByText('AWS')).toBeNull();
  });

  it('keeps the 중국 chip on an SDU target', () => {
    render(<ProvTag provider="AWS" isSdu isChina />);
    expect(screen.getByText('SDU')).toBeTruthy();
    expect(screen.getByText('중국')).toBeTruthy();
  });

  it('draws no chip when the flag is absent', () => {
    render(<ProvTag provider="AWS" />);
    expect(screen.getByText('AWS')).toBeTruthy();
    expect(screen.queryByText('중국')).toBeNull();
  });
});
