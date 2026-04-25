# W1-b — HTML Allow-list Validator + AST Renderer

> **Recommended model**: **Opus 4.7 MAX** (security critical · 30+ test cases · AST design)
> **Estimated LOC**: ~700 (~400 src + ~300 tests)
> **Branch prefix**: `feat/guide-cms-w1b-validator`
> **Depends on**: W1-a (merged)

## Context

Guide CMS 의 보안 핵심: HTML 콘텐츠를 allow-list 기준으로 **검증** 하고, 검증된 AST 를 **React tree 로 렌더** 한다. `dangerouslySetInnerHTML` 절대 사용 안 함. Server / client 양쪽에서 동작하는 동형 (isomorphic) 구현.

Spec: `docs/reports/guide-cms/spec.md` §5 (HTML allow-list, 3-layer 방어, AST 렌더러)

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
[ -f lib/types/guide.ts ] || { echo "✗ W1-a 미머지"; exit 1; }
[ -f lib/constants/guide-registry.ts ] || { echo "✗ W1-a 미머지"; exit 1; }
[ ! -f lib/utils/validate-guide-html.ts ] || { echo "✗ already exists"; exit 1; }
node -e "const p=require('./package.json'); if (!p.dependencies.linkedom && !p.dependencies.jsdom) { console.error('✗ DOM shim 미설치 — W0 dependency PR 먼저'); process.exit(1); }"
```

## Required reading

1. `docs/reports/guide-cms/spec.md` §5 (전체)
2. `app/components/features/process-status/GuideCard.tsx` (기존 렌더 — 시각 동일하게 만들 대상)
3. `lib/constants/process-guides.ts` `DEFAULT_STEP_GUIDES` (시드 변환 대상 — W1-c 용 실데이터)
4. CLAUDE.md ⛔ #2 (any 금지) · #4 (raw 색상 금지)

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic guide-cms-w1b-validator --prefix feat
```

## Step 2: AST 노드 타입

### `lib/utils/validate-guide-html.ts` (Part 1 — types ~50 LOC)

```ts
export type GuideNode =
  | { type: 'h4' | 'p';                                    children: GuideNode[] }
  | { type: 'br' }
  | { type: 'ul' | 'ol';                                   children: GuideNode[] }
  | { type: 'li';                                          children: GuideNode[] }
  | { type: 'strong' | 'em' | 'code';                      children: GuideNode[] }
  | { type: 'a'; href: string; target?: string; rel?: string; children: GuideNode[] }
  | { type: 'text'; value: string };

export interface ValidationError {
  code: 'DISALLOWED_TAG' | 'DISALLOWED_ATTRIBUTE' | 'INVALID_URL_SCHEME'
      | 'INVALID_NESTING' | 'PARSE_ERROR' | 'EMPTY_CONTENT';
  message: string;
  tagName?: string;
  path?: string;
}

export type ValidationResult =
  | { valid: true;  ast: GuideNode[] }
  | { valid: false; errors: ValidationError[] };
```

## Step 3: 검증 로직 (Part 2 — validator ~250 LOC)

### Allow-list (spec §5.1)

```ts
const ALLOWED_BLOCK_TAGS = ['h4', 'p', 'ul', 'ol', 'li'] as const;
const ALLOWED_INLINE_TAGS = ['strong', 'em', 'code', 'a', 'br'] as const;
const ALLOWED_TAGS = new Set([...ALLOWED_BLOCK_TAGS, ...ALLOWED_INLINE_TAGS]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  // 다른 태그는 속성 일체 금지
};

// spec §5.1: ^(https?:\/\/|mailto:|\/(?!\/))
const URL_SCHEME_RE = /^(https?:\/\/|mailto:|\/(?!\/))/;
```

### Parser

서버 / 클라 동형:
- 클라: `window.DOMParser`
- 서버: `linkedom` (또는 `jsdom`) — W0 결정 따름

```ts
function getDOMParser(): typeof DOMParser {
  if (typeof DOMParser !== 'undefined') return DOMParser;
  // SSR
  const { DOMParser: LinkeDomParser } = require('linkedom');
  return LinkeDomParser;
}

export function validateGuideHtml(html: string): ValidationResult {
  // 1. 빈 콘텐츠 체크 (text strip 후)
  // 2. DOMParser 로 파싱
  // 3. body 자식들 재귀 방문
  //    각 노드: tag allow-list, attr allow-list, URL scheme, 구조 (li 만 ul/ol 자식)
  // 4. 모든 노드 통과 시 ast 반환, 아니면 errors 누적 후 반환
}
```

### 검증 규칙 명세

| 검증 | 위반 시 |
|---|---|
| Tag ∈ ALLOWED_TAGS | `DISALLOWED_TAG` |
| Attr ∈ ALLOWED_ATTRS[tag] (없으면 `Set()` 빈 집합) | `DISALLOWED_ATTRIBUTE` |
| `a.href` matches URL_SCHEME_RE | `INVALID_URL_SCHEME` |
| `<ul>` / `<ol>` 자식은 `<li>` 만 (또는 whitespace text 만) | `INVALID_NESTING` |
| `<li>` 부모는 `<ul>` / `<ol>` 만 | `INVALID_NESTING` |
| `<a>` 안에 `<a>` 중첩 안 됨 | `INVALID_NESTING` |
| Strip 후 visible text length > 0 | `EMPTY_CONTENT` |
| DOMParser parserError | `PARSE_ERROR` |

