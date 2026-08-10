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

/**
 * `bgOf`/`textOf` read arbitrary-value classes (`bg-[#…]`). The base `bgColors` and
 * `textColors` tokens are palette classes instead (`bg-gray-100`), so they need the
 * palette itself. Only the steps the pairs below use are listed — a step that stops
 * matching Tailwind's palette throws here rather than measuring a stale color.
 */
const TW_GRAY: Record<string, string> = {
  '100': '#F3F4F6',
  '500': '#6B7280',
  '700': '#374151',
  '900': '#111827',
};
const twGray = (cls: string, prop: 'bg' | 'text') => {
  const m = cls.match(new RegExp(`${REST}${prop}-gray-(\\d+)\\b`));
  if (!m) throw new Error(`no rest ${prop}-gray-* in "${cls}"`);
  const hex = TW_GRAY[m[1]];
  if (!hex) throw new Error(`gray-${m[1]} not in TW_GRAY — add it with its palette value`);
  return hex;
};
const blockOf = (name: string) => {
  const m = themeSrc.match(new RegExp(`export const ${name} = \\{[\\s\\S]*?\\n\\} as const`));
  if (!m) throw new Error(`${name} not found`);
  return m[0];
};
const bgTokens = blockOf('bgColors');
const textTokens = blockOf('textColors');

// The target-source detail header went backgroundless (C3): it paints no plane of
// its own, so every run of text and every chip in it stands on the canvas wash.
// That move silently dropped four tiers under AA — the per-line hook cannot see it,
// because the surface is declared by an ancestor route layout, not on the line.
const headerBlock = blockOf('projectHeaderStyles');
const stepperBlock = blockOf('installStepperStyles');

// The 인프라 등록 wizard's ground: a gray panel filling the dialog, with the content as
// a white card on it and the step column standing straight on the gray.
const wizardPanel = twGray(classOf(bgTokens, 'panel'), 'bg');

// Step 4's install tray bleeds through the card gutter to the card's own edge
// (`cardStyles.bodyBleed`), so three of its four sides stand on the page canvas
// rather than on the card's white. It answers to BOTH grounds — that is the whole
// reason it is not `panel`.
const step4Tray = bgOf(classOf(bgTokens, 'tray'));
// What a card edge is worth on this canvas when nothing but fill draws it. Every
// ordinary card gets this much for free by being white; a bleeding surface has to
// earn it. Derived, not a constant — retint the canvas and the bar moves with it.
const whiteCardEdge = deltaE00('#FFFFFF', canvas);

// ---------------------------------------------------------------------------
// the adjacency map — the one piece of knowledge static analysis cannot infer
// ---------------------------------------------------------------------------

const SURFACE_MIN = 1.0; // JND; PR #624 regressions were all <= 0.66, current pairs >= 1.61

