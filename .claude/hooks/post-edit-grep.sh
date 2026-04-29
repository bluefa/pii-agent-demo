#!/usr/bin/env bash
# PostToolUse hook for Edit|Write: enforce CLAUDE.md hard rules and emit warnings for repeat-offender patterns.
# Blockers (exit 2) cover CRITICAL #2/#3/#4 plus a few clear-bug patterns from past PR reviews.
# Warnings (exit 0) cover repeat patterns; the model sees them but the edit proceeds.
set -uo pipefail

input="$(cat)"
file="$(echo "$input" | /usr/bin/jq -r '.tool_input.file_path // empty')"

[ -z "$file" ] && exit 0
[ ! -f "$file" ] && exit 0

blockers=""
warnings=""

# ─── Blockers (exit 2) ───────────────────────────────────

case "$file" in
  *.ts|*.tsx)
    # CRITICAL #2: any type — covers `: any`, `as any`, `<any>`, `any[]`, `= any`, `, any` (generic arg)
    if hits=$(/usr/bin/grep -nE ':\s*any\b|<any>|<[^>]*\b,\s*any[\s,>]|as\s+any\b|any\[\]|=\s*any\b' "$file" 2>/dev/null | head -3); [ -n "$hits" ]; then
      blockers+=$'\n[BLOCK CRITICAL #2] `any` type forbidden:\n'"$hits"
    fi
    # CRITICAL #3: relative import — covers single + double quote, side-effect imports, dynamic import.
    if hits=$(/usr/bin/grep -nE "(from|import)\s+['\"](\.\.?/)|import\(['\"](\.\.?/)" "$file" 2>/dev/null | head -3); [ -n "$hits" ]; then
      blockers+=$'\n[BLOCK CRITICAL #3] relative import forbidden — use `@/` alias:\n'"$hits"
    fi
    ;;
esac

case "$file" in
  *.tsx)
    # CRITICAL #4: raw Tailwind color
    if hits=$(/usr/bin/grep -nE '(text|bg|border|ring|divide|from|to|via|shadow)-(red|blue|green|yellow|gray|slate|zinc|neutral|stone|orange|amber|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)-[0-9]+' "$file" 2>/dev/null | head -3); [ -n "$hits" ]; then
      blockers+=$'\n[BLOCK CRITICAL #4] raw Tailwind color forbidden — use `lib/theme.ts` token:\n'"$hits"
    fi
    # Dynamic Tailwind class — JIT cannot extract this; produces silent style failure
    if hits=$(/usr/bin/grep -nE '`(hover|focus|active|sm|md|lg|xl):\$\{' "$file" 2>/dev/null | head -3); [ -n "$hits" ]; then
      blockers+=$'\n[BLOCK] dynamic Tailwind class — JIT cannot extract; use static strings:\n'"$hits"
    fi
    ;;
esac

# Anti-pattern F1: native alert(). Applies to .ts AND .tsx (a `.ts` utility can call window.alert too).
# Pattern excludes `dialog.alert(`, `useAlert(`, etc. by requiring no preceding word/dot character.
# Skip test files — XSS-payload string literals legitimately contain "alert(".
case "$file" in
  *.ts|*.tsx)
    case "$file" in
      *__tests__*|*.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx) ;;
      *)
        if hits=$(/usr/bin/grep -nE '(^|[^.A-Za-z0-9_])(window\.)?alert\(' "$file" 2>/dev/null | head -3); [ -n "$hits" ]; then
          blockers+=$'\n[BLOCK F1] native alert() forbidden — use toast/modal:\n'"$hits"
        fi
        ;;
    esac
    ;;
esac

# Contract-First (PR #179, ADR-011): route.ts must dispatch to bff.method() and not parse upstream JSON.
# Pattern matches any `await <var>.json()` then excludes `request.json()` / `req.json()` (incoming body parse is OK).
case "$file" in
  */route.ts)
    if hits=$(/usr/bin/grep -nE 'await\s+[A-Za-z_$][A-Za-z0-9_$]*\.json\s*\(\s*\)' "$file" 2>/dev/null \
              | /usr/bin/grep -vE 'await\s+(request|req)\.json' \
              | head -3); [ -n "$hits" ]; then
      blockers+=$'\n[BLOCK Contract-First/ADR-011] route.ts must not parse upstream JSON — dispatch via `bff.method()` from `@/lib/bff/client` (request.json() for incoming body is allowed):\n'"$hits"
    fi
    ;;
esac

# ─── Warnings (exit 0) ───────────────────────────────────

