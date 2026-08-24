/**
 * Tests for `renderGuideAst` (spec §5.3 Layer C).
 *
 * The renderer must:
 *  - emit one React element per allowed node type
 *  - preserve `<a>` href/target/rel attributes
 *  - never fall back to `dangerouslySetInnerHTML`
 *
 * We render via `react-dom/server` to inspect the resulting HTML
 * without requiring `@testing-library/react` (vitest environment is
 * `node`, see `vitest.config.ts`).
 */

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { renderGuideAst } from '@/app/components/features/process-status/GuideCard/render-guide-ast';
import { guideStyles } from '@/lib/theme';
import type { GuideNode } from '@/lib/utils/validate-guide-html';

const render = (ast: GuideNode[]): string => renderToStaticMarkup(<>{renderGuideAst(ast)}</>);

describe('renderGuideAst — per-node output', () => {
  it('renders text nodes as raw strings', () => {
    expect(render([{ type: 'text', value: 'plain' }])).toBe('plain');
  });

  it('renders <br> as a self-closing element', () => {
    expect(render([{ type: 'br' }])).toBe('<br/>');
  });

  it('renders <h4> / <p> wrappers with children', () => {
    const html = render([
      { type: 'h4', children: [{ type: 'text', value: 'Title' }] },
      { type: 'p', children: [{ type: 'text', value: 'body' }] },
    ]);
    expect(html).toBe('<h4>Title</h4><p>body</p>');
  });

  it('renders inline formatting (strong / em / code)', () => {
    const html = render([
      {
        type: 'p',
        children: [
          { type: 'strong', children: [{ type: 'text', value: 'b' }] },
          { type: 'em', children: [{ type: 'text', value: 'i' }] },
          { type: 'code', children: [{ type: 'text', value: 'c' }] },
        ],
      },
    ]);
    expect(html).toBe(
      `<p><strong>b</strong><em class="${guideStyles.accent}">i</em><code>c</code></p>`,
    );
  });

  it('renders <em> as brand-coloured emphasis, never as slant', () => {
    const html = render([{ type: 'em', children: [{ type: 'text', value: '담당자에게 문의' }] }]);
    // ⛔ Italics do not exist for 한글 in any useful sense — this tag was repurposed.
    expect(html).toContain('not-italic');
    expect(html).toContain('#0050D6');
  });

  it('renders <blockquote> as the 안내 박스 card', () => {
    const html = render([{ type: 'blockquote', children: [{ type: 'text', value: '안내' }] }]);
    expect(html).toBe(`<blockquote class="${guideStyles.note}">안내</blockquote>`);
    // ⛔ The fill is ~1.09:1 on white; the hairline is what makes it a card.
    //
    // The bare `border` is the load-bearing half and it must be its own class. Tailwind v4
    // preflight sets `border-width: 0` on every element, so a colour with no width paints
    // nothing at all — and `toContain('border')` was satisfied by the colour utility on
    // its own, which let the box lose its only separation with the whole suite green.
    const note = guideStyles.note.split(/\s+/);
    expect(note).toContain('border');
    expect(note.some((c) => c.startsWith('border-'))).toBe(true);
  });

  it('renders <ul> / <ol> with <li> children', () => {
    const html = render([
      {
        type: 'ul',
        children: [
          { type: 'li', children: [{ type: 'text', value: 'one' }] },
          { type: 'li', children: [{ type: 'text', value: 'two' }] },
        ],
      },
      {
        type: 'ol',
        children: [{ type: 'li', children: [{ type: 'text', value: 'a' }] }],
      },
    ]);
    expect(html).toBe('<ul><li>one</li><li>two</li></ul><ol><li>a</li></ol>');
  });
});

