#!/usr/bin/env bash
# PreToolUse hook for Bash: gate `gh pr create` behind mechanical checks.
# Goal: catch CLAUDE.md hard-rule violations and lint/tsc errors locally so Codex review
# does not need to flag them, cutting multi-round review cycles to one.
#
# Steps (each runs only on files changed vs origin/main):
#   1. eslint on changed files (exit-status driven)
#   2. CLAUDE.md hard-rule grep on changed files
#   3. sit-recurring-checks grep on changed files
#
# tsc is intentionally NOT run here — the `Stop` hook (stop-verify.sh) covers it,
# and inline tsc inside PreToolUse blocks PR creation on unrelated stale `.next/dev/types`
# or missing devDeps state, which produces too many false-block events.
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

if [ -x ./node_modules/.bin/eslint ]; then
  # Newline-separated `changed` → xargs (`-d '\n'` keeps brackets/spaces in pathnames intact).
  lint_out=$(printf '%s\n' "$changed" | /usr/bin/xargs -d '\n' ./node_modules/.bin/eslint 2>&1)
  lint_status=$?
  if [ "$lint_status" -ne 0 ]; then
    add_section "eslint (changed files)" "$(printf '%s' "$lint_out" | tail -40)"
  fi
fi

# ─── 2. CLAUDE.md hard-rule grep ─────────────────────────

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
      case "$f" in
        *__tests__*|*.test.tsx|*.spec.tsx) ;;
        *)
          if hits=$(/usr/bin/grep -HnE '(^|[^.A-Za-z0-9_])(window\.)?alert\(' "$f" 2>/dev/null | head -2); [ -n "$hits" ]; then
            append_hard "F1 alert" "$hits"
          fi
          ;;
      esac
      if hits=$(/usr/bin/grep -HnE '`(hover|focus|active|sm|md|lg|xl):\$\{' "$f" 2>/dev/null | head -2); [ -n "$hits" ]; then
        append_hard "dynamic-Tailwind" "$hits"
      fi
      ;;
  esac
  case "$f" in
    */route.ts)
      if hits=$(/usr/bin/grep -HnE 'await\s+[A-Za-z_$][A-Za-z0-9_$]*\.json\s*\(\s*\)' "$f" 2>/dev/null | head -2); [ -n "$hits" ]; then
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
