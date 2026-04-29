#!/usr/bin/env bash
# PreToolUse hook for Bash: gate `gh pr create` behind local mechanical checks.
set -uo pipefail

input="$(cat)"
node_bin="$(command -v node 2>/dev/null || true)"
[ -n "$node_bin" ] || exit 0

command="$(printf '%s' "$input" | "$node_bin" -e '
const fs = require("fs");
let data = "";
process.stdin.on("data", chunk => { data += chunk; });
process.stdin.on("end", () => {
  try {
    const parsed = JSON.parse(data);
    const command = parsed && parsed.tool_input && typeof parsed.tool_input.command === "string"
      ? parsed.tool_input.command
      : "";
    process.stdout.write(command);
  } catch {
    process.stdout.write("");
  }
});
')"

case "$command" in
  *"gh pr create"*) ;;
  *) exit 0 ;;
esac

repo_root="${CODEX_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$repo_root" || exit 0

if ! git rev-parse --verify origin/main >/dev/null 2>&1; then
  exit 0
fi

changed="$(git diff --name-only origin/main...HEAD 2>/dev/null | /usr/bin/grep -E '\.(tsx?|jsx?)$' || true)"
[ -n "$changed" ] || exit 0

problems=""
add_section() {
  problems+=$'\n-- '"$1"$' --------------------'$'\n'"$2"
}

if [ -x ./node_modules/.bin/eslint ]; then
  lint_out="$(printf '%s\n' "$changed" | /usr/bin/xargs -d '\n' ./node_modules/.bin/eslint 2>&1)"
  lint_status=$?
  if [ "$lint_status" -ne 0 ]; then
    add_section "eslint (changed files)" "$(printf '%s' "$lint_out" | tail -40)"
  fi
fi

hard=""
append_hard() {
  hard+=$'\n['"$1"$']\n'"$2"
}

while IFS= read -r file; do
  [ -n "$file" ] && [ -f "$file" ] || continue

  case "$file" in
    *.ts|*.tsx)
      if hits=$(/usr/bin/grep -HnE ':\s*any\b|<any>|<[^>]*\b,\s*any[\s,>]|as\s+any\b|any\[\]|=\s*any\b' "$file" 2>/dev/null | head -2); [ -n "$hits" ]; then
        append_hard "CRITICAL #2 any" "$hits"
      fi
      if hits=$(/usr/bin/grep -HnE "(from|import)\s+['\"](\.\.?/)|import\(['\"](\.\.?/)" "$file" 2>/dev/null | head -2); [ -n "$hits" ]; then
        append_hard "CRITICAL #3 relative-import" "$hits"
      fi
      ;;
  esac

  case "$file" in
    *.tsx)
      if hits=$(/usr/bin/grep -HnE '(text|bg|border|ring|divide|from|to|via|shadow)-(red|blue|green|yellow|gray|slate|zinc|neutral|stone|orange|amber|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)-[0-9]+' "$file" 2>/dev/null | head -2); [ -n "$hits" ]; then
        append_hard "CRITICAL #4 raw-color" "$hits"
      fi
      case "$file" in
        *__tests__*|*.test.tsx|*.spec.tsx) ;;
        *)
          if hits=$(/usr/bin/grep -HnE '(^|[^.A-Za-z0-9_])(window\.)?alert\(' "$file" 2>/dev/null | head -2); [ -n "$hits" ]; then
            append_hard "F1 alert" "$hits"
          fi
          ;;
      esac
      if hits=$(/usr/bin/grep -HnE '`(hover|focus|active|sm|md|lg|xl):\$\{' "$file" 2>/dev/null | head -2); [ -n "$hits" ]; then
        append_hard "dynamic-Tailwind" "$hits"
      fi
      ;;
  esac

  case "$file" in
    */route.ts)
      if hits=$(/usr/bin/grep -HnE 'await\s+[A-Za-z_$][A-Za-z0-9_$]*\.json\s*\(\s*\)' "$file" 2>/dev/null | head -2); [ -n "$hits" ]; then
        append_hard "Contract-First/ADR-011 (use bff.method())" "$hits"
      fi
      ;;
  esac
done <<< "$changed"

[ -n "$hard" ] && add_section "AGENTS.md hard-rule grep" "$hard"

sit=""
append_sit() {
  sit+=$'\n['"$1"$']\n'"$2"
}

while IFS= read -r file; do
  [ -n "$file" ] && [ -f "$file" ] || continue
  if [ "${file##*.}" = "tsx" ]; then
    if hits=$(/usr/bin/grep -HnE '<svg[^>]*animate-spin' "$file" 2>/dev/null | head -2); [ -n "$hits" ]; then
      append_sit "animate-svg-wrapper (P1)" "$hits"
    fi
  fi
  case "$file" in
    *theme.ts) ;;
    *)
      if hits=$(/usr/bin/grep -HnE '#[0-9a-fA-F]{6}' "$file" 2>/dev/null | head -2); [ -n "$hits" ]; then
        append_sit "raw-hex (P2)" "$hits"
      fi
      ;;
  esac
  if hits=$(/usr/bin/grep -HnE '@(gmail|naver|kakao|daum|hanmail|yahoo|samsung)\.(com|co\.kr|net)' "$file" 2>/dev/null | head -2); [ -n "$hits" ]; then
    append_sit "mockup-pii (P1)" "$hits"
  fi
done <<< "$changed"

[ -n "$sit" ] && add_section "sit-recurring-checks" "$sit"

if [ -n "$problems" ]; then
  echo "Pre-PR check failed. Fix these issues before opening a PR:" >&2
  printf '%s\n' "$problems" >&2
  exit 2
fi

exit 0
