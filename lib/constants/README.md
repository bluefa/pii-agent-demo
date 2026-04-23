# `lib/constants/`

Cross-cutting 상수 레지스트리. 2+ 사이트에서 동일 값이 사용될 때만 등록한다.

## 파일 구성

| 파일 | 용도 | 비고 |
|------|------|------|
| `timings.ts` | `setTimeout`/`setInterval` 지연값 | `TIMINGS` as const |
| `messages.ts` | 중복되는 한국어 에러 메시지 | `ERROR_MESSAGES` as const |
| 도메인별 (`azure.ts`, `gcp.ts`, `idc.ts`, `sdu.ts`, `scan.ts`, `history.ts`, `labels.ts`, `process-guides.ts`, `provider-mapping.ts`, `vm-database.ts`, `db-types.ts`) | 도메인 범위 상수 | 기존 파일 |

## 규칙

1. **2+ 사용처 조건**: 단일 사용 값은 호출부 파일에 local로 둔다.
2. **발명 금지**: 실제 코드에 존재하지 않는 값을 추가하지 않는다.
3. **타입 상수는 `lib/types/*.ts`에서 재사용**: status literal union은 `lib/types/*.ts`의 기존 타입(`V1ScriptStatus`, `ApprovalStatusType`, `ScanAppStatus`, `SduConnectionTestStatus` 등)을 그대로 사용한다. `lib/constants/`에 재정의하지 않는다.
4. **추가 절차**: `as const` 객체에 키 추가 → `npx tsc --noEmit`으로 좁혀진 타입 전파 확인.

## 관련 문서

- 코드 원칙: `.claude/skills/anti-patterns/SKILL.md` §G (Naming & Constants)
- audit 근거: `docs/reports/frontend-anti-patterns-audit-2026-04-23.md` §G

## 이 PR에서 제외된 항목

스펙(`docs/reports/sit-migration-prompts/wave11-A1.md`)이 제안한 값 중 현재 main에서 실제 2+ 중복이 사라진 항목:

- `CREDENTIAL_PREVIEW_COUNT`, `COLLAPSE_THRESHOLD` — 참조 파일이 Wave 9/10에서 모두 제거됨
- `TOAST_HIDE_MS`, `COPY_FEEDBACK_MS`, `SHAKE_ANIMATION_MS`, `SCAN_POLL_INTERVAL_MS`, `TEST_CONNECTION_POLL_MS` — 현재 단일 사용 또는 미사용
- `PORT_MAX` — 이미 `vm-database.ts:validatePort`에 캡슐화됨
- `statuses.ts` 4종 union — `lib/types/*.ts`에 기존 존재
- `ERROR_MESSAGES` 중 `GCP_STATUS_REFRESH_FAILED`, `IDC_INSTALLATION_STATUS_FETCH_FAILED` — 현재 단일 사용
