#!/usr/bin/env node
// PostToolUse hook for Edit|Write: design constraints on NEWLY ADDED lines only.
//   1. font-size px must be even
//   2. text color contrast vs the page surface must be >= 4.5:1 (WCAG AA; 3:1 for large text)
// Blocks (exit 2). Pre-existing values are not re-flagged: the file is diffed against HEAD.
// Colors may be literal hex or var(--pl-*) — the latter resolve via app/globals.css.
// Static blind spot (surface-vs-surface, parent backgrounds): lib/design-guard.test.ts.
// Escape hatch: a line carrying `design-exempt:` plus a reason is skipped. Legitimate cases are
// the WCAG 1.4.3/1.4.11 exemptions only — brand logotypes, disabled controls, dark-surface text.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';

const SURFACE = '#FFFFFF'; // ponytail: dominant page surface; #F7F8FA is ~5% darker, add if it bites
const AA = 4.5;
const AA_LARGE = 3.0;

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}
const file = input?.tool_input?.file_path;
if (!file || !/\.(tsx|ts|css|html)$/.test(file)) process.exit(0);

// Anchor git at the edited file's own directory, not CLAUDE_PROJECT_DIR: an edit in a
// linked worktree is outside the main checkout, so a project-dir diff throws and the
// fallback scanned the WHOLE file — re-flagging every pre-existing value as "added".
const root = dirname(file);
let added;
try {
  const git = (cmd) => execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const diff = git(`git diff HEAD -- "${file}"`);
  if (diff) {
    added = diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
  } else if (git(`git ls-files -- "${file}"`).trim()) {
    process.exit(0); // tracked and unchanged vs HEAD — nothing was added
  } else {
    added = readFileSync(file, 'utf8').split('\n'); // untracked file: everything is new
  }
} catch {
  try {
    added = readFileSync(file, 'utf8').split('\n'); // outside the repo: no baseline to diff against
  } catch {
    process.exit(0);
  }
}

// `--pl-*` tokens resolve to their literal in app/globals.css (LIN-91): a line like
// `bg-[var(--pl-gray-200)] text-[var(--pl-text-weak)]` is a checkable pair — falling back
// to white silently passed a 4.01:1 AA failure. Unknown vars stay unchecked (null).
let tokens;
const resolveVar = (name) => {
  if (!tokens) {
    tokens = {};
    try {
      const top = execSync(`git -C "${root}" rev-parse --show-toplevel`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      const css = readFileSync(`${top}/app/globals.css`, 'utf8');
      for (const m of css.matchAll(/(--pl-[\w-]+):\s*(#[0-9A-Fa-f]{6})\b/g)) tokens[m[1]] = m[2];
    } catch {}
  }
  return tokens[name] ?? null;
};
const COLOR = '(?:(#[0-9A-Fa-f]{6})|var\\((--pl-[\\w-]+)\\))';
const asHex = (m) => m[1] ?? resolveVar(m[2]);

const luminance = (hex) => {
  const c = hex
    .match(/[0-9a-f]{2}/gi)
    .map((x) => parseInt(x, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const warnings = [];

for (const line of added) {
  if (line.includes('design-exempt:')) continue;

  const sizes = [...line.matchAll(/(?:text-\[|font-size:\s*|fontSize:\s*['"])([0-9.]+)px/g)].map(
    (m) => Number(m[1]),
  );

  for (const size of sizes) {
    if (size % 2 !== 0) {
      warnings.push(`[FONT-EVEN] ${size}px — font size must be even: ${line.trim().slice(0, 110)}`);
    }
  }

  // Large text (>=24px, or >=19px bold) only needs 3:1 per WCAG.
  const isLarge = sizes.some(
    (s) => s >= 24 || (s >= 19 && /font-(bold|extrabold|black)/.test(line)),
  );
  const min = isLarge ? AA_LARGE : AA;

  // Surfaces: rest-state bg declared on the same line (tinted chips/buttons), else the page surface.
  // ponytail: rest-state only — hover:text/hover:bg pairing is not associated, audit hover manually.
  const bgs = [...line.matchAll(new RegExp(`(?<!hover:)(?<!disabled:)bg-\\[${COLOR}\\](?!/)`, 'g'))]
    .map(asHex)
    .filter(Boolean);
  const surfaces = bgs.length ? bgs : [SURFACE];

  for (const m of line.matchAll(new RegExp(`(?<!hover:)(?<!disabled:)text-\\[${COLOR}\\]`, 'g'))) {
    const fg = asHex(m);
    if (!fg) continue;
    for (const bg of surfaces) {
      const ratio = contrast(fg, bg);
      if (ratio < min) {
        warnings.push(
          `[CONTRAST] ${fg} on ${bg} = ${ratio.toFixed(2)}:1 (need ${min}:1) — ${line.trim().slice(0, 110)}`,
        );
      }
    }
  }
}

if (warnings.length) {
  console.error(`⛔  ${file}`);
  console.error('BLOCKED — design constraint violation. Fix before continuing.');
  console.error([...new Set(warnings)].slice(0, 8).join('\n'));
  console.error(
    'Round font sizes to the nearest even px (ties round up). Darken the color, or append ' +
      '`design-exempt: <reason>` on the line if it is a brand logotype, a disabled control, or text on a dark surface.',
  );
  process.exit(2);
}
process.exit(0);
