import { describe, expect, it } from 'vitest';
import { formatJson } from '@/app/admin/pipelines/_detail/jsonFormat';

describe('formatJson (whitespace-only re-indent)', () => {
  it('pretty-prints a compact object with a nested array', () => {
    expect(formatJson('{"a":1,"b":[2,3]}')).toBe('{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}');
  });

  it('preserves key order — it is never reparsed', () => {
    expect(formatJson('{"z":1,"a":2}')).toBe('{\n  "z": 1,\n  "a": 2\n}');
  });

  it('preserves large integer literals exactly (no lossy float round-trip)', () => {
    const big = '{"id":9007199254740993}'; // > Number.MAX_SAFE_INTEGER
    expect(formatJson(big)).toContain('9007199254740993');
    // A naive JSON.parse round-trip WOULD corrupt it — this is why we re-indent verbatim.
    expect(String(JSON.parse(big).id)).toBe('9007199254740992');
  });

  it('keeps empty containers on one line', () => {
    expect(formatJson('{"a":{},"b":[]}')).toBe('{\n  "a": {},\n  "b": []\n}');
  });

  it('does not treat braces/commas/colons inside strings as structure', () => {
    expect(formatJson('{"msg":"a,b:{x}"}')).toBe('{\n  "msg": "a,b:{x}"\n}');
  });

  it('returns non-JSON or empty input unchanged', () => {
    expect(formatJson('not json at all')).toBe('not json at all');
    expect(formatJson('')).toBe('');
    expect(formatJson('  ')).toBe('  ');
  });
});
