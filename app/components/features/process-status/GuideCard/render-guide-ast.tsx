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

export interface RenderGuideAstOptions {
  /**
   * Draw `<ol>` as the step-guide procedure — the numbered circle the source uses — rather
   * than an ordinary ordered list.
   *
   * The CALLER's declaration, not the markup's, because the same renderer serves two
   * surfaces. A step guide's `<ol>` really is a sequence; an ordered list in a notice is a
   * list, and filled circles would claim an order of operations it does not have.
   */
  steps?: boolean;
}

export const renderGuideAst = (
  ast: GuideNode[],
  { steps = false }: RenderGuideAstOptions = {},
): ReactNode[] => {
  keyCounter = 0;
  return ast.map((node) => renderNode(node, steps));
};

/**
 * `steps` is threaded rather than held in a module-level flag. A flag is correct only while
 * every branch below materializes its children inside this synchronous walk — true today,
 * and one refactor from false: the moment 참고 가이드 바 becomes a real disclosure that
 * renders children on toggle, those children are built at React render time, after the next
 * caller has already overwritten the flag, and a notice's list silently becomes a stepper.
 * A wrong key is cosmetic; a wrong flag is a wrong visual claim, so this one does not get
 * `keyCounter`'s treatment.
 */
const renderNode = (node: GuideNode, steps: boolean): ReactNode => {
  const kids = (children: GuideNode[]): ReactNode[] =>
    children.map((child) => renderNode(child, steps));

  switch (node.type) {
    case 'text':
      return node.value;
    case 'br':
      return <br key={nextKey()} />;
    case 'h4':
      return <h4 key={nextKey()}>{kids(node.children)}</h4>;
    case 'p':
      return <p key={nextKey()}>{kids(node.children)}</p>;
    // 안내 박스. The class comes from the renderer, not the markup — the allow-list
    // gives an author no class or style attribute, which is the point.
    case 'blockquote':
      return (
        <blockquote key={nextKey()} className={guideStyles.note}>
          {kids(node.children)}
        </blockquote>
      );
    case 'ul':
      return <ul key={nextKey()}>{kids(node.children)}</ul>;
    case 'ol':
      // A plain class name, not a `guideStyles` token: the circle is a `::before` carrying
      // a CSS counter, which has no Tailwind spelling. `globals.css` owns `.guide-steps`.
      return (
        <ol key={nextKey()} className={steps ? 'guide-steps' : undefined}>
          {kids(node.children)}
        </ol>
      );
    case 'li':
      return <li key={nextKey()}>{kids(node.children)}</li>;
    case 'strong':
      return <strong key={nextKey()}>{kids(node.children)}</strong>;
    // Brand-coloured emphasis, not slant — see `guideStyles.accent`.
    case 'em':
      return (
        <em key={nextKey()} className={guideStyles.accent}>
          {kids(node.children)}
        </em>
      );
    case 'code':
      return <code key={nextKey()}>{kids(node.children)}</code>;
    // 참고 가이드 바. A `<div>`, not a `<details>`: the source draws an accent row with
    // `cursor: default` and nothing behind it, so a real disclosure would offer to open a
    // panel that does not exist. The ▶ comes from `refBar`'s ::after — decoration, not a
    // state indicator, which is why it never flips.
    case 'details':
      return (
        <div key={nextKey()} className={guideStyles.refBar}>
          {kids(node.children)}
        </div>
      );
    // The bar's label. It carries no box of its own — the bar above is the box.
    case 'summary':
      return <span key={nextKey()}>{kids(node.children)}</span>;
    // 작업 이름표 — see `guideStyles.pill`.
    case 'mark':
      return (
        <mark key={nextKey()} className={guideStyles.pill}>
          {kids(node.children)}
        </mark>
      );
    case 'a':
      return (
        <a key={nextKey()} href={node.href} target={node.target} rel={node.rel}>
          {kids(node.children)}
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
