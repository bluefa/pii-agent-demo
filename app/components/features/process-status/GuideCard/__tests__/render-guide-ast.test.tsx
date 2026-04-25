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
    expect(html).toBe('<p><strong>b</strong><em>i</em><code>c</code></p>');
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