describe('renderGuideAst — the step-guide shapes', () => {
  const bar: GuideNode = {
    type: 'details',
    children: [{ type: 'summary', children: [{ type: 'text', value: '실행 권한 부여 가이드' }] }],
  };

  it('draws 참고 가이드 바 as a static row, never a real disclosure', () => {
    const html = render([bar]);
    // ⛔ Not a `<details>`: there is no panel behind it, and a toggle that opens nothing
    // offers the reader something the guide cannot deliver.
    expect(html).not.toContain('<details');
    expect(html).not.toContain('<summary');
    // `refBar` ends in `content-['▶']`, and React escapes the quotes on the way into the
    // attribute — compare against what actually lands in the HTML, not the token.
    expect(html).toContain(guideStyles.refBar.replace(/'/g, '&#x27;'));
    expect(html).toContain('실행 권한 부여 가이드');
  });

  it('draws 작업 이름표 on a <mark> that carries the pill', () => {
    const html = render([{ type: 'mark', children: [{ type: 'text', value: '자동 설치' }] }]);
    expect(html).toContain(`<mark class="${guideStyles.pill}">자동 설치</mark>`);
  });

  /**
   * The numbered circle is the caller's declaration, not the markup's — the same renderer
   * draws notices, whose ordered lists are lists rather than procedures. Both directions
   * are asserted: opting in without ever opting out would let the class leak to posts.
   */
  const list: GuideNode[] = [
    { type: 'ol', children: [{ type: 'li', children: [{ type: 'text', value: '하나' }] }] },
  ];

  it('marks <ol> as a procedure only when the caller asks', () => {
    expect(renderToStaticMarkup(<>{renderGuideAst(list, { steps: true })}</>)).toContain(
      '<ol class="guide-steps">',
    );
  });

  it('leaves <ol> unmarked by default — a notice list is not a procedure', () => {
    expect(render(list)).toBe('<ol><li>하나</li></ol>');
  });

  it('does not carry the procedure flag over to the next render', () => {
    // The flag is module-level, like `keyCounter`. Were it not reset per call, one guide
    // render would turn every later notice's ordered list into a stepper.
    renderGuideAst(list, { steps: true });
    expect(render(list)).not.toContain('guide-steps');
  });
});

describe('renderGuideAst — anchor attributes', () => {
  it('passes through href / target / rel', () => {
    const html = render([
      {
        type: 'a',
        href: 'https://example.com',
        target: '_blank',
        rel: 'noopener noreferrer',
        children: [{ type: 'text', value: 'ex' }],
      },
    ]);
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('>ex</a>');
  });

  it('omits absent target / rel on <a>', () => {
    const html = render([
      {
        type: 'a',
        href: 'https://example.com',
        children: [{ type: 'text', value: 'ex' }],
      },
    ]);
    expect(html).toContain('href="https://example.com"');
    expect(html).not.toContain('target=');
    expect(html).not.toContain('rel=');
  });
});

describe('renderGuideAst — keys reset per call', () => {
  // If the internal counter were not reset, rendering the same AST
  // twice in a row would yield different keys and (more importantly)
  // React would warn about non-stable keys across remounts. We inspect
  // the HTML is identical, which indirectly confirms the counter reset
  // and also demonstrates the function is deterministic.
  it('produces identical markup on repeated invocations', () => {
    const ast: GuideNode[] = [
      {
        type: 'ul',
        children: Array.from({ length: 10 }, (_, i) => ({
          type: 'li' as const,
          children: [{ type: 'text' as const, value: `item ${i}` }],
        })),
      },
    ];
    const a = render(ast);
    const b = render(ast);
    expect(a).toBe(b);
  });
});

describe('renderGuideAst — security', () => {
  // Hard requirement: the renderer source must not use
  // dangerouslySetInnerHTML or .innerHTML anywhere in executable code.
  // The docstring is allowed to mention these names for documentation
  // purposes, so we strip block / line comments before asserting.
  it('source has no dangerouslySetInnerHTML / innerHTML in code', () => {
    const sourcePath = resolve(__dirname, '..', 'render-guide-ast.tsx');
    const src = readFileSync(sourcePath, 'utf8');
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
      .replace(/\/\/.*$/gm, '');         // line comments
    expect(stripped).not.toContain('dangerouslySetInnerHTML');
    expect(stripped).not.toContain('innerHTML');
  });
});
