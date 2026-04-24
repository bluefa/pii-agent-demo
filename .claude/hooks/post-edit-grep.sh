#!/usr/bin/env bash
# PostToolUse hook for Edit|Write: fast grep-based checks on the edited file only.
# Emits warnings to stderr (exit 0) so Claude sees feedback but the edit is not blocked.
set -uo pipefail

input="$(cat)"
file="$(echo "$input" | /usr/bin/jq -r '.tool_input.file_path // empty')"

[ -z "$file" ] && exit 0
[ ! -f "$file" ] && exit 0

warnings=""

# TypeScript checks (.ts and .tsx)
case "$file" in
  *.ts|*.tsx)
    # CLAUDE.md CRITICAL #2: no `any` type
    if /usr/bin/grep -nE ':\s*any\b|<any>|as any|any\[\]' "$file" >/dev/null 2>&1; then
      hits="$(/usr/bin/grep -nE ':\s*any\b|<any>|as any|any\[\]' "$file" | head -3)"
      warnings+=$'\n[CRITICAL #2] any 타입 금지:\n'"$hits"
    fi

    # CLAUDE.md CRITICAL #3: no relative imports
    if /usr/bin/grep -nE "from '(\.\.?/)" "$file" >/dev/null 2>&1; then
      hits="$(/usr/bin/grep -nE "from '(\.\.?/)" "$file" | head -3)"
      warnings+=$'\n[CRITICAL #3] 상대 경로 import 금지 (@/ 절대 경로 사용):\n'"$hits"
    fi
    ;;
esac

# TSX-only: raw Tailwind color classes (CLAUDE.md CRITICAL #4)
case "$file" in
  *.tsx)
    if /usr/bin/grep -nE '(text|bg|border|ring|divide|from|to|via|shadow)-(red|blue|green|yellow|gray|slate|zinc|neutral|stone|orange|amber|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)-[0-9]+' "$file" >/dev/null 2>&1; then
      hits="$(/usr/bin/grep -nE '(text|bg|border|ring|divide|from|to|via|shadow)-(red|blue|green|yellow|gray|slate|zinc|neutral|stone|orange|amber|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)-[0-9]+' "$file" | head -3)"
      warnings+=$'\n[CRITICAL #4] raw Tailwind 색상 클래스 금지 (lib/theme.ts 토큰 사용):\n'"$hits"
    fi
    ;;
esac

# Regression pattern: BFF resolver/mock-store helpers require IS_MOCK guard (PR #328 P1)
case "$file" in
  *resolve*|*mock-store*|*/app/integration/api/*/route.ts)
    if /usr/bin/grep -qE '(getStore|mockProjects|getProjectBy|getS3UploadStatus)' "$file" \
       && ! /usr/bin/grep -qE '(IS_MOCK|USE_MOCK_DATA)' "$file"; then
      warnings+=$'\n[Regression PR #328] mock helper 호출 — IS_MOCK 가드 없음. BFF 모드에 mock 누설 가능.'
    fi
    ;;
esac

# useApiMutation onSuccess fire-and-forget pattern (PR #296)
if /usr/bin/grep -qE 'useApiMutation|useApiAction' "$file" 2>/dev/null; then
  if /usr/bin/grep -A4 'onSuccess[:]\?\s*[:=({]' "$file" 2>/dev/null \
     | /usr/bin/grep -E '\b(refresh|refetch|startPolling|mutate)\(' >/dev/null 2>&1; then
    warnings+=$'\n[PR #296] useApiMutation onSuccess 는 fire-and-forget — 후속 비동기는 action 본문에서 await.'
  fi
fi

if [ -n "$warnings" ]; then
  echo "⚠️  $file" >&2
  echo "$warnings" >&2
fi

exit 0
