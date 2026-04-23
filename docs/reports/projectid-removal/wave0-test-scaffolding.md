# Wave 0 — Behavior Lock-in Tests (W2 선행)

## Context
Project: pii-agent-demo (Next.js 14, TS, Tailwind, Korean UI, vitest).
projectId 폐기 프로젝트의 **리팩토링 안전망 선행 wave**. W2 (mock store pivot) 가 9개 mock 파일 + 59개 BFF route 를 대규모 변경하므로, **리팩토링 전/후 동일 behavior** 임을 보장할 테스트 커버리지를 먼저 확보한다.

**목표**: W2 에서 내부 구현이 바뀌어도 **public API 의 input/output 이 동일**함을 증명. 테스트가 먼저 있어야 "logic 불변" 이라 말할 수 있다.

**방법**: 생산 코드 변경 없음. `projectId` 기반 현 API 에 대한 assertion 만 추가. W2 에서 이 테스트들이 새 시그니처(`targetSourceId: number`) 로 fixture 만 수정되고 **assertion 은 동일하게 통과**해야 success.

## 전제

- `/Users/study/pii-agent-demo/lib/mock-sdu.ts` — projectId 65건, 테스트 없음 (🔴 최대 리스크)
- `/Users/study/pii-agent-demo/lib/mock-gcp.ts` — projectId 10건, 테스트 없음
- `/Users/study/pii-agent-demo/lib/mock-test-connection.ts` — projectId 11건, 테스트 없음

기존 테스트로 커버되는 것: `mock-idc`, `mock-azure`, `mock-history`, `mock-scan`, `mock-installation`, `mock-target-source`, `app/api/_lib/target-source`, `bff-client`.

## Precondition
```bash
cd /Users/study/pii-agent-demo
git fetch origin main

# 대상 mock 파일 + 기존 테스트 부재 확인
for m in mock-sdu mock-gcp mock-test-connection; do
  [ -f "lib/${m}.ts" ] || { echo "✗ lib/${m}.ts missing"; exit 1; }
  [ -f "lib/__tests__/${m}.test.ts" ] && { echo "⚠ lib/__tests__/${m}.test.ts already exists — wave0 skip 가능"; } || echo "✓ ${m} 테스트 선행 작성 대상"
done

# 기존 vitest 설정 확인
[ -f vitest.config.ts ] || [ -f vitest.config.mts ] || { echo "✗ vitest config missing"; exit 1; }

# 기존 mock-idc.test.ts 를 레퍼런스 패턴으로 사용
[ -f lib/__tests__/mock-idc.test.ts ] || { echo "✗ reference test missing"; exit 1; }
```

**병렬 안전**: W1 (routing rename) 과 파일 완전 분리 → 동시 실행 가능.
**Blocks**: W2 — Wave 0 merge 후 W2 진행.

## Step 1: Worktree
```bash
bash scripts/create-worktree.sh --topic projid-w0-tests --prefix test
cd /Users/study/pii-agent-demo-projid-w0-tests
```

## Step 2: Required reading
1. `docs/reports/projectid-removal/00-README.md` — Testing Strategy 섹션
2. `docs/reports/projectid-removal/inventory.md` §6, §9
3. `lib/__tests__/mock-idc.test.ts` (레퍼런스 패턴)
4. `lib/__tests__/mock-azure.test.ts` (레퍼런스 패턴)
5. `lib/mock-sdu.ts` — 대상 1 (65건, 최우선)
6. `lib/mock-gcp.ts` — 대상 2
7. `lib/mock-test-connection.ts` — 대상 3
8. `lib/mock-store.ts` — store initialization / reset 방법

## Step 3: Implementation

**원칙**: 각 테스트는 "Given / When / Then" 구조로, **public 함수의 input/output만 검증**. 내부 구현 (store key type, 함수 시그니처) 을 assertion 하지 않는다 — 그래야 W2 리팩토링에서 깨지지 않음.

### 3-1. `lib/__tests__/mock-sdu.test.ts` 신규 (최우선, 가장 큼)

대상 public 함수 (lib/mock-sdu.ts 에서 export 되는 것):
- `getSduInstallationStatus(projectId)` → `{ data?, error? }`
- `checkSduInstallation(projectId)` → `{ data?, error? }`
- `getSduS3Upload(projectId)` → `{ data?, error? }`
- `confirmSduS3Upload(projectId)`
- `getSduIamUser(projectId)`
- `issueSduIamUserAkSk(projectId, { issuedBy })`
- `getSduSourceIp(projectId)`
- `confirmSduSourceIp(projectId, { cidr })`
- `registerSduSourceIp(projectId, { cidr })`
- `getSduAthenaTables(projectId)`
- `getSduConnectionTest(projectId)`
- `executeSduConnectionTest(projectId)`

