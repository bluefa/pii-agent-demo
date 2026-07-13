import { describe, it, expect } from 'vitest';
import { parseAnsi } from '@/app/admin/pipelines/_detail/ansiLog';

const ESC = String.fromCharCode(27);

describe('parseAnsi', () => {
  it('returns one plain segment when there are no codes', () => {
    expect(parseAnsi('Apply complete!')).toEqual([
      { text: 'Apply complete!', bold: false, color: null },
    ]);
  });

  it('colours a span and resets on ESC[0m', () => {
    const line = `${ESC}[32m+ create${ESC}[0m done`;
    expect(parseAnsi(line)).toEqual([
      { text: '+ create', bold: false, color: 'green' },
      { text: ' done', bold: false, color: null },
    ]);
  });

  it('tracks bold + colour together and leaves no escape litter', () => {
    const line = `${ESC}[1m${ESC}[31mError:${ESC}[0m boom`;
    const segs = parseAnsi(line);
    expect(segs).toEqual([
      { text: 'Error:', bold: true, color: 'red' },
      { text: ' boom', bold: false, color: null },
    ]);
    expect(segs.map((s) => s.text).join('')).not.toContain('[0m');
    expect(segs.map((s) => s.text).join('')).not.toContain(ESC);
  });

  it('strips non-SGR CSI sequences (cursor/erase)', () => {
    expect(parseAnsi(`line${ESC}[Kend`)).toEqual([
      { text: 'lineend', bold: false, color: null },
    ]);
  });

  it('parses combined codes in a single escape (ESC[1;33m)', () => {
    expect(parseAnsi(`${ESC}[1;33mwarn`)).toEqual([
      { text: 'warn', bold: true, color: 'yellow' },
    ]);
  });
});
