/**
 * Guide CMS — HTML allow-list validator (isomorphic).
 *
 * Spec: docs/reports/guide-cms/spec.md §5.
 *
 * Parses guide HTML and either returns a typed AST ready for
 * `renderGuideAst()` or the full list of validation errors. No
 * sanitization — invalid input is rejected, never silently rewritten.
 *
 * Runtime: works in both the browser (`window.DOMParser`) and Node
 * (`linkedom`). The linkedom import is deferred to first call so that
 * client bundles do not pull it in.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GuideNode =
  | { type: 'h4' | 'p'; children: GuideNode[] }
  | { type: 'br' }
  | { type: 'ul' | 'ol'; children: GuideNode[] }
  | { type: 'li'; children: GuideNode[] }
  | { type: 'strong' | 'em' | 'code'; children: GuideNode[] }
  | { type: 'a'; href: string; target?: string; rel?: string; children: GuideNode[] }
  | { type: 'text'; value: string };

export interface ValidationError {
  code:
    | 'DISALLOWED_TAG'
    | 'DISALLOWED_ATTRIBUTE'
    | 'INVALID_URL_SCHEME'
    | 'INVALID_NESTING'
    | 'PARSE_ERROR'
    | 'EMPTY_CONTENT';
  message: string;
  tagName?: string;
  path?: string;
}

export type ValidationResult =
  | { valid: true; ast: GuideNode[] }
  | { valid: false; errors: ValidationError[] };

// ---------------------------------------------------------------------------
// Allow-list
// ---------------------------------------------------------------------------

const ALLOWED_TAGS = new Set([
  'h4',
  'p',
  'br',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'code',
  'a',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
};

/**
 * Allowed URL schemes for `<a href>`.
 * - `https?://` — absolute http/https URLs
 * - `mailto:`   — mail links
 * - `/(?!/)`    — internal absolute paths, but *not* protocol-relative `//host`
 */
const URL_SCHEME_RE = /^(https?:\/\/|mailto:|\/(?!\/))/;

// DOM node type constants (Node.ELEMENT_NODE etc.) — hard-coded to avoid
// depending on a runtime Node global that differs between linkedom and the
// browser.
const NODE_TYPE_ELEMENT = 1;
const NODE_TYPE_TEXT = 3;

// ---------------------------------------------------------------------------
// Isomorphic parser
// ---------------------------------------------------------------------------

type ParseFn = (html: string) => ParsedBody;

interface ParsedBody {
  childNodes: ArrayLike<DomNode>;
}

/**
 * Minimal structural subset of DOM nodes used by the validator. Both
 * browser DOM and linkedom satisfy this shape, so the validator can walk
 * either tree without a runtime type switch.
 */
interface DomNode {
  nodeType: number;
  nodeName: string;
  tagName?: string;
  textContent: string | null;
  childNodes: ArrayLike<DomNode>;
  getAttribute?(name: string): string | null;
  getAttributeNames?(): string[];
}

let cachedParse: ParseFn | null = null;

const getParse = (): ParseFn => {
  if (cachedParse) return cachedParse;

  // Client: use the built-in DOMParser.
  if (typeof globalThis !== 'undefined' && typeof (globalThis as { DOMParser?: unknown }).DOMParser !== 'undefined') {
    const parser = new (globalThis as unknown as { DOMParser: new () => { parseFromString(src: string, type: string): { body: ParsedBody } } }).DOMParser();
    cachedParse = (html: string) => {
      const doc = parser.parseFromString(wrapBodyShell(html), 'text/html');
      return doc.body;
    };
    return cachedParse;
  }

  // Server: lazy-load linkedom. Require is used to keep the import
  // synchronous and out of the client bundle.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const linkedom = require('linkedom') as {
    DOMParser: new () => { parseFromString(src: string, type: string): { body: ParsedBody } };
  };
  const serverParser = new linkedom.DOMParser();
  cachedParse = (html: string) => {
    const doc = serverParser.parseFromString(wrapBodyShell(html), 'text/html');
    return doc.body;
  };
  return cachedParse;
};

/**
 * Wraps arbitrary HTML in a full document shell. linkedom throws when
 * `document.body` is accessed on a document parsed from bodiless input
 * such as `''` or a bare `<script>...</script>`. Browser DOMParser does
 * not need this wrap but is unaffected by it.
 */
const wrapBodyShell = (html: string): string =>
  `<!DOCTYPE html><html><body>${html}</body></html>`;

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

export function validateGuideHtml(html: string): ValidationResult {
  const errors: ValidationError[] = [];

  // Fast path: entirely empty or whitespace-only input never produces
  // visible text, so surface EMPTY_CONTENT immediately without parsing.
  if (html.trim().length === 0) {
    return {
      valid: false,
      errors: [{ code: 'EMPTY_CONTENT', message: '빈 콘텐츠' }],
    };
  }

  let body: ParsedBody;
  try {
    body = getParse()(html);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      errors: [{ code: 'PARSE_ERROR', message: `HTML 파싱 실패: ${message}` }],
    };
  }

  const ast = visitChildren(body.childNodes, { parent: null, anchorDepth: 0, path: '' }, errors);

  // Visible-text emptiness: strip all markup and verify the remaining
  // characters contain something other than whitespace.
  if (!hasVisibleText(ast)) {
    errors.push({ code: 'EMPTY_CONTENT', message: '빈 콘텐츠' });
  }

  return errors.length === 0 ? { valid: true, ast } : { valid: false, errors };
}

// ---------------------------------------------------------------------------
// Tree walk
// ---------------------------------------------------------------------------

