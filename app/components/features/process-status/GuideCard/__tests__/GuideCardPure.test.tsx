/**
 * Tests for `GuideCardPure` (W4-a §Step 3).
 *
 * The component is fully synchronous (no hooks, no effects), so
 * `renderToStaticMarkup` suffices — we do not need @testing-library
 * or a DOM environment. The vitest config pins the env to `'node'`
 * (see `vitest.config.ts`).
 */

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { GuideCardPure } from '@/app/components/features/process-status/GuideCard/GuideCardPure';

const render = (node: React.ReactElement): string => renderToStaticMarkup(node);

describe('GuideCardPure — valid content', () => {
  it('renders the AST with the card shell and header', () => {
    const html = render(
      <GuideCardPure content="<h4>Title</h4><p>body text</p>" />,
    );
    expect(html).toContain('<h4>Title</h4>');
    expect(html).toContain('<p>body text</p>');
    expect(html).toContain('가이드');
    expect(html).toContain('prose-guide');
  });

  it('omits the header when showHeader={false}', () => {
    const html = render(
      <GuideCardPure content="<p>body</p>" showHeader={false} />,
    );
    expect(html).not.toContain('가이드</h2>');
    expect(html).toContain('<p>body</p>');
  });

  it('renders anchors with href / target / rel preserved', () => {
    const html = render(
      <GuideCardPure content='<p><a href="https://example.com" target="_blank" rel="noopener">link</a></p>' />,
    );
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener"');
  });
});

describe('GuideCardPure — invalid content', () => {
  it('falls back to the generic enduser message by default', () => {
    const html = render(<GuideCardPure content="<script>alert(1)</script>" />);
    expect(html).toContain('가이드를 불러올 수 없습니다');
    // No diagnostic detail should leak.
    expect(html).not.toContain('DISALLOWED_TAG');
  });

  it('surfaces full error detail when invalidVariant="admin"', () => {
    const html = render(
      <GuideCardPure
        content="<script>alert(1)</script>"
        invalidVariant="admin"
      />,
    );
    expect(html).toContain('가이드 콘텐츠 검증 실패');
    expect(html).toContain('DISALLOWED_TAG');
  });

  it('reports EMPTY_CONTENT on whitespace-only input (admin)', () => {
    const html = render(<GuideCardPure content="   " invalidVariant="admin" />);
    expect(html).toContain('EMPTY_CONTENT');
  });
});

describe('GuideCardPure — no dangerouslySetInnerHTML', () => {
  it('never emits raw innerHTML-bearing attributes in the markup', () => {
    const html = render(
      <GuideCardPure content="<h4>Title</h4><p>body</p>" />,
    );
    // renderToStaticMarkup would surface this as the plain HTML attr if
    // dangerouslySetInnerHTML had been used anywhere in the tree.
    expect(html).not.toContain('__html');
  });
});