type SurfacePair = { what: string; top: string; under: string; min?: number };
const SURFACES: SurfacePair[] = [
  { what: 'rail on canvas', top: rail, under: canvas },
  { what: 'white card on canvas (/services)', top: '#FFFFFF', under: canvas },
  { what: 'count pill on rail', top: bgOf(classOf(railBlock, 'count')), under: rail },
  { what: 'row code tag on rail', top: bgOf(classOf(railBlock, 'rowCode')), under: rail },
  { what: 'current row tint on rail', top: bgOf(classOf(railBlock, 'rowCurrent')), under: rail },
  // Step 4 의 그룹 레일이 같은 rowCurrent 를 재사용한다 — 다만 바닥이 services 레일이
  // 아니라 gray-100 판이다. 한 토큰이 두 바닥 위에 서므로 둘 다 걸어둬야, /services 를
  // 위해 이 색을 다시 틴트할 때 Step 4 가 조용히 무너지지 않는다.
  { what: 'current row tint on gray-100 panel (Step 4 rail)', top: bgOf(classOf(railBlock, 'rowCurrent')), under: wizardPanel },
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
  // Step 4's tray runs to the card edge, so on three sides it IS the card's
  // outline — a 20px radius and a 0.04-alpha shadow draw no edge on their own.
  // The floor is therefore not the JND but the edge an ordinary white card gets
  // for free on this canvas: bleed a fill that reads weaker than that and the
  // card's bottom two thirds look torn off. `panel` (gray-100) is 2.67 here.
  { what: 'step4 install tray on the page canvas', top: step4Tray, under: canvas, min: whiteCardEdge },
  { what: 'step4 resource pane (white) on the install tray', top: '#FFFFFF', under: step4Tray },
  { what: 'step4 selected rail row on the install tray', top: bgOf(classOf(railBlock, 'rowCurrent')), under: step4Tray },
  // The wizard groups by surface and draws no rule between its two columns, so this
  // pair IS the separation — re-tint `panel` toward white and the card dissolves with
  // nothing else left to mark where it starts.
  { what: 'wizard content card on the dialog panel', top: '#FFFFFF', under: wizardPanel },
  // The backgroundless header's chips and plates have only the wash behind them.
  { what: 'header service-code chip on the page wash', top: bgOf(classOf(headerBlock, 'codeChip')), under: canvas },
  { what: 'header provider icon plate on the page wash', top: bgOf(classOf(headerBlock, 'providerIcon')), under: canvas },
  { what: 'header 설치 모드 chip on the page wash', top: bgOf(classOf(headerBlock, 'modeChipAuto')), under: canvas },
  { what: 'header kv divider on the page wash', top: bgOf(classOf(headerBlock, 'divider')), under: canvas },
  // The road ahead is decoration — the labels and dots already name every remaining
  // step — so it answers to the JND and nothing more. The road WALKED carries progress,
  // so it is measured as a non-text mark in TEXT below instead.
  { what: 'stepper road-ahead on the page wash', top: bgOf(classOf(stepperBlock, 'line')), under: canvas },
  { what: 'stepper road-walked against road-ahead', top: bgOf(classOf(stepperBlock, 'lineDone')), under: bgOf(classOf(stepperBlock, 'line')) },
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
  // Every tier of the backgroundless header, measured on the wash it actually sits on.
  // #6B7684 clears AA on white (4.62:1) and fails here (4.22:1), which is precisely the
  // trap C3 set: the same token, one surface later, is a different decision.
  { what: 'header block eyebrow on the page wash', fg: textOf(classOf(headerBlock, 'blockLabel')), on: canvas },
  { what: 'header kv label on the page wash', fg: textOf(classOf(headerBlock, 'kvLabel')), on: canvas },
  { what: 'header kv value on the page wash', fg: textOf(classOf(headerBlock, 'kvValue')), on: canvas },
  { what: 'header description on the page wash', fg: textOf(classOf(headerBlock, 'descText')), on: canvas },
  { what: 'header provider name on the page wash', fg: textOf(classOf(headerBlock, 'providerName')), on: canvas },
  { what: 'header provider gloss on the page wash', fg: textOf(classOf(headerBlock, 'providerGloss')), on: canvas },
  { what: 'header install-mode note on the page wash', fg: textOf(classOf(headerBlock, 'modeNote')), on: canvas },
  { what: 'header code-chip label on its chip', fg: textOf(classOf(headerBlock, 'codeChipLabel')), on: bgOf(classOf(headerBlock, 'codeChip')) },
  { what: 'header code-chip value on its chip', fg: textOf(classOf(headerBlock, 'codeChipValue')), on: bgOf(classOf(headerBlock, 'codeChip')) },
  { what: 'header 설치 모드 chip label on its chip', fg: textOf(classOf(headerBlock, 'modeChipAuto')), on: bgOf(classOf(headerBlock, 'modeChipAuto')) },
  { what: 'header provider glyph on its plate', fg: textOf(classOf(headerBlock, 'providerIcon')), on: bgOf(classOf(headerBlock, 'providerIcon')), min: 3.0 },
  // Stepper labels are text; the dots are the state markers, i.e. non-text per 1.4.11.
  { what: 'stepper rest label on the page wash', fg: textOf(classOf(stepperBlock, 'labelRest')), on: canvas },
  { what: 'stepper current label on the page wash', fg: textOf(classOf(stepperBlock, 'labelCurrent')), on: canvas },
  { what: 'stepper pending dot on the page wash', fg: bgOf(classOf(stepperBlock, 'dotPending')), on: canvas, min: 3.0 },
  { what: 'stepper done dot on the page wash', fg: bgOf(classOf(stepperBlock, 'dotDone')), on: canvas, min: 3.0 },
  { what: 'stepper current dot on the page wash', fg: bgOf(classOf(stepperBlock, 'dotCurrent')), on: canvas, min: 3.0 },
  // The walked road says how far you got, so it is a non-text mark, not decoration.
  // Its predecessor #CFE0FF scored ΔE00 10.72 against the wash and 1.22:1 — hue distance
  // is not visibility for a 2px line, which is why this pair uses the contrast rule.
  { what: 'stepper walked road on the page wash', fg: bgOf(classOf(stepperBlock, 'lineDone')), on: canvas, min: 3.0 },
  { what: 'admin section label on ground', fg: textOf(classOf(adminSrc, 'railSection')), on: plGround },
  // The wizard's step column has no surface of its own, so every run of text in it is
  // measured against the dialog's gray panel. `tertiary` is 4.39:1 there and shipped
  // broken for three commits — these two pin the tiers that are allowed to replace it.
  { what: 'wizard rail body text on the dialog panel', fg: twGray(classOf(textTokens, 'secondary'), 'text'), on: wizardPanel },
  { what: 'wizard rail title on the dialog panel', fg: twGray(classOf(textTokens, 'primary'), 'text'), on: wizardPanel },
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
  // Step 4 grouped rail: quiet text (ordinals, group labels, metabar caption)
  // sits DIRECTLY on the tray, where gray-500 is 4.09:1 and #0064FF is 4.18:1 —
  // both under AA, which is why the rail uses gray-700 and `textOnLight`. The
  // gray-700 hex is a Tailwind framework constant, carried literally.
  { what: 'step4 grouped-rail quiet text (gray-700) on the install tray', fg: '#374151', on: step4Tray },
  {
    what: 'step4 grouped-rail hot group label on the install tray',
    fg: textOf(classOf(themeSrc, 'textOnLight')),
    on: step4Tray,
  },
];

