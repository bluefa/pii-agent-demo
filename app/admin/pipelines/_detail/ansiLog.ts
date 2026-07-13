/**
 * Minimal ANSI SGR parser for the Terraform log viewer. Raw terraform output
 * carries SGR escape codes (ESC[32m, ESC[0m, ESC[1m…) that were showing through
 * verbatim as `[0m` litter; this turns them into styled segments so the viewer
 * reads like a real terraform run (green adds, red errors, bold headers). Only
 * the colour/weight subset terraform emits is handled; any other CSI sequence
 * (cursor moves, ESC[K) is stripped. The ESC (0x1b) prefix is optional in the
 * patterns — it is non-printing so pasted logs may drop it, but real output
 * always carries it.
 */
export type AnsiColor = 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'gray';

export interface AnsiSegment {
  text: string;
  bold: boolean;
  color: AnsiColor | null;
}

// SGR foreground codes (standard 30-37 + bright 90-97) → our palette.
const FG: Record<number, AnsiColor> = {
  30: 'gray', 90: 'gray',
  31: 'red', 91: 'red',
  32: 'green', 92: 'green',
  33: 'yellow', 93: 'yellow',
  34: 'blue', 94: 'blue',
  35: 'magenta', 95: 'magenta',
  36: 'cyan', 96: 'cyan',
  37: 'gray', 97: 'gray',
};

// 0x1b is the ESC byte; kept out of the source as a char code so the file stays
// pure ASCII (a literal ESC in a regex literal is easy to corrupt on edit).
const ESC = String.fromCharCode(27);
const SGR_RE = new RegExp(ESC + '?\\[([0-9;]*)m', 'g');
// Non-SGR CSI sequences (cursor/erase) terraform occasionally emits — dropped.
const OTHER_CSI_RE = new RegExp(ESC + '?\\[[0-9;]*[A-La-ln-z]', 'g');

/** Split ANSI-coloured text into styled segments (escape codes consumed). */
export function parseAnsi(input: string): AnsiSegment[] {
  const clean = input.replace(OTHER_CSI_RE, '');
  const segments: AnsiSegment[] = [];
  let bold = false;
  let color: AnsiColor | null = null;
  let last = 0;
  const push = (end: number): void => {
    // Drop any stray ESC that slipped past both patterns.
    const text = clean.slice(last, end).split(ESC).join('');
    if (text) segments.push({ text, bold, color });
  };
  SGR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SGR_RE.exec(clean)) !== null) {
    push(m.index);
    const codes = m[1] === '' ? [0] : m[1].split(';').map((c) => Number(c));
    for (const n of codes) {
      if (n === 0) {
        bold = false;
        color = null;
      } else if (n === 1) {
        bold = true;
      } else if (n === 22) {
        bold = false;
      } else if (n === 39) {
        color = null;
      } else if (FG[n]) {
        color = FG[n];
      }
    }
    last = SGR_RE.lastIndex;
  }
  push(clean.length);
  return segments;
}

/** Plain text with all ANSI codes removed — for copy-to-clipboard. */
export function stripAnsi(input: string): string {
  return parseAnsi(input)
    .map((s) => s.text)
    .join('');
}
