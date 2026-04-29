#!/usr/bin/env bash
# PreToolUse hook for Bash: gate `gh pr create` behind mechanical checks.
# Goal: catch CLAUDE.md hard-rule violations and lint/tsc errors locally so Codex review
# does not need to flag them, cutting multi-round review cycles to one.
#
# Steps (each runs only on files changed vs origin/main):
#   1. eslint on changed files (exit-status driven)
#   2. tsc --noEmit (env-only errors filtered: stale `.next/(dev/)?types/`, missing optional devDeps)
#   3. CLAUDE.md hard-rule grep on changed files
#   4. sit-recurring-checks grep on changed files
#
# tsc was previously excluded because stale `.next/dev/types` and missing devDeps
# raised PR-blocking errors that had no relation to the changes. The filter below
# strips those env-only errors so real type errors still surface as exit 2.
#
# Any failure → stderr summary + exit 2. PR creation is blocked.
# On pass → exit 0 silently.

set -uo pipefail

input="$(cat)"
command="$(echo "$input" | /usr/bin/jq -r '.tool_input.command // empty')"

case "$command" in
  *"gh pr create"*) ;;
  *) exit 0 ;;
esac

repo_root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$repo_root" || exit 0

# Ensure we have an up-to-date origin/main to diff against
git fetch origin main --quiet 2>/dev/null || true

if ! git rev-parse --verify origin/main >/dev/null 2>&1; then
  exit 0  # No origin/main — skip silently rather than block PR creation
fi

# Collect changed code files (text, not binary; .ts/.tsx/.js/.jsx).
# bash 3.2 (macOS default) lacks `mapfile`, so use newline-separated string instead.
changed=$(git diff --name-only origin/main...HEAD 2>/dev/null \
  | /usr/bin/grep -E '\.(tsx?|jsx?)$' || true)

if [ -z "$changed" ]; then
  exit 0  # No code files changed — nothing for us to enforce
fi

problems=""
add_section() {
  problems+=$'\n── '"$1"$' ──────────────────────'$'\n'"$2"
}

# ─── 1. eslint on changed files ──────────────────────────
# Build a Bash-3.2 / BSD-compatible array (no `xargs -d`, which is GNU-only).
files=()
while IFS= read -r line; do
  [ -n "$line" ] && files+=("$line")
done <<< "$changed"

if [ -x ./node_modules/.bin/eslint ] && [ "${#files[@]}" -gt 0 ]; then
  lint_out=$(./node_modules/.bin/eslint "${files[@]}" 2>&1)
  lint_status=$?
  if [ "$lint_status" -ne 0 ]; then
    add_section "eslint (changed files)" "$(printf '%s' "$lint_out" | tail -40)"
  fi
fi

# ─── 2. tsc --noEmit (env-only errors filtered) ──────────

if [ -x ./node_modules/.bin/tsc ]; then
  tsc_raw=$(./node_modules/.bin/tsc --noEmit --pretty false 2>&1 || true)
  # Filter env-only errors that should not block PR creation:
  # - Stale `.next/(dev/)?types/validator.ts` from route relocations
  # - Missing optional devDeps not installed in this worktree (e.g. @testing-library/react)
  tsc_filtered=$(printf '%s\n' "$tsc_raw" \
    | /usr/bin/grep -vE '^\.next/(dev/)?types/' \
    | /usr/bin/grep -vE "Cannot find module '@testing-library/" \
    || true)
  if printf '%s' "$tsc_filtered" | /usr/bin/grep -qE 'error TS[0-9]+'; then
    add_section "tsc --noEmit (env-only errors filtered)" "$(printf '%s' "$tsc_filtered" | head -30)"
  fi
fi

# ─── 3. CLAUDE.md hard-rule grep ─────────────────────────

hard=""
append_hard() {
  hard+=$'\n['"$1"$']\n'"$2"
}