각 함수에 대해 최소 3개 assertion:
1. **Happy path** — 존재하는 SDU project id 로 호출 → 응답에 기대 필드 있음
2. **Negative** — 존재하지 않는 id → `error` 반환 (현재는 어떤 에러가 나오는지 실측 후 기록)
3. **Idempotency** — 같은 입력 두번 호출 → 같은 데이터 (store caching 존재 시 검증)

**예시**:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSduInstallationStatus,
  checkSduInstallation,
  getSduS3Upload,
  // ...
} from '@/lib/mock-sdu';
import { resetStore, getStore } from '@/lib/mock-store';

describe('mock-sdu behavior (lock-in)', () => {
  beforeEach(() => resetStore());

  describe('getSduInstallationStatus', () => {
    it('존재하는 SDU project id → data 반환', () => {
      const sduProjects = getStore().projects.filter(p => p.cloudProvider === 'SDU');
      expect(sduProjects.length).toBeGreaterThan(0);
      const projectId = sduProjects[0].id;

      const result = getSduInstallationStatus(projectId);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.provider).toBe('SDU');
    });

    it('존재하지 않는 project id → error', () => {
      const result = getSduInstallationStatus('nonexistent');
      expect(result.data).toBeUndefined();
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('비-SDU project → NOT_SDU_PROJECT 에러', () => {
      const nonSdu = getStore().projects.find(p => p.cloudProvider !== 'SDU');
      const result = getSduInstallationStatus(nonSdu!.id);
      expect(result.error?.code).toBe('NOT_SDU_PROJECT');
    });

    it('캐시: 두번째 호출도 같은 결과', () => {
      const projectId = getStore().projects.find(p => p.cloudProvider === 'SDU')!.id;
      const r1 = getSduInstallationStatus(projectId);
      const r2 = getSduInstallationStatus(projectId);
      expect(r2.data).toEqual(r1.data);
    });
  });

  // ... 나머지 11개 함수도 같은 패턴
});
```

**분량 목표**: 12 함수 × 3-4 assertion ≈ 40-50 테스트, ~400 LOC.

### 3-2. `lib/__tests__/mock-gcp.test.ts` 신규

대상 함수:
- `getGcpInstallationStatus(projectId)`
- `checkGcpInstallation(projectId)`
- `getGcpScanServiceAccount(projectId)`
- `getGcpTerraformServiceAccount(projectId)`

같은 패턴, 각 3-4 assertion → ~15 테스트, ~150 LOC.

### 3-3. `lib/__tests__/mock-test-connection.test.ts` 신규

대상 함수 (`lib/mock-test-connection.ts` 에서 export):
- `executeTestConnection(projectId)`
- `getTestConnectionResults(projectId, page, size)`
- `getTestConnectionLatest(projectId)`
- 기타

→ ~10-15 테스트, ~120 LOC.

### 3-4. 에지 케이스 검증 체크리스트

각 테스트 파일 작성 시 확인:
- [ ] store caching: 같은 입력 반복 호출 시 같은 객체 반환되는지 (reference equality vs value equality 구분)
- [ ] 상태 변경 함수 (check*, confirm*, register*): idempotent 한지 or side-effect 있는지
- [ ] 에러 코드: NOT_FOUND / NOT_X_PROJECT / INVALID_INPUT 등 실제 반환값 확인 후 기록
- [ ] 날짜/시간 필드 (lastCheckedAt 등): `expect.any(String)` 으로 느슨하게 assert (time-dependent)
- [ ] UUID/id 생성: 호출마다 다른 값이면 `expect.any(String)` 로

### 3-5. ⚠ 주의 — Behavior 를 "잠그는" 것이지 "바꾸는" 것이 아님

테스트 작성 중 production 코드의 버그를 발견해도 **이 wave 에서 수정하지 않는다**. 발견한 버그는 PR description 의 "Known quirks" 섹션에 기록 → 별도 follow-up. W2 가 그 버그를 그대로 유지해야 behavior 보존 증명이 가능.

예: `mock-sdu.ts` 의 `generateDefaultSourceIps` 가 특정 input 에서 빈 배열을 반환하는 게 의도인지 버그인지 애매하면, 현재 동작을 그대로 기록:
```ts
it('특정 project 에는 default source IP 가 없음 (현행 동작 기록)', () => {
  const result = getSduSourceIp('some-known-case');
  expect(result.data?.ips).toEqual([]);
});
```

## Step 4: Do NOT touch

- **Production 코드** (`lib/mock-*.ts`, `app/**`) — 한 줄도 수정 금지. 순수 테스트 추가 wave.
- 기존 테스트 파일 (`lib/__tests__/mock-idc.test.ts` 등) — 변경 금지
- 타입 정의 (`lib/types.ts`) — 변경 금지
- `lib/mock-store.ts` — store 구조 변경 금지. 조회/reset 유틸만 사용.

## Step 5: Verify

```bash
# 신규 테스트만 실행 (나머지에 영향 없는지 확인)
npm test -- lib/__tests__/mock-sdu.test.ts
npm test -- lib/__tests__/mock-gcp.test.ts
npm test -- lib/__tests__/mock-test-connection.test.ts

# 전체 테스트 통과 확인 (regression 없는지)
npm test

# 타입 체크
npx tsc --noEmit

# Lint
npm run lint -- lib/__tests__/
```

**모든 신규 테스트가 GREEN** 이어야 한다. RED 가 있으면 production 실제 동작과 assertion 이 다른 것 — assertion 을 실제 동작에 맞게 수정 (production 을 바꾸지 않는다, §3-5 참고).

## Step 5.5: Coverage 확인

```bash
# 가능하면 coverage 수치 확인 (vitest built-in)
npx vitest run --coverage lib/mock-sdu.ts lib/mock-gcp.ts lib/mock-test-connection.ts 2>&1 | tail -20
```

기대: 각 파일의 line coverage ≥ 70%. (100% 는 과함 — 내부 helper / date 로직은 covered 아니어도 OK).

## Step 6: Commit + push + PR

```bash
git add lib/__tests__/mock-sdu.test.ts \
        lib/__tests__/mock-gcp.test.ts \
        lib/__tests__/mock-test-connection.test.ts
git commit -m "test(mock): behavior lock-in for sdu/gcp/test-connection (projid-w0)

W2 (projectId → targetSourceId mock pivot) 의 리팩토링 안전망.
현 public API 의 input/output 을 lock-in — 내부 구현이 바뀌어도
assertion 동일하게 통과해야 behavior 보존 증명 성립.

신규:
- lib/__tests__/mock-sdu.test.ts (~50 테스트, 12 함수)
- lib/__tests__/mock-gcp.test.ts (~15 테스트, 4 함수)
- lib/__tests__/mock-test-connection.test.ts (~12 테스트)

Production 코드 변경 0. 발견한 quirk 는 PR description 에 기록."

# ⛔ CLAUDE.md rule: push/PR 전 rebase 필수
git fetch origin main
git rebase origin/main

git push -u origin test/projid-w0-tests
```

PR body:
```markdown
## Summary
W2 (mock pivot) 의 리팩토링 안전망. `mock-sdu`/`mock-gcp`/`mock-test-connection` 에 대한 behavior lock-in 테스트 추가. **production 코드 변경 0**.

## Why
- 현 기존 테스트가 커버하지 않는 3개 mock 파일 (sdu 65건 / gcp 10건 / test-connection 11건 projectId 참조)
- W2 가 store key type, 함수 signature 를 대규모 변경 — 테스트 없으면 behavior drift 감지 불가
- "리팩토링으로 로직 변경 없음" 주장의 **증명 수단**

## Changes
- `lib/__tests__/mock-sdu.test.ts` (신규, ~50 테스트)
- `lib/__tests__/mock-gcp.test.ts` (신규, ~15 테스트)
- `lib/__tests__/mock-test-connection.test.ts` (신규, ~12 테스트)

## Known quirks (현행 동작 기록, 수정은 별도 follow-up)
- <작성자가 테스트 작성 중 발견한 것 나열>

## Test plan
- [x] `npm test -- lib/__tests__/mock-sdu.test.ts`
- [x] `npm test -- lib/__tests__/mock-gcp.test.ts`
- [x] `npm test -- lib/__tests__/mock-test-connection.test.ts`
- [x] `npm test` (전체 regression 없음)
- [x] `npx tsc --noEmit`
- [x] Coverage ≥ 70% for the 3 target mock files

## Next
- W2 (projid-w2-mock-pivot) 는 이 PR merge 후 진행
- W2 에서 3개 테스트 파일의 fixture (projectId string → targetSourceId number) 만 수정 예정 — assertion 은 그대로 통과해야 성공
```

## ⛔ Do NOT auto-merge
PR URL 보고 후 stop.

## Return (under 200 words)
1. PR URL
2. 신규 테스트 수 (총합 + 파일별)
3. `npm test` 전체 결과 (pass/fail 수, 신규 테스트 포함)
4. Coverage 수치 (3 mock 파일 line coverage)
5. 발견된 "Known quirks" 목록 (있으면)
6. Spec 편차 및 사유

## Parallel coordination
- **병렬 가능**: `projid-w1-route-segment` — 파일 완전 분리
- **Blocks**: `projid-w2-mock-pivot` — W0 merge 필요
