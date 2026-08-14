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
// Accepts a template literal as well as a plain string: tokens that compose another token
// (`${tableRowLift.chipEdge}`) are backticked, and reading only `'…'` would silently skip them.
const classOf = (src: string, key: string) => {
  const m = src.match(new RegExp(`(?<![\\w])${key}:\\s*\\n?\\s*['\`]([^'\`]*)['\`]`));
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
/**
 * Text color the class switches to while its group is hovered. A hover colour is only
 * ever seen ON the hover surface, so measuring it against the rest surface — which is
 * what `textOf` would pick up — reports a pair that never renders.
 */
const hoverTextOf = (cls: string) => {
  const m = cls.match(new RegExp(`group-hover:text-\\[${COLOR}\\]`));
  if (!m) throw new Error(`no group-hover text in "${cls}"`);
  return resolve(m[1]);
};
/**
 * First rest-state border color. A stroke is a surface's edge, and for a chip whose
 * fill is white on a white row it is the ONLY thing separating the two — so it has to
 * be measurable here, not just assumed.
 */
const borderOf = (cls: string) => {
  const m = cls.match(new RegExp(`${REST}border-\\[${COLOR}\\]`));
  if (!m) throw new Error(`no rest border in "${cls}"`);
  return resolve(m[1]);
};
/** The one quoted class string in `src` containing `needle` — for values with no key
 *  of their own, or whose key name repeats across the file. */
const classWith = (src: string, needle: string) => {
  const m = src.match(new RegExp(`'([^']*${needle}[^']*)'`));
  if (!m) throw new Error(`no class containing "${needle}"`);
  return m[1];
};

const themeSrc = read('lib/theme.ts');
const railBlock = (() => {
  const m = themeSrc.match(/export const serviceSidebarStyles = \{[\s\S]*?\n\} as const/);
  if (!m) throw new Error('serviceSidebarStyles not found');
  return m[0];
})();
const adminSrc = read('app/admin/pipelines/_services/styles.ts');
// The /admin/pipelines dashboard. Its row is the section's densest stack of tiers —
// name, code chip, id, provider, step strip and its caption — and all of it stands on
// a row that swaps to a tint under the cursor, so every pair here has two surfaces.
const pipelineBlock = (() => {
  const m = themeSrc.match(/export const pipelineStyles = \{[\s\S]*?\n\} as const/);
  if (!m) throw new Error('pipelineStyles not found');
  return m[0];
})();
const pipelineTextBlock = (() => {
  const m = themeSrc.match(/const pipelineText = \{[\s\S]*?\n\} as const/);
  if (!m) throw new Error('pipelineText not found');
  return m[0];
})();
const navLayoutSrc = read('app/admin/pipelines/layout.tsx');
// The identity cell has no plate left (오너 2026-08-14, "tag 없애봐"): four runs of bare
// text on the row, so each one answers to the row's TWO surfaces on its own.
const dashIdTarget = classOf(pipelineBlock, 'identityTarget');
const dashIdTargetValue = classOf(pipelineBlock, 'identityTargetValue');
const dashIdCode = classOf(pipelineBlock, 'identityCode');
const dashIdCodeValue = classOf(pipelineBlock, 'identityCodeValue');
const dashIdName = classOf(pipelineBlock, 'identityName');
const dashStatusTone = (key: string): string => {
  const m = pipelineBlock.match(new RegExp(`\\n\\s+${key}: '([^']+)'`));
  if (!m) throw new Error(`statusTextTone.${key} not found`);
  return textOf(m[1]);
};
// `sidebar:` puts a comment between the key and its value, which `classOf` cannot
// step over — anchor on the width instead, which is the class's own signature.
const plSidebar = bgOf(classWith(pipelineBlock, 'w-\\[216px\\]'));
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

/**
 * The dashboard row's hover tint — anchored on the class body, since `row:` repeats.
 * `transition-colors` is load-bearing in that anchor: `rowClickable` is the other
 * `group cursor-pointer` row in this block and it hovers to gray-50, one step lighter.
 */
const dashRowHover = hoverBgOf(classWith(pipelineBlock, 'group cursor-pointer transition-colors'));

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

// The EC2 / RDS Cluster kind tag and the row tints it has to survive. Every resource table
// that draws the tag (steps 1·2·3·4·6·7, the admin request table, the connection-test card)
// hovers to one of these two, so the tag's fill stands on four surfaces, not one.
const kindTagFill = bgOf(classOf(themeSrc, 'resourceKind'));
const rowHover = hoverBgOf(classOf(liftBlock, 'target'));
const rowHoverExcluded = hoverBgOf(classOf(liftBlock, 'excluded'));

/**
 * A nested `key: { … }` object. Takes the PARENT's source rather than searching all of
 * theme.ts: `tag`, `green`, `gray` and friends are names any future token block could also
 * use, and a file-wide search silently returns whichever is declared first — measuring the
 * wrong colors and still passing. (`blockOf` below is the top-level `export const` form.)
 */
const nestedBlockOf = (src: string, key: string) => {
  const m = src.match(new RegExp(`(?<![\\w])${key}: \\{[\\s\\S]*?\\n  \\},`));
  if (!m) throw new Error(`nested block ${key} not found`);
  return m[0];
};

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
const idcBlock = blockOf('idcStyles');
const kindBadgeBlock = nestedBlockOf(idcBlock, 'kindBadge');
const idcTagBlock = nestedBlockOf(idcBlock, 'tag');
const idcTableBlock = nestedBlockOf(idcBlock, 'table');

// The target-source detail header went backgroundless (C3): it paints no plane of
// its own, so every run of text and every chip in it stands on the canvas wash.
// That move silently dropped four tiers under AA — the per-line hook cannot see it,
// because the surface is declared by an ancestor route layout, not on the line.
const headerBlock = blockOf('projectHeaderStyles');
const stepperBlock = blockOf('installStepperStyles');

// The 인프라 등록 wizard's ground: a gray panel filling the dialog, with the content as
// a white card on it and the step column standing straight on the gray.
const wizardPanel = twGray(classOf(bgTokens, 'panel'), 'bg');

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
  // The kind tag paints its own fill over whatever the row is, so the row's HOVER tint is
  // one of the surfaces it sits on — and it was the missing one. `card` is here too because
  // its fill was deliberately borrowed from this tag (see tableRowLift.card): the two were
  // byte-identical, so a kind tag on a card row would have vanished outright.
  { what: 'kind tag fill on the white row', top: kindTagFill, under: '#FFFFFF' },
  { what: 'kind tag fill on the row hover tint', top: kindTagFill, under: rowHover },
  { what: 'kind tag fill on the excluded-row hover tint', top: kindTagFill, under: rowHoverExcluded },
  { what: 'kind tag fill on the card hover tint', top: kindTagFill, under: hoverBgOf(classOf(liftBlock, 'card')) },
  // The rail's skeleton is reused on the admin ground — a second surface it must clear.
  { what: 'skeleton bar on admin ground', top: bgOf(classOf(railBlock, 'skeletonBar')), under: plGround },
  // The list has no card any more, so the page ground under it IS white — the tiles and
  // the step strip separate from that ground on their stroke and their fill alone.
  { what: 'dashboard bucket tile stroke on the white screen', top: borderOf(classOf(pipelineBlock, 'bucketTileIdle')), under: '#FFFFFF' },
  { what: 'dashboard step-strip track on the row hover tint', top: bgOf(classOf(pipelineBlock, 'stripRest')), under: dashRowHover },
  { what: 'dashboard finished step against the untouched track', top: bgOf(classOf(pipelineBlock, 'stripOk')), under: bgOf(classOf(pipelineBlock, 'stripRest')) },
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
  // on the argument that contrast was unchanged — that argument is only as good as a
  // measurement, so it gets one. Deepening the fill for hover spent the slack that
  // argument relied on: the grey now reads 5.32:1 here (it was 6.26:1 on #F3EEFF), and
  // the next grey down (#6B7280) is 3.62:1, i.e. the quieter value someone will reach
  // for is no longer merely below AA, it is well below it.
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
  // /admin/pipelines. Three tiers that shipped under AA because each was measured
  // against a surface it does not sit on:
  //  - the step-strip caption is the strip's only literal reading, and `--pl-text-faint`
  //    put it at 2.58:1 on the white row and 2.34:1 on the hovered one;
  //  - the sidebar caption inherited a page-ground grey onto a gray-900 panel, where the
  //    ramp runs the other way (quieter = lighter) and it landed at 3.57:1;
  //  - the nav count badge wore the dot/bar red as a FILL under white letters, 3.76:1.
  // Both row states are pinned for the caption: the tint is the surface the row swaps to
  // while you are reading it, so it is not a lesser case of white.
  {
    what: 'dashboard step-strip caption on the white row',
    fg: textOf(classOf(pipelineBlock, 'stripCaption')),
    on: '#FFFFFF',
  },
  {
    what: 'dashboard step-strip caption on the row hover tint',
    fg: textOf(classOf(pipelineBlock, 'stripCaption')),
    on: dashRowHover,
  },
  // Everything the identity cell reads out, on both row states. There is no plate left to
  // hide behind, and three of the four runs share `--pl-text-weak`, so one bad tint takes
  // all of them at once — which is exactly what the violet hover did at #F3EEFF.
  { what: 'dashboard Target number on the white row', fg: textOf(dashIdTarget), on: '#FFFFFF' },
  { what: 'dashboard Target number on the row hover tint', fg: textOf(dashIdTarget), on: dashRowHover },
  { what: 'dashboard Target label, hovered, in link colour', fg: hoverTextOf(dashIdTarget), on: dashRowHover },
  { what: 'dashboard Target number on the white row', fg: textOf(dashIdTargetValue), on: '#FFFFFF' },
  { what: 'dashboard Target number on the row hover tint', fg: textOf(dashIdTargetValue), on: dashRowHover },
  { what: 'dashboard Target number, hovered, in link colour', fg: hoverTextOf(dashIdTargetValue), on: dashRowHover },
  { what: 'dashboard 코드 label on the white row', fg: textOf(dashIdCode), on: '#FFFFFF' },
  { what: 'dashboard 코드 label on the row hover tint', fg: textOf(dashIdCode), on: dashRowHover },
  { what: 'dashboard service code value on the white row', fg: textOf(dashIdCodeValue), on: '#FFFFFF' },
  { what: 'dashboard service code value on the row hover tint', fg: textOf(dashIdCodeValue), on: dashRowHover },
  { what: 'dashboard service name on the white row', fg: textOf(dashIdName), on: '#FFFFFF' },
  { what: 'dashboard service name on the row hover tint', fg: textOf(dashIdName), on: dashRowHover },
  // The status word is the column's only hue, and it is 12px — the size at which the raw
  // signal colours drop under AA, which is why these are the `-text` ramp and not `--pl-ok`.
  { what: 'dashboard 완료 green on the white row', fg: dashStatusTone('DONE'), on: '#FFFFFF' },
  { what: 'dashboard 완료 green on the row hover tint', fg: dashStatusTone('DONE'), on: dashRowHover },
  { what: 'dashboard 실패 red on the white row', fg: dashStatusTone('FAILED'), on: '#FFFFFF' },
  { what: 'dashboard 실패 red on the row hover tint', fg: dashStatusTone('FAILED'), on: dashRowHover },
  { what: 'dashboard 실행 중 blue on the white row', fg: dashStatusTone('RUNNING'), on: '#FFFFFF' },
  { what: 'dashboard 실행 중 blue on the row hover tint', fg: dashStatusTone('RUNNING'), on: dashRowHover },
  // 중단은 마크를 벗고 노랑을 받았다(오너 2026-08-15). `--pl-warn`(#F79009) 은 흰 행에서
  // 2.35:1 이라 쓸 수 없고, 여기 값은 `--pl-warn-text`(#B54708) 다.
  { what: 'dashboard 중단 amber on the white row', fg: dashStatusTone('CANCELLED'), on: '#FFFFFF' },
  { what: 'dashboard 중단 amber on the row hover tint', fg: dashStatusTone('CANCELLED'), on: dashRowHover },
  { what: 'dashboard 대기 on the white row', fg: dashStatusTone('PENDING'), on: '#FFFFFF' },
  { what: 'dashboard 대기 on the row hover tint', fg: dashStatusTone('PENDING'), on: dashRowHover },
  // 빈 상태·페이저·잘림 안내는 12px 로 내려오면서 `--pl-text-faint`(2.58:1) 를 벗었다.
  { what: 'dashboard empty state on the white page', fg: textOf(classOf(pipelineBlock, 'empty')), on: '#FFFFFF' },
  { what: 'dashboard pager count on the white page', fg: textOf(classOf(pipelineBlock, 'pagerCount')), on: '#FFFFFF' },
  {
    what: 'dashboard fetch-window notice on the white page',
    fg: textOf(classOf(pipelineBlock, 'pagerTruncated')),
    on: '#FFFFFF',
  },
  {
    what: 'pipelines sidebar caption on the gray-900 sidebar',
    fg: textOf(classOf(pipelineTextBlock, 'sidebarTitle')),
    on: plSidebar,
  },
  {
    what: 'pipelines nav count badge on its red fill',
    fg: textOf(classWith(navLayoutSrc, 'min-w-\\[18px\\]')),
    on: bgOf(classWith(navLayoutSrc, 'min-w-\\[18px\\]')),
  },
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
  // Step 4 grouped rail: quiet text (ordinals, group labels, metabar caption,
  // rail footer) sits DIRECTLY on the gray-100 wrapper, where gray-500 is
  // 4.37:1 and #0064FF is 4.47:1 — both under AA, which is why the rail uses
  // gray-700 and `textOnLight`. Tailwind named-class hexes are framework
  // constants, carried literally.
  { what: 'step4 grouped-rail quiet text (gray-700) on its gray-100 wrapper', fg: '#374151', on: '#F3F4F6' },
  {
    what: 'step4 grouped-rail hot group label on its gray-100 wrapper',
    fg: textOf(classOf(themeSrc, 'textOnLight')),
    on: '#F3F4F6',
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

/**
 * The kind tag's fill against the row tints, by POLARITY rather than by a threshold.
 *
 * A plate this pale can never win a contrast number against a tint that is itself pale —
 * the honest floor here is ~1.1:1, which is too close to the 1.02:1 that broke to be worth
 * asserting. What broke was not the size of the step but its DIRECTION: on white the chip
 * was darker than the row, and on `tableRowLift.target` it became lighter, so the chip
 * inverted mid-hover and passed through equiluminance on the way. One consistent direction
 * is the invariant a reader's eye actually relies on, and it is binary, so it is checkable.
 *
 * The floor stays as a second assertion only to catch a fill that technically stays darker
 * while collapsing to nothing.
 */
const KIND_TAG_SURFACES: Array<[string, string]> = [
  ['the white row', '#FFFFFF'],
  ['the row hover tint', rowHover],
  ['the excluded-row hover tint', rowHoverExcluded],
  ['the card hover tint', hoverBgOf(classOf(liftBlock, 'card'))],
];

describe('kind tag fill stays the darker plate on every row tint', () => {
  it.each(KIND_TAG_SURFACES)('darker than %s', (_what, surface) => {
    expect(luminance(kindTagFill)).toBeLessThan(luminance(surface));
    expect(contrast(kindTagFill, surface)).toBeGreaterThanOrEqual(1.08);
  });
});

/**
 * `tableRowLift.chipEdge` — the hover-only ring that keeps every OTHER chip legible as a
 * plate, since retinting the fills the way the kind tag was retinted is not available to
 * them (their fills are shared palette steps, and the band is 7.5 L* wide either way).
 *
 * A ring earns its place only if it separates on BOTH sides: from the tint outside it, or
 * the chip has no outline, and from its own fill inside it, or the chip just looks bigger
 * and blurrier. Black at 15% is composited onto each fill, so every chip gets an edge in
 * its own hue rather than a foreign grey; the floors below are the measured worst cases
 * (1.26:1 outside on green-100, 1.40:1 inside) with a little headroom taken off.
 *
 * Tailwind resolves `ring-black/15` through color-mix in oklab, which for a pure black
 * leaves RGB at zero and alpha at 0.15 — i.e. the same result as this sRGB composite.
 */
const RING_ALPHA = (() => {
  const m = classOf(liftBlock, 'chipEdge').match(/ring-black\/(\d+)\b/);
  if (!m) throw new Error('no ring-black/<n> in chipEdge');
  return Number(m[1]) / 100;
})();

const composite = (base: string, alpha: number) => {
  const [r, g, b] = srgb(base).map((v) => Math.round(v * 255 * (1 - alpha)));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

// Every chip fill that can appear inside a `tableRowLift` row. Palette steps are spelled
// out because they arrive as `bg-gray-100`-style classes, not as arbitrary values.
const ROW_CHIPS: Array<[string, string]> = [
  ['kind tag', kindTagFill],
  ['RdsMemberChip (gray-100)', '#F3F4F6'],
  ['RdsSelectionChip', bgOf(classOf(themeSrc, 'bgLight'))],
  ['status success (green-100)', '#DCFCE7'],
  ['status info (blue-100)', '#DBEAFE'],
  ['status warning (orange-100)', '#FFEDD5'],
  ['status error (red-100)', '#FEE2E2'],
  ['amber-100', '#FEF3C7'],
  // idcStyles.kindBadge.* and idcStyles.tag.*, read from the live tokens — which carry
  // `chipEdge` on each FILL rather than on their shared `base`, because the base line holds
  // an 11.5px font size the design hook will not let anyone touch.
  //
  // Scoped to their own blocks, not looked up in the whole file: `green`/`red`/`orange`/`gray`
  // are also keys in `tagStyles`, which is declared FIRST, so an unscoped `classOf` silently
  // measures the wrong token (and one that is a palette class `bgOf` cannot even parse).
  ['kindBadge single', bgOf(classOf(kindBadgeBlock, 'single'))],
  ['kindBadge multi', bgOf(classOf(kindBadgeBlock, 'multi'))],
  ['kindBadge domain', bgOf(classOf(kindBadgeBlock, 'domain'))],
  ['tag green', bgOf(classOf(idcTagBlock, 'green'))],
  ['tag red', bgOf(classOf(idcTagBlock, 'red'))],
  ['tag orange', bgOf(classOf(idcTagBlock, 'orange'))],
  ['tag gray', bgOf(classOf(idcTagBlock, 'gray'))],
];

describe('chip hover ring separates on both sides', () => {
  it.each(ROW_CHIPS)('%s', (_what, fill) => {
    const edge = composite(fill, RING_ALPHA);
    expect(contrast(edge, rowHover)).toBeGreaterThanOrEqual(1.2);
    expect(contrast(edge, rowHoverExcluded)).toBeGreaterThanOrEqual(1.2);
    expect(contrast(edge, fill)).toBeGreaterThanOrEqual(1.35);
  });
});

/**
 * The WIRING, which the contrast checks above cannot see: they measure a colour the token
 * declares, so deleting `${tableRowLift.chipEdge}` from every chip would leave them green.
 *
 * Both halves have to hold. `chipEdge` is a NAMED group variant, so it draws nothing unless
 * an ancestor carries `group/row` — and it must stay named, because a bare `group-hover:`
 * answers to any `.group` in the tree and this repo puts `group` on card rows, service tiles
 * and modal list items that are not resource rows at all.
 */
const chipEdgeToken = classOf(liftBlock, 'chipEdge');
const chipBaseDecl = (() => {
  const m = read('app/components/ui/RdsInstanceChips.tsx').match(/const CHIP_BASE =[\s\S]*?;/);
  if (!m) throw new Error('CHIP_BASE not found');
  return m[0];
})();
const CHIP_EDGE_CONSUMERS: Array<[string, string]> = [
  ['RdsInstanceChips CHIP_BASE', chipBaseDecl],
  ['idcStyles.kindBadge.single', classOf(kindBadgeBlock, 'single')],
  ['idcStyles.kindBadge.multi', classOf(kindBadgeBlock, 'multi')],
  ['idcStyles.kindBadge.domain', classOf(kindBadgeBlock, 'domain')],
  ['idcStyles.tag.blue', classOf(idcTagBlock, 'blue')],
  ['idcStyles.tag.green', classOf(idcTagBlock, 'green')],
  ['idcStyles.tag.red', classOf(idcTagBlock, 'red')],
  ['idcStyles.tag.orange', classOf(idcTagBlock, 'orange')],
  ['idcStyles.tag.gray', classOf(idcTagBlock, 'gray')],
  ['ec2Styles.newBadge', classOf(themeSrc, 'newBadge')],
];

describe('chip hover ring is actually wired up', () => {
  it('chipEdge is scoped to the named row group, not to any `group`', () => {
    expect(chipEdgeToken).toMatch(/group-hover\/row:/);
    expect(chipEdgeToken).toMatch(/group-focus-within\/row:/);
    // A bare `group-hover:`/`group-focus-within:` here would leak to every unrelated `.group`.
    expect(chipEdgeToken).not.toMatch(/group-hover:/);
    expect(chipEdgeToken).not.toMatch(/group-focus-within:/);
  });

  it.each([
    ['tableRowLift.base', classOf(liftBlock, 'base')],
    ['idcStyles.table.row', classOf(idcTableBlock, 'row')],
  ])('%s marks the row with group/row', (_what, cls) => {
    expect(cls).toMatch(/(?:^|\s)group\/row(?:\s|$)/);
  });

  it.each(CHIP_EDGE_CONSUMERS)('%s carries chipEdge', (_what, src) => {
    expect(src).toContain('tableRowLift.chipEdge');
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

  // /admin/pipelines, found by eye on the live page. Every one of the four is the same
  // mistake in a different place: a colour picked against a surface, then rendered on a
  // different one. The replays are the BEFORE values, so they fail the rules above.
  it('H12 step-strip caption --pl-text-faint on the row, white (2.58:1) and hovered (2.34:1)', () => {
    expect(contrast(resolve('var(--pl-text-faint)'), '#FFFFFF')).toBeLessThan(4.5);
    expect(contrast(resolve('var(--pl-text-faint)'), dashRowHover)).toBeLessThan(4.5);
  });

  it('H13 sidebar caption --pl-gray-500 on the gray-900 sidebar (3.57:1)', () => {
    // It clears AA on the page ground it was borrowed from — the dark panel is where
    // the ramp inverts, and a token cannot carry which direction it was chosen for.
    expect(contrast(resolve('var(--pl-gray-500)'), plSidebar)).toBeLessThan(4.5);
    expect(contrast(resolve('var(--pl-gray-500)'), resolve('var(--pl-bg-page)'))).toBeGreaterThanOrEqual(4.5);
  });

  it('H14 nav count badge: white on --pl-err (3.76:1), the dot red used as a fill', () => {
    expect(contrast('#FFFFFF', resolve('var(--pl-err)'))).toBeLessThan(4.5);
    expect(contrast('#FFFFFF', resolve('var(--pl-err-solid)'))).toBeGreaterThanOrEqual(4.5);
  });

  it('H15 code chip fill was the row hover tint itself — the chip erased at 1.000:1', () => {
    // ΔE00 0.00 and contrast 1.000: not "hard to see", absent. The surface rule catches
    // this one, which is the point — the pair was simply never written down, because the
    // chip is declared 100 lines from the hover it collides with.
    //
    // Both halves are LITERALS, not tokens: the row hover has since moved to violet, and
    // reading it live would quietly stop replaying the bug the day the token changed.
    const historicChipFill = '#F2F4F7';
    const historicRowHover = '#F2F4F7';
    expect(deltaE00(historicChipFill, historicRowHover)).toBeLessThan(SURFACE_MIN);
    expect(contrast(historicChipFill, historicRowHover)).toBeLessThan(1.01);
    // The cell carries no plate at all now (오너: "tag 없애봐"), so the shape that could
    // collide is gone rather than fixed — what remains is bare text, and the TEXT block
    // above measures every run of it against both row states.
  });

  it('H11 kind tag #F3EEFF inverted against the row hover tint (1.02:1)', () => {
    // Reported as "the EC2 / RDS Cluster tag fades out under the cursor". #F3EEFF is L* 94.9
    // and `tableRowLift.target` is L* 94.0, so hovering left 0.9 L* between chip and row and
    // flipped which of the two was lighter. ΔE00 was 5.99 — six times the JND — so the surface
    // rule above called it fine, the same metric-selection trap as H10.
    expect(deltaE00('#F3EEFF', rowHover)).toBeGreaterThanOrEqual(SURFACE_MIN);
    expect(contrast('#F3EEFF', rowHover)).toBeLessThan(1.05);
    expect(luminance('#F3EEFF')).toBeGreaterThan(luminance(rowHover)); // the inversion

    // And it was never one tag's bug: the whole chip vocabulary is built at L* 92..96 while
    // both row tints sit at L* 92..94, so every chip fill goes equiluminant under the cursor.
    // These fills are still equiluminant and always will be — moving the tint cannot fix it
    // (the band is 7.5 L* wide, and below the band the unpromoted verdict text #B45309 drops
    // under AA). What changed is that the fill is no longer the only thing holding the chip:
    // `chipEdge` gives each one a measured stroke while the row is tinted.
    for (const chip of ['#F3F4F6', '#E8F1FF', '#DBEAFE', '#FFEDD5', '#FEE2E2']) {
      expect(contrast(chip, rowHover)).toBeLessThan(1.1);
    }
  });

  it('H7 --pl-bg-page tinted to #F2F4F7 collides with the ops-alerts tiles', () => {
    // the "ops-alerts tile on page ground" entry above with bg-page at its regressed value
    expect(deltaE00(resolve('var(--pl-gray-100)'), '#F2F4F7')).toBeLessThan(SURFACE_MIN);
  });
});

/**
 * The RDS instance band draws the same tree rail as an Athena group, from a different anchor:
 * the group's offsets are measured inside a name cell, the band's inside a colspan cell that
 * starts one whole column to the left. Two numbers in two tokens have to agree for the rail to
 * come out as ONE line, and nothing in the type system says so — hence a guard.
 */
describe('instance band rail shares the group rail axis', () => {
  /**
   * `classOf` reads single-quoted values, and a rail token is double-quoted because it carries
   * `content-['']` — whose apostrophes end that helper's match halfway through the string.
   */
  const railClassOf = (src: string, key: string) => {
    const m = src.match(new RegExp(`(?<![\\w])${key}:\\s*\\n?\\s*"([^"]*)"`));
    return m ? m[1] : classOf(src, key);
  };
  const px = (cls: string, pattern: RegExp) => {
    const m = cls.match(pattern);
    if (!m) throw new Error(`no ${pattern} in "${cls}"`);
    return Number(m[1]);
  };
  const bandSrc = themeSrc.match(/instanceBand: \{[\s\S]*?\n {4}\}/)?.[0] ?? '';
  const groupSrc = themeSrc.match(/group: \{[\s\S]*?\n {4}\}/)?.[0] ?? '';

  it('the trunk lands on the group chevron, and the name on the child tier', () => {
    // Athena: rail x = 16 inside a name cell; a child name at 54 in the same cell.
    const groupRail = px(railClassOf(groupSrc, 'childCell'), /before:left-\[(\d+)px\]/);
    const groupChild = px(railClassOf(groupSrc, 'childCell'), /pl-\[(\d+)px\]/);
    // The band: content at 106 (= 52 checkbox column + 54), rail pulled back from it.
    const bandRail = px(railClassOf(bandSrc, 'line'), /before:-left-\[(\d+)px\]/);
    // Both cells sit on the same left edge once the checkbox column is accounted for, so the
    // pull-back must equal the gap the group leaves between its own rail and its child name.
    expect(bandRail).toBe(groupChild - groupRail);
  });

  it('the radio hangs clear of the elbow rather than touching it', () => {
    const axis = px(railClassOf(bandSrc, 'line'), /before:-left-\[(\d+)px\]/);
    // Every rail pseudo-element in the band hangs off that one axis.
    const offsets = [...bandSrc.matchAll(/-left-\[(\d+)px\]/g)].map((m) => Number(m[1]));
    expect(new Set(offsets)).toEqual(new Set([axis]));
    // The radio is the exception — it hangs in the tier gap, on Tailwind's 4px scale.
    const radio = px(railClassOf(bandSrc, 'radio'), /-left-(\d+)\b/) * 4;
    const elbow = px(railClassOf(bandSrc, 'line'), /after:w-\[(\d+)px\]/);
    expect(axis - radio).toBeGreaterThan(elbow);
  });
});