while IFS= read -r f; do
  [ -z "$f" ] && continue
  [ -f "$f" ] || continue
  case "$f" in
    *.ts|*.tsx)
      if hits=$(/usr/bin/grep -HnE ':\s*any\b|<any>|<[^>]*\b,\s*any[\s,>]|as\s+any\b|any\[\]|=\s*any\b' "$f" 2>/dev/null | head -2); [ -n "$hits" ]; then
        append_hard "CRITICAL #2 any" "$hits"
      fi
      if hits=$(/usr/bin/grep -HnE "(from|import)\s+['\"](\.\.?/)|import\(['\"](\.\.?/)" "$f" 2>/dev/null | head -2); [ -n "$hits" ]; then
        append_hard "CRITICAL #3 relative-import" "$hits"
      fi
      ;;
  esac
  case "$f" in
    *.tsx)
      if hits=$(/usr/bin/grep -HnE '(text|bg|border|ring|divide|from|to|via|shadow)-(red|blue|green|yellow|gray|slate|zinc|neutral|stone|orange|amber|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)-[0-9]+' "$f" 2>/dev/null | head -2); [ -n "$hits" ]; then
        append_hard "CRITICAL #4 raw-color" "$hits"
      fi
      if hits=$(/usr/bin/grep -HnE '`(hover|focus|active|sm|md|lg|xl):\$\{' "$f" 2>/dev/null | head -2); [ -n "$hits" ]; then
        append_hard "dynamic-Tailwind" "$hits"
      fi
      ;;
  esac
  # F1 alert(): applies to .ts AND .tsx; skip test files.
  case "$f" in
    *.ts|*.tsx)
      case "$f" in
        *__tests__*|*.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx) ;;
        *)
          if hits=$(/usr/bin/grep -HnE '(^|[^.A-Za-z0-9_])(window\.)?alert\(' "$f" 2>/dev/null | head -2); [ -n "$hits" ]; then
            append_hard "F1 alert" "$hits"
          fi
          ;;
      esac
      ;;
  esac
  case "$f" in
    */route.ts)
      # Match `await <var>.json()` then exclude `request.json()` / `req.json()` (incoming body parse is allowed).
      if hits=$(/usr/bin/grep -HnE 'await\s+[A-Za-z_$][A-Za-z0-9_$]*\.json\s*\(\s*\)' "$f" 2>/dev/null \
                | /usr/bin/grep -vE 'await\s+(request|req)\.json' \
                | head -2); [ -n "$hits" ]; then
        append_hard "Contract-First/ADR-011 (use bff.method())" "$hits"
      fi
      ;;
  esac
done <<< "$changed"

if [ -n "$hard" ]; then
  add_section "CLAUDE.md hard-rule grep" "$hard"
fi

# ─── 3. sit-recurring-checks grep ────────────────────────

sit=""
append_sit() {
  sit+=$'\n['"$1"$']\n'"$2"
}

while IFS= read -r f; do
  [ -z "$f" ] && continue
  [ -f "$f" ] || continue
  if [ "${f##*.}" = "tsx" ]; then
    if hits=$(/usr/bin/grep -HnE '<svg[^>]*animate-spin' "$f" 2>/dev/null | head -2); [ -n "$hits" ]; then
      append_sit "animate-svg-wrapper (P1)" "$hits"
    fi
  fi
  case "$f" in
    *theme.ts) ;;
    *)
      if hits=$(/usr/bin/grep -HnE '#[0-9a-fA-F]{6}' "$f" 2>/dev/null | head -2); [ -n "$hits" ]; then
        append_sit "raw-hex (P2)" "$hits"
      fi
      ;;
  esac
  if hits=$(/usr/bin/grep -HnE '@(gmail|naver|kakao|daum|hanmail|yahoo|samsung)\.(com|co\.kr|net)' "$f" 2>/dev/null | head -2); [ -n "$hits" ]; then
    append_sit "mockup-pii (P1)" "$hits"
  fi
done <<< "$changed"

if [ -n "$sit" ]; then
  add_section "sit-recurring-checks" "$sit"
fi

# ─── Output ──────────────────────────────────────────────

if [ -n "$problems" ]; then
  echo "⛔ Pre-PR check failed — fix before opening PR" >&2
  printf '%s\n' "$problems" >&2
  echo "" >&2
  echo "After fixing, re-run \`gh pr create\`. Run /sit-recurring-checks for guided fixes." >&2
  exit 2
fi

exit 0