# PR #328 regression: getStore() helpers need IS_MOCK guard
case "$file" in
  *resolve*|*mock-store*|*/app/integration/api/*/route.ts)
    if /usr/bin/grep -qE '(getStore|mockProjects|getProjectBy|getS3UploadStatus)' "$file" \
       && ! /usr/bin/grep -qE '(IS_MOCK|USE_MOCK_DATA)' "$file"; then
      warnings+=$'\n[Regression PR #328] mock helper without IS_MOCK guard — risk of mock leak in BFF mode.'
    fi
    ;;
esac

# Code-only checks below: gate on .ts/.tsx so this hook does not flag its own grep
# patterns when the user edits a .sh / .md / settings.json file.
case "$file" in
  *.ts|*.tsx)
    # PR #296: useApiMutation onSuccess fire-and-forget
    if /usr/bin/grep -qE 'useApiMutation|useApiAction' "$file" 2>/dev/null; then
      if /usr/bin/grep -A4 'onSuccess[:]\?\s*[:=({]' "$file" 2>/dev/null \
         | /usr/bin/grep -E '\b(refresh|refetch|startPolling|mutate)\(' >/dev/null 2>&1; then
        warnings+=$'\n[PR #296] useApiMutation onSuccess is fire-and-forget — `await` follow-up async work in the action body instead.'
      fi
    fi

    # PR #311: "preserves original behavior" rationalization for hidden bugs
    if hits=$(/usr/bin/grep -nE 'preserves? (original|pre-existing) behavior|preserve the bug' "$file" 2>/dev/null | head -3); [ -n "$hits" ]; then
      warnings+=$'\n[PR #311] "preserves original behavior" comment — re-evaluate (in-scope pure extraction = fix; out-of-scope JSX/style = defer):\n'"$hits"
    fi
    ;;
esac

# Anti-pattern H1: inline SVG in feature components.
# Match `/app/` or `/components/` anywhere in the path (works for absolute paths Claude Code passes).
case "$file" in
  *.tsx)
    case "$file" in
      */app/*|*/components/*)
        if hits=$(/usr/bin/grep -nE '^\s*<svg' "$file" 2>/dev/null | head -3); [ -n "$hits" ]; then
          warnings+=$'\n[H1] inline <svg> — extract to shared icon module (components/icons):\n'"$hits"
        fi
        ;;
    esac
    ;;
esac

# Anti-pattern G9: history-narrating comments
case "$file" in
  *.ts|*.tsx)
    if hits=$(/usr/bin/grep -nE '//.*\b(this fix|this refactor|was flagged|removed for|PR #[0-9]+)' "$file" 2>/dev/null | head -3); [ -n "$hits" ]; then
      warnings+=$'\n[G9] history-narrating comment — describe current invariant only:\n'"$hits"
    fi
    ;;
esac

# Mockup PII (sit-recurring-checks #6 extended): real Samsung domain placeholders.
# Gate on code/markup files only — .sh/.md may legitimately reference these strings as documentation.
case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.html)
    if hits=$(/usr/bin/grep -nE '@samsung\.com|cyongj2\.park|cyongj2' "$file" 2>/dev/null | head -3); [ -n "$hits" ]; then
      warnings+=$'\n[sit-checks#6] real Samsung PII placeholder — anonymize (user@example.com / JD) or drop the block:\n'"$hits"
    fi
    ;;
esac

# ─── Output ──────────────────────────────────────────────

if [ -n "$blockers" ]; then
  echo "⛔  $file" >&2
  echo "BLOCKED — CLAUDE.md hard rule violation. Fix before continuing." >&2
  echo "$blockers" >&2
  if [ -n "$warnings" ]; then
    printf '\n' >&2
    echo "Additional warnings:" >&2
    echo "$warnings" >&2
  fi
  exit 2
fi

# DESIGN.md edited — surface @google/design.md lint output inline (best-effort).
# Skipped silently when the dependency is not yet installed (e.g., a fresh clone
# before `npm install`). Hook never blocks; lint surface is advisory.
case "$file" in
  DESIGN.md|*/DESIGN.md)
    repo_root="${CLAUDE_PROJECT_DIR:-$(dirname "$file")}"
    npx_bin="$(command -v npx 2>/dev/null || true)"
    if [ -n "$npx_bin" ] \
       && [ -f "$repo_root/node_modules/@google/design.md/package.json" ]; then
      lint_json="$(cd "$repo_root" && "$npx_bin" --no-install @google/design.md lint "$file" 2>&1 || true)"
      lint_summary="$(printf '%s' "$lint_json" \
        | /usr/bin/jq -r '.summary | "errors=\(.errors) warnings=\(.warnings) infos=\(.infos)"' 2>/dev/null \
        || true)"
      lint_errors="$(printf '%s' "$lint_json" \
        | /usr/bin/jq -r '.findings[] | select(.severity=="error") | "  \(.path // "(file)"): \(.message)"' 2>/dev/null \
        | /usr/bin/head -5 || true)"
      if [ -n "$lint_summary" ]; then
        warnings+=$'\n[DESIGN.md] @google/design.md lint: '"$lint_summary"
        if [ -n "$lint_errors" ]; then
          warnings+=$'\n'"$lint_errors"
        fi
      fi
    fi
    ;;
esac

if [ -n "$warnings" ]; then
  echo "⚠️  $file" >&2
  echo "$warnings" >&2
fi

exit 0
