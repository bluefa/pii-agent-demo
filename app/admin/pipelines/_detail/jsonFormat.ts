/**
 * Pretty-print a JSON string by re-indenting WHITESPACE ONLY. Number literals,
 * object-key order, and string contents are emitted verbatim — the input is never
 * `JSON.parse`d for output. Round-tripping through a parse would reorder keys and
 * turn large integers into lossy floats; the backend stores the upstream status
 * body compact but value-preserving (see terraform_job_state.last_response), so we
 * must not corrupt it. Input that is not well-formed JSON is returned unchanged.
 */
export function formatJson(raw: string): string {
  const s = raw.trim();
  if (s === '') return raw;
  // Validate only — the parsed value is discarded; output re-indents the ORIGINAL
  // string so number precision and key order survive.
  try {
    JSON.parse(s);
  } catch {
    return raw;
  }

  const INDENT = '  ';
  const nl = (depth: number): string => '\n' + INDENT.repeat(depth);
  const skipWs = (from: number): number => {
    let k = from;
    while (k < s.length && (s[k] === ' ' || s[k] === '\t' || s[k] === '\n' || s[k] === '\r')) k++;
    return k;
  };

  let out = '';
  let depth = 0;
  let inStr = false;
  let esc = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      out += c;
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      out += c;
    } else if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      // drop the original insignificant whitespace; we re-add our own
    } else if (c === '{' || c === '[') {
      const close = c === '{' ? '}' : ']';
      const k = skipWs(i + 1);
      if (s[k] === close) {
        out += c + close; // empty container stays on one line
        i = k;
      } else {
        depth++;
        out += c + nl(depth);
      }
    } else if (c === '}' || c === ']') {
      depth--;
      out += nl(depth) + c;
    } else if (c === ',') {
      out += c + nl(depth);
    } else if (c === ':') {
      out += ': ';
    } else {
      out += c;
    }
  }
  return out;
}
