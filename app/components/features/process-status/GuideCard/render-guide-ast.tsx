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
    case 'ul':
      return <ul key={nextKey()}>{node.children.map(renderNode)}</ul>;
    case 'ol':
      return <ol key={nextKey()}>{node.children.map(renderNode)}</ol>;
    case 'li':
      return <li key={nextKey()}>{node.children.map(renderNode)}</li>;
    case 'strong':
      return <strong key={nextKey()}>{node.children.map(renderNode)}</strong>;
    case 'em':
      return <em key={nextKey()}>{node.children.map(renderNode)}</em>;
    case 'code':
      return <code key={nextKey()}>{node.children.map(renderNode)}</code>;
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