`<br>`, `<a>` 의 `target`/`rel` 은 통과하면 그대로 AST 에 옮김 (renderer 가 사용).

## Step 4: AST 렌더러 (~100 LOC)

### `app/components/features/process-status/GuideCard/render-guide-ast.tsx`

```ts
import type { GuideNode } from '@/lib/utils/validate-guide-html';

let keyCounter = 0;
const nextKey = () => `guide-node-${keyCounter++}`;

export function renderGuideAst(ast: GuideNode[]): React.ReactNode[] {
  keyCounter = 0;
  return ast.map(renderNode);
}

function renderNode(node: GuideNode): React.ReactNode {
  const key = nextKey();
  switch (node.type) {
    case 'text':   return node.value;  // string 그대로
    case 'br':     return <br key={key} />;
    case 'h4':     return <h4 key={key}>{node.children.map(renderNode)}</h4>;
    case 'p':      return <p key={key}>{node.children.map(renderNode)}</p>;
    case 'ul':     return <ul key={key}>{node.children.map(renderNode)}</ul>;
    case 'ol':     return <ol key={key}>{node.children.map(renderNode)}</ol>;
    case 'li':     return <li key={key}>{node.children.map(renderNode)}</li>;
    case 'strong': return <strong key={key}>{node.children.map(renderNode)}</strong>;
    case 'em':     return <em key={key}>{node.children.map(renderNode)}</em>;
    case 'code':   return <code key={key}>{node.children.map(renderNode)}</code>;
    case 'a':      return (
      <a key={key} href={node.href} target={node.target} rel={node.rel}>
        {node.children.map(renderNode)}
      </a>
    );
    default: { const _: never = node; return null; }
  }
}
```

`dangerouslySetInnerHTML` 사용 금지 — eslint rule 추가 검토 (W1-d 에서).

## Step 5: 테스트 (~300 LOC)

### `lib/utils/__tests__/validate-guide-html.test.ts`

**Allow-list pass (필수)**:
- `<h4>x</h4>`, `<p>x</p>`, `<br>`, `<ul><li>x</li></ul>`, `<ol><li>x</li></ol>`, `<strong>x</strong>`, `<em>x</em>`, `<code>x</code>`, `<a href="https://x">x</a>`

**Disallowed tag (DISALLOWED_TAG)**:
- `<script>alert(1)</script>`, `<iframe src="x">`, `<style>x</style>`, `<img src="x">`, `<form>`, `<input>`, `<video>`, `<object>`
- `<h1>x</h1>`, `<h2>x</h2>`, `<h3>x</h3>`, `<h5>x</h5>`, `<h6>x</h6>` (h4 외 차단)

**Disallowed attribute (DISALLOWED_ATTRIBUTE)**:
- `<p style="color:red">`, `<p class="x">`, `<p id="x">`, `<a onclick="...">`, `<a onerror="...">`

**Invalid URL scheme (INVALID_URL_SCHEME)**:
- `<a href="javascript:alert(1)">` ❌
- `<a href="data:text/html,...">` ❌
- `<a href="vbscript:...">` ❌
- `<a href="//evil.com">` ❌ — protocol-relative
- `<a href="https://x">` ✅
- `<a href="mailto:a@b.com">` ✅
- `<a href="/internal">` ✅
- `<a href="//path">` ❌ vs `<a href="/path">` ✅ — 경계 케이스

**Invalid nesting (INVALID_NESTING)**:
- `<ul><p>x</p></ul>` (li 외)
- `<li>x</li>` (top-level)
- `<a><a>x</a></a>` (중첩)
- `<ul></ul>` (li 없음 — 정책에 따라 허용 또는 EMPTY)

**Empty content (EMPTY_CONTENT)**:
- `""`, `"   "`, `<p></p>`, `<p> </p>`, `<ul><li></li></ul>` (text 없음)

**Parse error (PARSE_ERROR)**:
- `<p>unclosed`, `<<>>` 등

**AST shape verification**:
- 통과 케이스가 정확한 AST 트리 반환 (snapshot 권장)
- `<a>` href / target / rel 보존 확인
- text node 값 정확

### `app/components/features/process-status/GuideCard/__tests__/render-guide-ast.test.tsx`

- 각 노드 타입별 React element 생성 확인 (snapshot 또는 testing-library)
- `dangerouslySetInnerHTML` 사용 안 함 (소스 grep 으로 보장)
- key prop 충돌 없음 (10개 li 중첩 케이스)

## Step 6: 검증

```bash
npx tsc --noEmit
npm run lint -- lib/utils/validate-guide-html.ts app/components/features/process-status/GuideCard/render-guide-ast.tsx
npm run test:run -- validate-guide-html render-guide-ast
```

- tsc exit 0
- 새 lint warning 0
- 30+ test cases pass

## Out of scope

- Mock store · API route → W1-c
- Tiptap 에디터 통합 → W3-b
- GuideCard 분리 → W4-a
- Drift CI · resolver tests → W1-d
- 검증 결과 사용 (`<GuideCardInvalidState>`) → W3-d

## PR body checklist

- [ ] 30+ HTML validation test cases
- [ ] Protocol-relative URL `//evil.com` 차단 케이스 포함
- [ ] AST renderer snapshot test (각 노드 타입)
- [ ] `grep -r "dangerouslySetInnerHTML" app/components/features/process-status/GuideCard/` 결과 0
- [ ] tsc 0, lint 0
- [ ] 서버 / 클라 동형 동작 확인 (Vitest 환경에서 둘 다 통과)
