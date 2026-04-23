# G6. Hardcoded error messages

Severity: 🟢 nice-to-have

Strings like "조회에 실패했습니다" duplicated across files → i18n and typo-fix cost explodes.

→ centralize in `lib/constants/messages.ts`.
