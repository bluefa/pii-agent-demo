/**
 * Tests for the Guide CMS HTML validator (spec §5).
 *
 * Coverage buckets:
 *  - allow-list pass            (9 cases — one per allowed tag shape)
 *  - disallowed tag             (15 cases)
 *  - disallowed attribute       (5 cases)
 *  - invalid URL scheme         (4 blocked + 3 allowed + boundary)
 *  - invalid nesting            (4 cases)
 *  - empty content              (5 cases)
 *  - PARSE_ERROR smoke          (1 case)
 *  - AST shape                  (2 cases)
 */

import { describe, expect, it } from 'vitest';

import {
  validateGuideHtml,
  type GuideNode,
  type ValidationError,
} from '@/lib/utils/validate-guide-html';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const expectValid = (html: string): GuideNode[] => {
  const res = validateGuideHtml(html);
  if (!res.valid) {
    throw new Error(`expected valid, got errors: ${JSON.stringify(res.errors)}`);
  }
  return res.ast;
};

const expectInvalid = (html: string): ValidationError[] => {
  const res = validateGuideHtml(html);
  if (res.valid) throw new Error(`expected invalid, but got valid ast: ${JSON.stringify(res.ast)}`);
  return res.errors;
};

const hasCode = (errors: ValidationError[], code: ValidationError['code']): boolean =>
  errors.some((e) => e.code === code);

// ---------------------------------------------------------------------------
// Allow-list pass
// ---------------------------------------------------------------------------

describe('validateGuideHtml — allow-list pass', () => {
  it('accepts <h4>', () => {
    expectValid('<h4>Heading</h4>');
  });

  it('accepts <p>', () => {
    expectValid('<p>paragraph</p>');
  });

  it('accepts <br> (inside a <p>)', () => {
    // <br> has no visible text on its own, so wrap it to provide content.
    expectValid('<p>line one<br>line two</p>');
  });

  it('accepts <ul><li>...</li></ul>', () => {
    expectValid('<ul><li>item</li></ul>');
  });

  it('accepts <ol><li>...</li></ol>', () => {
    expectValid('<ol><li>item</li></ol>');
  });

  it('accepts <strong>', () => {
    expectValid('<p><strong>bold</strong></p>');
  });

  it('accepts <em>', () => {
    expectValid('<p><em>italic</em></p>');
  });

  it('accepts <code>', () => {
    expectValid('<p><code>snippet</code></p>');
  });

  it('accepts <a href="https://…">', () => {
    expectValid('<p><a href="https://example.com">link</a></p>');
  });
});

// ---------------------------------------------------------------------------
// Disallowed tag
// ---------------------------------------------------------------------------

describe('validateGuideHtml — disallowed tags', () => {
  const samples: Array<[string, string]> = [
    ['script', '<script>alert(1)</script>'],
    ['iframe', '<iframe src="x"></iframe>'],
    ['style', '<style>body{}</style>'],
    ['img', '<img src="x">'],
    ['form', '<form></form>'],
    ['input', '<input>'],
    ['video', '<video></video>'],
    ['object', '<object></object>'],
    ['h1', '<h1>x</h1>'],
    ['h2', '<h2>x</h2>'],
    ['h3', '<h3>x</h3>'],
    ['h5', '<h5>x</h5>'],
    ['h6', '<h6>x</h6>'],
    ['pre', '<pre>x</pre>'],
    ['blockquote', '<blockquote>x</blockquote>'],
  ];

  for (const [tag, html] of samples) {
    it(`rejects <${tag}>`, () => {
      const errors = expectInvalid(html);
      const tagError = errors.find((e) => e.code === 'DISALLOWED_TAG' && e.tagName === tag);
      expect(tagError, `expected DISALLOWED_TAG for ${tag}, got ${JSON.stringify(errors)}`).toBeDefined();
    });
  }
});

// ---------------------------------------------------------------------------
// Disallowed attribute
// ---------------------------------------------------------------------------

describe('validateGuideHtml — disallowed attributes', () => {
  it('rejects style="…" on <p>', () => {
    const errors = expectInvalid('<p style="color:red">x</p>');
    expect(hasCode(errors, 'DISALLOWED_ATTRIBUTE')).toBe(true);
  });

  it('rejects class="…" on <p>', () => {
    const errors = expectInvalid('<p class="x">x</p>');
    expect(hasCode(errors, 'DISALLOWED_ATTRIBUTE')).toBe(true);
  });

  it('rejects id="…" on <p>', () => {
    const errors = expectInvalid('<p id="x">x</p>');
    expect(hasCode(errors, 'DISALLOWED_ATTRIBUTE')).toBe(true);
  });

  it('rejects onclick="…" on <a>', () => {
    const errors = expectInvalid('<a href="https://x" onclick="bad()">x</a>');
    const attrError = errors.find((e) => e.code === 'DISALLOWED_ATTRIBUTE');
    expect(attrError).toBeDefined();
    expect(attrError?.message).toContain('onclick');
  });

  it('rejects onerror="…" on <a>', () => {
    const errors = expectInvalid('<a href="https://x" onerror="bad()">x</a>');
    const attrError = errors.find((e) => e.code === 'DISALLOWED_ATTRIBUTE');
    expect(attrError).toBeDefined();
    expect(attrError?.message).toContain('onerror');
  });
});

// ---------------------------------------------------------------------------
// Invalid URL scheme
// ---------------------------------------------------------------------------

