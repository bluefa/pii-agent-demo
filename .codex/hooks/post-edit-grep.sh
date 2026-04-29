#!/usr/bin/env bash
# PostToolUse hook for file edits: enforce repository hard rules and report recurring risks.
set -uo pipefail

input="$(cat)"

extract_files() {
  INPUT_JSON="$input" /usr/bin/node <<'NODE'
const data = process.env.INPUT_JSON || "";
let parsed;

try {
  parsed = JSON.parse(data);
} catch {
  process.exit(0);
}

const toolInput = parsed.tool_input || {};
const files = new Set();

for (const key of ["file_path", "path"]) {
  if (typeof toolInput[key] === "string" && toolInput[key].length > 0) {
    files.add(toolInput[key]);
  }
}

if (Array.isArray(toolInput.paths)) {
  for (const path of toolInput.paths) {
    if (typeof path === "string" && path.length > 0) {
      files.add(path);
    }
  }
}

const command = typeof toolInput.command === "string" ? toolInput.command : "";
for (const line of command.split(/\r?\n/)) {
  const fileMatch = line.match(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/);
  const moveMatch = line.match(/^\*\*\* Move to: (.+)$/);
  const path = fileMatch ? fileMatch[1] : moveMatch ? moveMatch[1] : "";
  if (path.length > 0) {
    files.add(path);
  }
}

process.stdout.write([...files].join("\n"));
NODE
}

files="$(extract_files)"
[ -n "$files" ] || exit 0

blockers=""
warnings=""

append_blocker() {
  blockers+=$'\n['"$1"$']\n'"$2"
}

append_warning() {
  warnings+=$'\n['"$1"$']\n'"$2"
}

while IFS= read -r file; do
  [ -n "$file" ] && [ -f "$file" ] || continue

  case "$file" in
    *.ts|*.tsx)
      if hits=$(/usr/bin/grep -nE ':\s*any\b|<any>|<[^>]*\b,\s*any[\s,>]|as\s+any\b|any\[\]|=\s*any\b' "$file" 2>/dev/null | head -3); [ -n "$hits" ]; then
        append_blocker "BLOCK CRITICAL #2 any type forbidden" "$file"$'\n'"$hits"
      fi
      if hits=$(/usr/bin/grep -nE "(from|import)\s+['\"](\.\.?/)|import\(['\"](\.\.?/)" "$file" 2>/dev/null | head -3); [ -n "$hits" ]; then
        append_blocker "BLOCK CRITICAL #3 relative import forbidden" "$file"$'\n'"$hits"
      fi
      ;;
  esac

  case "$file" in
    *.tsx)
      if hits=$(/usr/bin/grep -nE '(text|bg|border|ring|divide|from|to|via|shadow)-(red|blue|green|yellow|gray|slate|zinc|neutral|stone|orange|amber|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)-[0-9]+' "$file" 2>/dev/null | head -3); [ -n "$hits" ]; then
        append_blocker "BLOCK CRITICAL #4 raw Tailwind color forbidden" "$file"$'\n'"$hits"
      fi
      if hits=$(/usr/bin/grep -nE '`(hover|focus|active|sm|md|lg|xl):\$\{' "$file" 2>/dev/null | head -3); [ -n "$hits" ]; then
        append_blocker "BLOCK dynamic Tailwind class" "$file"$'\n'"$hits"
      fi
      case "$file" in
        *__tests__*|*.test.tsx|*.spec.tsx) ;;
        *)
          if hits=$(/usr/bin/grep -nE '(^|[^.A-Za-z0-9_])(window\.)?alert\(' "$file" 2>/dev/null | head -3); [ -n "$hits" ]; then
            append_blocker "BLOCK F1 native alert forbidden" "$file"$'\n'"$hits"
          fi
          ;;
      esac
      ;;
  esac

  case "$file" in
    */route.ts)
      if hits=$(/usr/bin/grep -nE 'await\s+[A-Za-z_$][A-Za-z0-9_$]*\.json\s*\(\s*\)' "$file" 2>/dev/null | head -3); [ -n "$hits" ]; then
        append_blocker "BLOCK Contract-First/ADR-011 route JSON parsing forbidden" "$file"$'\n'"$hits"
      fi
      ;;
  esac

  case "$file" in
    *resolve*|*mock-store*|*/app/integration/api/*/route.ts)
      if /usr/bin/grep -qE '(getStore|mockProjects|getProjectBy|getS3UploadStatus)' "$file" 2>/dev/null \
        && ! /usr/bin/grep -qE '(IS_MOCK|USE_MOCK_DATA)' "$file" 2>/dev/null; then
        append_warning "Regression PR #328 mock helper without IS_MOCK guard" "$file"
      fi
      ;;
  esac

  case "$file" in
    *.ts|*.tsx)
      if /usr/bin/grep -qE 'useApiMutation|useApiAction' "$file" 2>/dev/null; then
        if /usr/bin/grep -A4 'onSuccess[:]\?\s*[:=({]' "$file" 2>/dev/null \
          | /usr/bin/grep -E '\b(refresh|refetch|startPolling|mutate)\(' >/dev/null 2>&1; then
          append_warning "PR #296 useApiMutation onSuccess is fire-and-forget" "$file"
        fi
      fi
      if hits=$(/usr/bin/grep -nE 'preserves? (original|pre-existing) behavior|preserve the bug' "$file" 2>/dev/null | head -3); [ -n "$hits" ]; then
        append_warning "PR #311 history/rationalization comment" "$file"$'\n'"$hits"
      fi
      if hits=$(/usr/bin/grep -nE '//.*\b(this fix|this refactor|was flagged|removed for|PR #[0-9]+)' "$file" 2>/dev/null | head -3); [ -n "$hits" ]; then
        append_warning "G9 history-narrating comment" "$file"$'\n'"$hits"
      fi
      ;;
  esac

  case "$file" in
    *.tsx)
      case "$file" in
        */app/*|*/components/*)
          if hits=$(/usr/bin/grep -nE '^\s*<svg' "$file" 2>/dev/null | head -3); [ -n "$hits" ]; then
            append_warning "H1 inline svg in feature component" "$file"$'\n'"$hits"
          fi
          ;;
      esac
      ;;
  esac

  case "$file" in
    *.ts|*.tsx|*.js|*.jsx|*.html)
      if hits=$(/usr/bin/grep -nE '@samsung\.com|cyongj2\.park|cyongj2' "$file" 2>/dev/null | head -3); [ -n "$hits" ]; then
        append_warning "sit-checks#6 real Samsung PII placeholder" "$file"$'\n'"$hits"
      fi
      ;;
  esac
done <<< "$files"

if [ -n "$blockers" ]; then
  echo "BLOCKED: AGENTS.md hard-rule violation. Fix before continuing." >&2
  echo "$blockers" >&2
  if [ -n "$warnings" ]; then
    printf '\nAdditional warnings:\n%s\n' "$warnings" >&2
  fi
  exit 2
fi

if [ -n "$warnings" ]; then
  echo "$warnings" >&2
fi

exit 0