// ---------------------------------------------------------------------------
// checks
// ---------------------------------------------------------------------------

describe('surface separation (CIEDE2000 >= JND)', () => {
  it.each(SURFACES)('$what', ({ top, under, min }) => {
    expect(deltaE00(top, under)).toBeGreaterThanOrEqual(min ?? SURFACE_MIN);
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

  // The header's own escape: going backgroundless (C3) moved a card's worth of text
  // onto the wash without re-measuring it. Every value below shipped and was caught by
  // eye, not by a check — these pin what the pairs above now measure.
  it('H8 stepper pending label #8B95A1 on the wash (2.78:1)', () => {
    expect(contrast('#8B95A1', canvas)).toBeLessThan(4.5);
  });

  it('H9 header quiet tier #6B7684 on the wash (4.22:1 — it clears AA on white)', () => {
    expect(contrast('#6B7684', canvas)).toBeLessThan(4.5);
    expect(contrast('#6B7684', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });

  it('H10 walked road #CFE0FF passed every ΔE00 check and still vanished (1.22:1)', () => {
    // ΔE00 10.72 from the wash and 8.87 from the road ahead: by the surface rule the old
    // road was fine. It was not — a light blue can sit far from a lavender in hue while
    // carrying almost no luminance difference, and a 2px line is read by luminance.
    // The lesson is metric selection, not a stricter threshold.
    expect(deltaE00('#CFE0FF', canvas)).toBeGreaterThanOrEqual(SURFACE_MIN);
    expect(deltaE00('#CFE0FF', '#E4E5EE')).toBeGreaterThanOrEqual(SURFACE_MIN);
    expect(contrast('#CFE0FF', canvas)).toBeLessThan(3.0);
  });

  it('H7 --pl-bg-page tinted to #F2F4F7 collides with the ops-alerts tiles', () => {
    // the "ops-alerts tile on page ground" entry above with bg-page at its regressed value
    expect(deltaE00(resolve('var(--pl-gray-100)'), '#F2F4F7')).toBeLessThan(SURFACE_MIN);
  });
});
