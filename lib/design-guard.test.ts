/**
 * Design guard: surface-vs-surface and text-vs-actual-surface checks (LIN-91).
 *
 * The post-edit-design hook checks contrast per LINE, so it can only see a
 * background declared on the same line — it is structurally blind to (a) a
 * surface disappearing against the surface BEHIND it, and (b) text whose real
 * background is a parent's tint. Both bit six times in PR #624 and every one
 * was found by eye. Static analysis cannot learn the parent chain, so this
 * file carries it by hand: ADJACENCY below says which surface sits on which.
 * When you re-tint a surface or add one, extend the map.
 *
 * Thresholds:
 *  - surfaces: CIEDE2000 >= 1.0 (the just-noticeable difference). Current
 *    pairs measure 1.61..5.86; the PR #624 regressions measured 0.00..0.66.
 *  - text: WCAG AA 4.5:1 (3:1 for non-text glyphs per 1.4.11), against the
 *    surface it actually sits on, not white.
 *
 * Values are extracted from the live sources (theme.ts / _services/styles.ts /
 * globals.css), so re-tinting a token re-runs the geometry with no edit here.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

// ---------------------------------------------------------------------------
// color math
// ---------------------------------------------------------------------------

const srgb = (hex: string) => {
  const m = hex.match(/[0-9a-f]{2}/gi);
  if (!m || m.length !== 3) throw new Error(`bad hex ${hex}`);
  return m.map((x) => parseInt(x, 16) / 255);
};
const linear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

const luminance = (hex: string) => {
  const [r, g, b] = srgb(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const toLab = (hex: string): [number, number, number] => {
  const [r, g, b] = srgb(hex).map(linear);
  const X = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const Y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const Z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const [fx, fy, fz] = [X, Y, Z].map(f);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};

/** CIEDE2000 — the same metric the PR #624 rework was measured with. */
export const deltaE00 = (h1: string, h2: string) => {
  const [L1, a1, b1] = toLab(h1);
  const [L2, a2, b2] = toLab(h2);
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const ap1 = a1 * (1 + G);
  const ap2 = a2 * (1 + G);
  const Cp1 = Math.hypot(ap1, b1);
  const Cp2 = Math.hypot(ap2, b2);
  const hp = (a: number, b: number) =>
    a === 0 && b === 0 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  const hp1 = hp(ap1, b1);
  const hp2 = hp(ap2, b2);
  const dL = L2 - L1;
  const dC = Cp2 - Cp1;
  let dh = hp2 - hp1;
  if (Cp1 * Cp2 !== 0) {
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
  } else dh = 0;
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh * Math.PI) / 360);
  const Lb = (L1 + L2) / 2;
  const Cpb = (Cp1 + Cp2) / 2;
  let hb = hp1 + hp2;
  if (Cp1 * Cp2 !== 0) {
    if (Math.abs(hp1 - hp2) > 180) hb += hb < 360 ? 360 : -360;
    hb /= 2;
  }
  const rad = Math.PI / 180;
  const T =
    1 -
    0.17 * Math.cos((hb - 30) * rad) +
    0.24 * Math.cos(2 * hb * rad) +
    0.32 * Math.cos((3 * hb + 6) * rad) -
    0.2 * Math.cos((4 * hb - 63) * rad);
  const SL = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2);
  const SC = 1 + 0.045 * Cpb;
  const SH = 1 + 0.015 * Cpb * T;
  const dTh = 30 * Math.exp(-(((hb - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(Cpb ** 7 / (Cpb ** 7 + 25 ** 7));
  const RT = -RC * Math.sin(2 * dTh * rad);
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
};

// ---------------------------------------------------------------------------
// value extraction from the live sources
// ---------------------------------------------------------------------------

const globalsCss = read('app/globals.css');
const tokens: Record<string, string> = {};
for (const m of globalsCss.matchAll(/(--pl-[\w-]+):\s*(#[0-9A-Fa-f]{6})\b/g)) tokens[m[1]] = m[2];

/** '#RRGGBB' or 'var(--pl-x)' -> hex. */
const resolve = (expr: string): string => {
  const v = expr.match(/^var\((--pl-[\w-]+)\)$/);
  if (v) {
    const hex = tokens[v[1]];
    if (!hex) throw new Error(`token ${v[1]} not found in globals.css`);
    return hex;
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(expr)) return expr;
  throw new Error(`unresolvable color ${expr}`);
};

/** Class string of `key:` inside a source file (values are single-quoted, may wrap once). */
const classOf = (src: string, key: string) => {
  const m = src.match(new RegExp(`(?<![\\w])${key}:\\s*\\n?\\s*'([^']*)'`));
  if (!m) throw new Error(`key ${key} not found`);
  return m[1];
};

const REST = '(?<!hover:)(?<!disabled:)(?<!before:)(?<!focus-visible:)';
const COLOR = '((?:#[0-9A-Fa-f]{6})|(?:var\\(--pl-[\\w-]+\\)))';

/** First rest-state background color in a class string. */
const bgOf = (cls: string) => {
  const m = cls.match(new RegExp(`${REST}bg-\\[${COLOR}\\](?!/)`));
  if (!m) throw new Error(`no rest bg in "${cls}"`);
  return resolve(m[1]);
};
/** First rest-state text color in a class string. */
const textOf = (cls: string) => {
  const m = cls.match(new RegExp(`${REST}text-\\[${COLOR}\\]`));
  if (!m) throw new Error(`no rest text in "${cls}"`);
  return resolve(m[1]);
};

const themeSrc = read('lib/theme.ts');
const railBlock = (() => {
  const m = themeSrc.match(/export const serviceSidebarStyles = \{[\s\S]*?\n\} as const/);
  if (!m) throw new Error('serviceSidebarStyles not found');
  return m[0];
})();
const adminSrc = read('app/admin/pipelines/_services/styles.ts');
const liftBlock = (() => {
  const m = themeSrc.match(/export const tableRowLift = \{[\s\S]*?\n\} as const/);
  if (!m) throw new Error('tableRowLift not found');
  return m[0];
})();

/**
 * A hover-only fill. `bgOf` deliberately reads rest state, so it is blind to exactly
 * the tokens that only exist under the cursor — and a hover fill is a real surface:
 * it replaces the card while the user is looking at it.
 */
const hoverBgOf = (cls: string) => {
  const m = cls.match(new RegExp(`hover:bg-\\[${COLOR}\\](?!/)`));
  if (!m) throw new Error(`no hover bg in "${cls}"`);
  return resolve(m[1]);
};

/** The `tilePalette` array's `bg-[#...]`/`text-[#...]` pairs, in declaration order. */
const serviceTiles = (() => {
  const m = railBlock.match(/tilePalette:\s*\[([\s\S]*?)\]/);
  if (!m) throw new Error('tilePalette not found');
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
})();
const serviceTilePalette = serviceTiles.map(bgOf);
const serviceTileGlyphs = serviceTiles.map((cls) => ({ fg: textOf(cls), on: bgOf(cls) }));

// The surfaces each screen stands on.
const canvas = bgOf(classOf(railBlock, 'canvas')); // /services · /target-sources ground
const rail = bgOf(classOf(railBlock, 'surface')); // user-facing rail
const plGround = bgOf(classOf(adminSrc, 'split')); // admin split ground (--pl-gray-100)
const sheet = bgOf(classOf(adminSrc, 'sheet')); // admin content sheet (white)

// ---------------------------------------------------------------------------
// the adjacency map — the one piece of knowledge static analysis cannot infer
// ---------------------------------------------------------------------------

const SURFACE_MIN = 1.0; // JND; PR #624 regressions were all <= 0.66, current pairs >= 1.61

type SurfacePair = { what: string; top: string; under: string };
const SURFACES: SurfacePair[] = [
  { what: 'rail on canvas', top: rail, under: canvas },
  { what: 'white card on canvas (/services)', top: '#FFFFFF', under: canvas },
  { what: 'count pill on rail', top: bgOf(classOf(railBlock, 'count')), under: rail },
  { what: 'row code tag on rail', top: bgOf(classOf(railBlock, 'rowCode')), under: rail },
  { what: 'current row tint on rail', top: bgOf(classOf(railBlock, 'rowCurrent')), under: rail },
  { what: 'skeleton bar on rail', top: bgOf(classOf(railBlock, 'skeletonBar')), under: rail },
  { what: 'admin sheet on ground', top: sheet, under: plGround },
  { what: 'admin rail count pill on ground', top: bgOf(classOf(adminSrc, 'railCount')), under: plGround },
  { what: 'admin row code tag on ground', top: bgOf(classOf(adminSrc, 'code')), under: plGround },
  { what: 'admin active row tint on ground', top: bgOf(classOf(adminSrc, 'itemActive')), under: plGround },
  { what: 'service code chip on sheet', top: bgOf(classOf(adminSrc, 'svcCodeChip')), under: sheet },
  { what: 'empty-state icon plate on ground', top: bgOf(classOf(themeSrc, 'iconOnGround')), under: plGround },
  // The PR #624 P1: tinting --pl-bg-page made it byte-identical to --pl-gray-100 and the
  // borderless ops-alerts summary tiles (bg gray-100 straight on the page ground) vanished.
  { what: 'ops-alerts tile (gray-100) on page ground', top: resolve('var(--pl-gray-100)'), under: resolve('var(--pl-bg-page)') },
  // The card's hover fill is a surface too — it replaces white under the cursor, so it
  // has to separate from the canvas the card sits on or the hovered card dissolves into
  // the page. `bg-gray-50` here measured 1.20 from the card it replaced.
  { what: 'card hover tint on canvas', top: hoverBgOf(classOf(liftBlock, 'card')), under: canvas },
  { what: 'card hover tint on the white card', top: hoverBgOf(classOf(liftBlock, 'card')), under: '#FFFFFF' },
  // The rail's skeleton is reused on the admin ground — a second surface it must clear.
  { what: 'skeleton bar on admin ground', top: bgOf(classOf(railBlock, 'skeletonBar')), under: plGround },
  // The tinted service tiles are the rail's most numerous plates and its palest ones —
  // #F7F8FA was ΔE00 0.99 from the rail before the retint, i.e. invisible.
  ...serviceTilePalette.map((fill, i) => ({
    what: `service tile ${i} on rail`,
    top: fill,
    under: rail,
  })),
];

type TextPair = { what: string; fg: string; on: string; min?: number };
const TEXT: TextPair[] = [
  { what: 'rail section label on rail', fg: textOf(classOf(railBlock, 'sectionLabel')), on: rail },
  { what: 'rail footer page on rail', fg: textOf(classOf(railBlock, 'footerPage')), on: rail },
  { what: 'rail pager glyph on rail', fg: textOf(classOf(railBlock, 'pagerBtn')), on: rail },
  { what: 'rail row name on rail', fg: textOf(classOf(railBlock, 'rowName')), on: rail },
  // The rail's empty-search state — the one screen where the rail's only content is
  // this sentence and its recovery link. Both were left on white-measured page tokens
  // (`textColors.tertiary` 3.88:1, `primaryColors.text` 3.95:1) through one retint.
  { what: 'rail empty-state text on rail', fg: textOf(classOf(railBlock, 'emptyText')), on: rail },
  { what: 'rail empty-state action on rail', fg: textOf(classOf(railBlock, 'emptyAction')), on: rail },
  { what: 'rail count pill label on its pill', fg: textOf(classOf(railBlock, 'count')), on: bgOf(classOf(railBlock, 'count')) },
  { what: 'rail row code label on its plate', fg: textOf(classOf(railBlock, 'rowCode')), on: bgOf(classOf(railBlock, 'rowCode')) },
  // The page subtitle's product name sits on the canvas, not on white — #0064FF is
  // 4.4951:1 there, which is why this pair uses `textOnLight`.
  { what: 'primary text on canvas', fg: textOf(classOf(themeSrc, 'textOnLight')), on: canvas },
  // Row labels survive the card turning violet under the cursor.
  { what: 'row label on card hover tint', fg: resolve('#3B6BB5'), on: hoverBgOf(classOf(liftBlock, 'card')) },
  ...serviceTileGlyphs.map((t, i) => ({ what: `service tile ${i} glyph on its fill`, ...t })),
  // The EC2 / RDS Cluster kind tag. Its letters were desaturated from #6D28D9 to a grey
  // on the argument that contrast was unchanged (6.25 → 6.26:1) — that argument is only
  // as good as a measurement, so it gets one. The next grey down (#6B7280) is 4.26:1 on
  // this fill, i.e. the quiet-er value someone will reach for is already below AA.
  {
    what: 'resource kind tag label on its tag',
    fg: textOf(classOf(themeSrc, 'resourceKind')),
    on: bgOf(classOf(themeSrc, 'resourceKind')),
  },
  { what: 'admin section label on ground', fg: textOf(classOf(adminSrc, 'railSection')), on: plGround },
  {
    what: 'service code chip label on its chip',
    fg: textOf(classOf(adminSrc, 'svcCodeChipLabel')),
    on: bgOf(classOf(adminSrc, 'svcCodeChip')),
  },
  // non-text glyph: WCAG 1.4.11 asks 3:1, not 4.5:1
  {
    what: 'empty-state icon glyph on its plate',
    fg: textOf(classOf(themeSrc, 'iconOnGround')),
    on: bgOf(classOf(themeSrc, 'iconOnGround')),
    min: 3.0,
  },
];

// ---------------------------------------------------------------------------
// checks
// ---------------------------------------------------------------------------

describe('surface separation (CIEDE2000 >= JND)', () => {
  it.each(SURFACES)('$what', ({ top, under }) => {
    expect(deltaE00(top, under)).toBeGreaterThanOrEqual(SURFACE_MIN);
  });
});

describe('text contrast against its actual surface', () => {
  it.each(TEXT)('$what', ({ fg, on, min }) => {
    expect(contrast(fg, on)).toBeGreaterThanOrEqual(min ?? 4.5);
  });
});

// ---------------------------------------------------------------------------
// regression replay: the six PR #624 escapes plus the global-token collision.
// Each fixture is the exact BEFORE state that shipped past the hook; these
// prove the thresholds above would have flagged every one of them.
// ---------------------------------------------------------------------------

describe('detects the PR #624 regressions the hook missed', () => {
  it('H1 rail code tag: text-weak on gray-200 (4.01:1, hook compared vs white)', () => {
    expect(contrast(resolve('var(--pl-text-weak)'), resolve('var(--pl-gray-200)'))).toBeLessThan(4.5);
  });

  it('H2 section label #6B7280 on the tinted rail #F2F4F6 (4.38:1)', () => {
    expect(contrast('#6B7280', '#F2F4F6')).toBeLessThan(4.5);
  });

  it('H3 count pill bg identical to the rail (dE00 0)', () => {
    expect(deltaE00('#F2F4F6', '#F2F4F6')).toBeLessThan(SURFACE_MIN);
  });

  it('H4 skeleton #F3F4F6 on rail #F2F4F6 (dE00 0.50)', () => {
    expect(deltaE00('#F3F4F6', '#F2F4F6')).toBeLessThan(SURFACE_MIN);
  });

  it('H5 table block #F9FAFB against its #F7F8FA header bands (dE00 0.66)', () => {
    expect(deltaE00('#F9FAFB', '#F7F8FA')).toBeLessThan(SURFACE_MIN);
  });

  it('H6 empty-state plate gray-100 on gray-100 ground (dE00 0)', () => {
    expect(deltaE00(resolve('var(--pl-gray-100)'), resolve('var(--pl-gray-100)'))).toBeLessThan(SURFACE_MIN);
  });

  it('H7 --pl-bg-page tinted to #F2F4F7 collides with the ops-alerts tiles', () => {
    // the "ops-alerts tile on page ground" entry above with bg-page at its regressed value
    expect(deltaE00(resolve('var(--pl-gray-100)'), '#F2F4F7')).toBeLessThan(SURFACE_MIN);
  });
});