interface VisitContext {
  /** Parent tag name in lower-case, or `null` at the top level. */
  parent: string | null;
  /** Depth count of ancestor `<a>` tags (anchors cannot nest). */
  anchorDepth: number;
  /** Path expression for error messages, e.g. `ul[0] > li[2]`. */
  path: string;
}

const visitChildren = (
  nodes: ArrayLike<DomNode>,
  ctx: VisitContext,
  errors: ValidationError[],
): GuideNode[] => {
  const out: GuideNode[] = [];
  const indexByTag = new Map<string, number>();

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    if (node.nodeType === NODE_TYPE_TEXT) {
      const text = node.textContent ?? '';
      // Inside `<ul>` / `<ol>` only whitespace text is acceptable (HTML
      // frequently includes newline whitespace between `<li>` children
      // during formatting); non-whitespace text is an INVALID_NESTING
      // violation. Outside list containers we keep the text verbatim.
      if (ctx.parent === 'ul' || ctx.parent === 'ol') {
        if (text.trim().length > 0) {
          errors.push({
            code: 'INVALID_NESTING',
            message: `<${ctx.parent}>의 직계 자식은 <li>만 허용됩니다`,
            path: `${ctx.path || '<root>'} > #text`,
          });
        }
        continue;
      }
      if (text.length > 0) out.push({ type: 'text', value: text });
      continue;
    }

    if (node.nodeType !== NODE_TYPE_ELEMENT) {
      // Comments and other node types are silently dropped.
      continue;
    }

    const tag = (node.tagName ?? node.nodeName).toLowerCase();
    const tagIndex = indexByTag.get(tag) ?? 0;
    indexByTag.set(tag, tagIndex + 1);
    const segment = `${tag}[${tagIndex}]`;
    const childPath = ctx.path ? `${ctx.path} > ${segment}` : segment;

    if (!ALLOWED_TAGS.has(tag)) {
      errors.push({
        code: 'DISALLOWED_TAG',
        message: `허용되지 않은 태그: <${tag}>`,
        tagName: tag,
        path: childPath,
      });
      continue;
    }

    // Attribute allow-list — every tag may restrict attrs; tags missing
    // from the map forbid attributes entirely.
    const allowedAttrs = ALLOWED_ATTRS[tag] ?? new Set<string>();
    const attrNames = node.getAttributeNames?.() ?? [];
    for (const attrName of attrNames) {
      if (!allowedAttrs.has(attrName)) {
        errors.push({
          code: 'DISALLOWED_ATTRIBUTE',
          message: `<${tag}>에서 허용되지 않은 속성: ${attrName}`,
          tagName: tag,
          path: childPath,
        });
      }
    }

    // Structural rules -------------------------------------------------
    if (tag === 'li' && ctx.parent !== 'ul' && ctx.parent !== 'ol') {
      errors.push({
        code: 'INVALID_NESTING',
        message: '<li>는 <ul> 또는 <ol> 내부에서만 사용할 수 있습니다',
        tagName: 'li',
        path: childPath,
      });
    }
    if ((ctx.parent === 'ul' || ctx.parent === 'ol') && tag !== 'li') {
      errors.push({
        code: 'INVALID_NESTING',
        message: `<${ctx.parent}>의 직계 자식은 <li>만 허용됩니다`,
        tagName: tag,
        path: childPath,
      });
    }
    if (tag === 'a' && ctx.anchorDepth > 0) {
      errors.push({
        code: 'INVALID_NESTING',
        message: '<a> 내부에 다른 <a>를 중첩할 수 없습니다',
        tagName: 'a',
        path: childPath,
      });
    }

    // Recurse ----------------------------------------------------------
    const childCtx: VisitContext = {
      parent: tag,
      anchorDepth: tag === 'a' ? ctx.anchorDepth + 1 : ctx.anchorDepth,
      path: childPath,
    };
    const children = visitChildren(node.childNodes, childCtx, errors);

    // Assemble AST node ------------------------------------------------
    const astNode = toAstNode(tag, node, children, childPath, errors);
    if (astNode) out.push(astNode);
  }

  return out;
};

const toAstNode = (
  tag: string,
  node: DomNode,
  children: GuideNode[],
  path: string,
  errors: ValidationError[],
): GuideNode | null => {
  switch (tag) {
    case 'br':
      return { type: 'br' };
    case 'h4':
    case 'p':
      return { type: tag, children };
    case 'ul':
    case 'ol':
      return { type: tag, children };
    case 'li':
      return { type: 'li', children };
    case 'strong':
    case 'em':
    case 'code':
      return { type: tag, children };
    case 'a': {
      const href = node.getAttribute?.('href') ?? '';
      if (!URL_SCHEME_RE.test(href)) {
        errors.push({
          code: 'INVALID_URL_SCHEME',
          message: `허용되지 않은 URL 스킴: ${href || '(empty)'}`,
          tagName: 'a',
          path,
        });
      }
      const targetAttr = node.getAttribute?.('target');
      const relAttr = node.getAttribute?.('rel');
      const anchor: GuideNode = {
        type: 'a',
        href,
        children,
        ...(targetAttr ? { target: targetAttr } : {}),
        ...(relAttr ? { rel: relAttr } : {}),
      };
      return anchor;
    }
    default:
      // Unreachable: DISALLOWED_TAG is caught before reaching here.
      return null;
  }
};

// ---------------------------------------------------------------------------
// Visible-text probe
// ---------------------------------------------------------------------------

const hasVisibleText = (ast: GuideNode[]): boolean => {
  for (const node of ast) {
    if (node.type === 'text') {
      if (node.value.trim().length > 0) return true;
      continue;
    }
    if (node.type === 'br') continue;
    if (hasVisibleText(node.children)) return true;
  }
  return false;
};
