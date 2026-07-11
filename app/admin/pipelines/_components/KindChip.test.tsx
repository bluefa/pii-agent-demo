import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { KindChip } from '@/app/admin/pipelines/_components/KindChip';

describe('KindChip', () => {
  it('TERRAFORM_JOB — neutral, NO border', () => {
    const html = renderToStaticMarkup(<KindChip kind="TERRAFORM_JOB" />);
    expect(html).toContain('TERRAFORM_JOB');
    expect(html).toContain('bg-[var(--pl-off-bg)]');
    expect(html).not.toContain('border-dashed');
  });

  it('CONDITION_CHECK — dashed gray-300 border variant', () => {
    const html = renderToStaticMarkup(<KindChip kind="CONDITION_CHECK" />);
    expect(html).toContain('CONDITION_CHECK');
    expect(html).toContain('border-dashed');
    expect(html).toContain('border-[var(--pl-gray-300)]');
  });
});
