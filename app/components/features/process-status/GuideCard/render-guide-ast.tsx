/**
 * Guide CMS — AST to React renderer.
 *
 * Spec: docs/reports/guide-cms/spec.md §5.3 Layer C.
 *
 * Walks a validated {@link GuideNode} tree and emits a React tree via
 * {@link React.createElement}. The renderer deliberately uses JSX only
 * for well-typed allow-list nodes. `dangerouslySetInnerHTML` is never
 * used; unknown node shapes are rejected at compile time via an
 * exhaustive `never` check.
 */

import type { ReactNode } from 'react';

import { guideStyles } from '@/lib/theme';
import type { GuideNode } from '@/lib/utils/validate-guide-html';

let keyCounter = 0;
const nextKey = (): string => `guide-node-${keyCounter++}`;

export const renderGuideAst = (ast: GuideNode[]): ReactNode[] => {
  keyCounter = 0;
  return ast.map(renderNode);
};

const renderNode = (node: GuideNode): ReactNode => {
  switch (node.type) {
    case 'text':
      return node.value;
    case 'br':
      return <br key={nextKey()} />;
    case 'h4':
      return <h4 key={nextKey()}>{node.children.map(renderNode)}</h4>;
    case 'p':
      return <p key={nextKey()}>{node.children.map(renderNode)}</p>;
    // 안내 박스. The class comes from the renderer, not the markup — the allow-list
    // gives an author no class or style attribute, which is the point.
    case 'blockquote':
      return (
        <blockquote key={nextKey()} className={guideStyles.note}>
          {node.children.map(renderNode)}
        </blockquote>
      );
    case 'ul':
      return <ul key={nextKey()}>{node.children.map(renderNode)}</ul>;
    case 'ol':
      return <ol key={nextKey()}>{node.children.map(renderNode)}</ol>;
    case 'li':
      return <li key={nextKey()}>{node.children.map(renderNode)}</li>;
    case 'strong':
      return <strong key={nextKey()}>{node.children.map(renderNode)}</strong>;
    // Brand-coloured emphasis, not slant — see `guideStyles.accent`.
    case 'em':
      return (
        <em key={nextKey()} className={guideStyles.accent}>
          {node.children.map(renderNode)}
        </em>
      );
    case 'code':
      return <code key={nextKey()}>{node.children.map(renderNode)}</code>;
    // 참고 가이드 바. A `<div>`, not a `<details>`: the source draws an accent row with
    // `cursor: default` and nothing behind it, so a real disclosure would offer to open a
    // panel that does not exist. The ▶ comes from `refBar`'s ::after — decoration, not a
    // state indicator, which is why it never flips.
    case 'details':
      return (
        <div key={nextKey()} className={guideStyles.refBar}>
          {node.children.map(renderNode)}
        </div>
      );
    // The bar's label. It carries no box of its own — the bar above is the box.
    case 'summary':
      return <span key={nextKey()}>{node.children.map(renderNode)}</span>;
    // 작업 이름표 — see `guideStyles.pill`.
    case 'mark':
      return (
        <mark key={nextKey()} className={guideStyles.pill}>
          {node.children.map(renderNode)}
        </mark>
      );
    case 'a':
      return (
        <a key={nextKey()} href={node.href} target={node.target} rel={node.rel}>
          {node.children.map(renderNode)}
        </a>
      );
    case 'img':
      // `loading="lazy"` is not decoration: a collapsed accordion panel keeps
      // its images in the render tree, so without it opening the page would
      // fetch every post's images at once.
      //
      // `width`/`height` are the upload's intrinsic pixel size and reserve the
      // box before the bytes arrive; display width stays with CSS. A plain
      // <img> is deliberate — next/image would need a configured loader for
      // the storage host and buys nothing for content authored as raw HTML.
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={nextKey()}
          src={node.src}
          alt={node.alt}
          width={node.width}
          height={node.height}
          loading="lazy"
        />
      );
    default: {
      const _exhaustive: never = node;
      void _exhaustive;
      return null;
    }
  }
};