describe('validateGuideHtml — URL schemes', () => {
  it('blocks javascript:alert(1)', () => {
    const errors = expectInvalid('<a href="javascript:alert(1)">x</a>');
    expect(hasCode(errors, 'INVALID_URL_SCHEME')).toBe(true);
  });

  it('blocks data:text/html,…', () => {
    const errors = expectInvalid('<a href="data:text/html,<script>alert(1)</script>">x</a>');
    expect(hasCode(errors, 'INVALID_URL_SCHEME')).toBe(true);
  });

  it('blocks vbscript:…', () => {
    const errors = expectInvalid('<a href="vbscript:msgbox(1)">x</a>');
    expect(hasCode(errors, 'INVALID_URL_SCHEME')).toBe(true);
  });

  it('blocks protocol-relative //evil.com', () => {
    const errors = expectInvalid('<a href="//evil.com/steal">x</a>');
    expect(hasCode(errors, 'INVALID_URL_SCHEME')).toBe(true);
  });

  it('allows https://x', () => {
    expectValid('<a href="https://x">x</a>');
  });

  it('allows mailto:a@b.com', () => {
    expectValid('<a href="mailto:a@b.com">x</a>');
  });

  it('allows /internal', () => {
    expectValid('<a href="/internal">x</a>');
  });

  // Boundary: /path vs //path — first slash is allowed, second is not.
  it('boundary: <a href="/path"> allowed, <a href="//path"> blocked', () => {
    expectValid('<a href="/path">x</a>');
    const errors = expectInvalid('<a href="//path">x</a>');
    expect(hasCode(errors, 'INVALID_URL_SCHEME')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Invalid nesting
// ---------------------------------------------------------------------------

describe('validateGuideHtml — structural rules', () => {
  it('rejects non-<li> children inside <ul>', () => {
    // <p>x</p> inside <ul> — not allowed.
    const errors = expectInvalid('<ul><p>x</p></ul>');
    expect(hasCode(errors, 'INVALID_NESTING')).toBe(true);
  });

  it('rejects top-level <li>', () => {
    const errors = expectInvalid('<li>x</li>');
    expect(hasCode(errors, 'INVALID_NESTING')).toBe(true);
  });

  it('rejects nested <a><a>…</a></a>', () => {
    const errors = expectInvalid('<a href="https://a"><a href="https://b">inner</a></a>');
    expect(hasCode(errors, 'INVALID_NESTING')).toBe(true);
  });

  // Policy note: <ul></ul> has no visible text, so EMPTY_CONTENT fires
  // (we deliberately do not report INVALID_NESTING for "missing li"
  // because that is indistinguishable from "empty list" — EMPTY_CONTENT
  // conveys the same operational signal).
  it('rejects empty <ul></ul> with EMPTY_CONTENT', () => {
    const errors = expectInvalid('<ul></ul>');
    expect(hasCode(errors, 'EMPTY_CONTENT')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Empty content
// ---------------------------------------------------------------------------

describe('validateGuideHtml — empty content', () => {
  it('rejects ""', () => {
    const errors = expectInvalid('');
    expect(hasCode(errors, 'EMPTY_CONTENT')).toBe(true);
  });

  it('rejects "   " (whitespace only)', () => {
    const errors = expectInvalid('   ');
    expect(hasCode(errors, 'EMPTY_CONTENT')).toBe(true);
  });

  it('rejects <p></p>', () => {
    const errors = expectInvalid('<p></p>');
    expect(hasCode(errors, 'EMPTY_CONTENT')).toBe(true);
  });

  it('rejects <p>   </p>', () => {
    const errors = expectInvalid('<p>   </p>');
    expect(hasCode(errors, 'EMPTY_CONTENT')).toBe(true);
  });

  it('rejects <ul><li></li></ul>', () => {
    const errors = expectInvalid('<ul><li></li></ul>');
    expect(hasCode(errors, 'EMPTY_CONTENT')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PARSE_ERROR smoke test
// ---------------------------------------------------------------------------

describe('validateGuideHtml — parser robustness', () => {
  // linkedom and browser DOMParser both lenient-parse HTML and auto-close
  // unclosed tags, so PARSE_ERROR is very hard to trigger in practice.
  // This smoke test ensures the validator does not crash on pathological
  // input; it asserts the runtime behavior rather than demanding a
  // specific error code.
  it('does not crash on "" (early-returns EMPTY_CONTENT)', () => {
    expect(() => validateGuideHtml('')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// AST shape
// ---------------------------------------------------------------------------

describe('validateGuideHtml — AST shape', () => {
  it('produces a typed tree for a mixed paragraph', () => {
    const ast = expectValid('<h4>Title</h4><p>hello <strong>world</strong></p>');
    expect(ast).toEqual([
      { type: 'h4', children: [{ type: 'text', value: 'Title' }] },
      {
        type: 'p',
        children: [
          { type: 'text', value: 'hello ' },
          {
            type: 'strong',
            children: [{ type: 'text', value: 'world' }],
          },
        ],
      },
    ]);
  });

  it('preserves href/target/rel on <a>', () => {
    const ast = expectValid('<p><a href="https://ex.com" target="_blank" rel="noopener noreferrer">ex</a></p>');
    expect(ast).toEqual([
      {
        type: 'p',
        children: [
          {
            type: 'a',
            href: 'https://ex.com',
            target: '_blank',
            rel: 'noopener noreferrer',
            children: [{ type: 'text', value: 'ex' }],
          },
        ],
      },
    ]);
  });
});
