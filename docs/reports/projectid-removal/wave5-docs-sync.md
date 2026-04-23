# Wave 5 — Docs / Swagger 동기화

## Context
Project: pii-agent-demo (Next.js 14, TS, Tailwind, Korean UI).
projectId 폐기 프로젝트의 **문서 동기화 wave**. W1-W4의 코드 이관 완료 후, `docs/api/`, `docs/swagger/`, 기타 active 문서의 레거시 projectId 표기를 targetSourceId로 정리.

**원칙**:
- **ADR (`docs/adr/**`) 및 과거 리포트 (`docs/reports/**`)는 역사 기록 — 수정 금지**
- `auto-memory` (/Users/study/.claude/projects/...) — touch 금지
- **GCP native `projectId` (Cloud Project ID)** — 보존
- 수정 대상은 "현재 시스템 사양"을 정의하는 **active docs** (API spec, Swagger, detail-page ref)

## Precondition
```bash
cd /Users/study/pii-agent-demo
git fetch origin main

# 앞선 모든 wave merge 확인
for wave in projid-w1 projid-w2 projid-w3 projid-w4; do
  git log origin/main --oneline | grep -q "$wave" || { echo "✗ $wave 먼저 merge"; exit 1; }
done

# 대상 문서 파일 존재
[ -d docs/api ] && [ -d docs/swagger ] || { echo "✗ docs 폴더 누락"; exit 1; }

# 현 projectId 참조 수 (비 GCP-native, 비 ADR/reports)
count=$(grep -rln "projectId" docs/ | grep -v "docs/adr/\|docs/reports/\|docs/swagger/confirm.yaml" | wc -l)
echo "projectId 참조 active doc: $count 파일"
```

**Depends on**: W1-W4 모두 merge.
**Batch**: 단독 진행 (최종 wave).

## Step 1: Worktree
```bash
bash scripts/create-worktree.sh --topic projid-w5-docs --prefix docs
cd /Users/study/pii-agent-demo-projid-w5-docs
```

## Step 2: Required reading
1. `docs/reports/projectid-removal/00-README.md`
2. `docs/reports/projectid-removal/inventory.md` §10, §12
3. `docs/swagger/user.yaml` L15-58 — **이미 "migrated" 마킹된 패턴 — 모범 사례**
4. `docs/swagger/confirm.yaml` L697 — **GCP native projectId 보존 예시**
5. `docs/api/boundaries.md` — 현 API 경계 문서
6. `docs/detail-page.md` (있다면) — 라우트 정의
7. `docs/swagger/README.md`, `MIGRATION_PLAN.md` — swagger 정책

## Step 3: Implementation

### 3-1. 스캔: 수정 대상 도출

```bash
# 수정 대상 후보 (ADR/reports 제외)
grep -rln "projectId\|\[projectId\]\|/projects/" docs/ \
  | grep -v "docs/adr/\|docs/reports/"

# 각 파일별 등장 횟수
for f in $(grep -rln "projectId" docs/ | grep -v "docs/adr/\|docs/reports/\|docs/swagger/confirm.yaml"); do
  echo "$(grep -c "projectId" "$f") $f"
done | sort -rn
```

예상 대상:
- `docs/detail-page.md` — 라우트/URL 레퍼런스
- `docs/api/core.md`, `docs/api/scan.md`, `docs/api/boundaries.md`
- `docs/api/providers/aws.md`, `azure.md`, `gcp.md`, `idc.md`, `sdu.md`
- `docs/swagger/user.yaml` (이미 migrated 마킹됨 — 최종 정리만)
- 기타 active md

### 3-2. `docs/swagger/user.yaml` — Legacy Replacement Map 확정

현재:
```yaml
Legacy API Replacement Map:
  - GET /api/projects/{projectId} -> GET /install/v1/target-sources/{targetSourceId}
  - status: "migrated"
```

이미 잘 마킹됨. **code 이관 완료 상태**와 일치함을 검증 후 필요시 타임스탬프/커밋 해시 추가:

```yaml
# 상단 comment 추가
# Last reviewed: 2026-04-24 (projid-removal W1-W4 merge 완료)
# projectId legacy concept 은 전면 폐기됨 — 본 map은 historical reference
```

실제 rewrite는 **최소한으로**.

### 3-3. `docs/swagger/confirm.yaml` L697 — GCP native 주석 강화

```yaml
GcpMetadata:
  # ...
  properties:
    projectId:
      type: string
      description: |
        GCP Cloud Project ID (외부 식별자).
        내부 legacy 'projectId' 개념과 다름 — 혼동 금지.
```

### 3-4. 기타 Swagger 파일 (aws/azure/gcp/idc/sdu/scan 등)

각 파일에서 `/projects/{projectId}` 경로 패턴 확인:

```bash
grep -l "/projects/{projectId}" docs/swagger/*.yaml
```

결과 있으면 **내용 판단**:
- 코드가 `/target-sources/{targetSourceId}` 로 이미 호출하고 있으면 → swagger 경로를 동일하게 교체
- Legacy upstream path가 아직 살아있다면 → `deprecated: true` 마킹 + `x-replaced-by` 주석 추가 (user.yaml 패턴)

**방침 결정이 필요하면 PR description에 명시하고 보수적으로 `deprecated` 마킹만.**

### 3-5. `docs/api/` markdown — 경로 정리

각 파일에서 `/api/projects/{projectId}` 같은 URL 리터럴을 검토:

- **실제 현재 라우트**가 `/integration/api/v1/target-sources/{targetSourceId}` 형태임을 확인 (W2 완료 상태)
- 문서 경로를 현재 구현에 맞게 업데이트
- 또는 "legacy / deprecated" 섹션으로 분리

예시 (`docs/api/core.md`):

Before:
```markdown
## 프로젝트 조회
`GET /api/projects/{projectId}`
- projectId: 프로젝트 식별자
```

After:
```markdown
## 타겟 소스 조회
`GET /integration/api/v1/target-sources/{targetSourceId}`
- targetSourceId: 타겟 소스 식별자 (number, serialized as string in URL)
```

**일괄 치환은 위험** — 각 파일 내용 확인 후 수동 편집 권장.

### 3-6. `docs/api/providers/*.md` — provider별 endpoint 문서

비슷한 요령. 특히 `gcp.md`에서 GCP native `projectId` (GCP Project 자체)를 언급하는 곳은 "GCP Cloud Project ID — 내부 식별자와 다름" 명시.

### 3-7. `docs/detail-page.md` (존재 시)

현재 라우트 `/integration/projects/[targetSourceId]` 반영:

```bash
[ -f docs/detail-page.md ] && grep -n "projectId\|\[projectId\]" docs/detail-page.md
```

수정 포인트:
- L8 (라우트): `/projects/[projectId]` → `/integration/projects/[targetSourceId]`
- L10 (폴더): `app/projects/[projectId]/page.tsx` → `app/integration/projects/[targetSourceId]/page.tsx`
- API 경로 섹션들

### 3-8. `docs/api/boundaries.md`

- CSR → BFF proxy 경계 설명에서 `/projects/[projectId]` 같은 레퍼런스 확인 & 업데이트
- 타겟 소스 도메인 표기 일관성

### 3-9. `CLAUDE.md`, `AGENTS.md` 확인

```bash
grep -n "projectId" CLAUDE.md AGENTS.md
```

결과 있으면 반영 (일반적으로 없을 것).

### 3-10. 잔여 검증

```bash
# ADR/reports 제외, 모든 docs의 projectId 참조
grep -rn "projectId" docs/ \
  | grep -v "docs/adr/\|docs/reports/" \
  | grep -v "GCP\|Cloud Project\|confirm.yaml" \
  | head -30

# 기대: 0건 또는 명시적으로 "legacy / historical" 컨텍스트만 남음
```

### 3-11. `docs/reports/projectid-removal/00-README.md` 상태 업데이트

이 wave PR에서 README에 completion 현황 섹션 추가:

```markdown
## Status (2026-MM-DD)

| Wave | Status | PR |
|---|---|---|
| W1 — route segment | ✅ merged | #xxx |
| W2 — mock pivot | ✅ merged | #xxx |
| W3 — component relocate | ✅ merged | #xxx |
| W4 — api contract rename | ✅ merged | #xxx |
| W5 — docs sync | 🟢 (current) | — |
```

## Step 4: Do NOT touch

- **`docs/adr/**`** — 역사 기록
- **`docs/reports/**`** (단, 본 Wave의 `projectid-removal/` 디렉토리 내 `00-README.md` status 섹션 추가는 예외) — 역사 기록
- **`memory/**`** (auto-memory) — 자동 갱신
- `.claude/skills/**` — 일반적으로 projectId 참조 없음
- **Code** — 이 wave는 문서만. 코드는 W1-W4에서 완료
- **`ConfirmResourceMetadata.projectId`** 및 Swagger GCP native `projectId` — 보존
- `docs/swagger/user.yaml` 의 "Legacy API Replacement Map" 구조 자체 — 참고용 역사

## Step 5: Verify

```bash
# 코드와 문서 정합성 확인
npx tsc --noEmit  # 문서만 수정이라 필수는 아니나 실수 방지

# 문서 내부 링크 검증 (있다면)
# 이 프로젝트에 markdown lint가 있으면 실행:
npm run lint:docs 2>/dev/null || echo "no doc lint configured"

# Swagger 유효성 (있다면 openapi validator)
# 예: npx @redocly/cli lint docs/swagger/*.yaml
```

**Manual check**:
- 수정한 각 md/yaml 파일 열어서 flow 확인
- 링크된 파일 경로가 실제 존재하는지 spot check (app/projects → app/integration/projects/[targetSourceId]/_components 이동 반영)

## Step 6: Commit + push + PR

```bash
git add docs/
git commit -m "docs: projectId legacy 표기 정리 (projid-w5)

W1-W4 코드 이관 완료 반영. active docs 의 projectId → targetSourceId,
/api/projects/{projectId} → /integration/api/v1/target-sources/{targetSourceId}.

Preserved:
- docs/adr/** (역사 기록)
- docs/reports/** 과거 세션 (projectid-removal/ 제외)
- GCP native projectId (confirm.yaml GcpMetadata)

Scope:
- docs/api/**, docs/swagger/**, docs/detail-page.md, docs/api/boundaries.md
- docs/reports/projectid-removal/00-README.md status 업데이트"

# ⛔ CLAUDE.md rule: push/PR 전 rebase 필수
git fetch origin main
git rebase origin/main

git push -u origin docs/projid-w5-docs
```

PR body:
```markdown
## Summary
W1-W4 코드 이관 완료 상태를 문서에 반영. `projectId` → `targetSourceId` 표기 통일,
URL 경로 `/api/projects/{projectId}` → `/integration/api/v1/target-sources/{targetSourceId}`.

## Why
문서가 실제 구현과 drift 상태이면 신규 개발자의 첫 1시간이 낭비됨. 코드 이관 직후 문서 동기화.

## Changes
### Active API docs
- `docs/api/core.md`, `docs/api/scan.md`, `docs/api/boundaries.md`
- `docs/api/providers/{aws,azure,gcp,idc,sdu}.md`

### Swagger
- `docs/swagger/user.yaml` — Legacy Replacement Map 리뷰 + 타임스탬프
- `docs/swagger/aws.yaml`, `azure.yaml`, `gcp.yaml`, `idc.yaml`, `sdu.yaml`, `scan.yaml` — `/projects/{projectId}` 경로 정리 (deprecated 마킹 또는 교체)
- `docs/swagger/confirm.yaml` — `GcpMetadata.projectId` 주석 강화 (GCP native 명시)

### Reference docs
- `docs/detail-page.md` — 라우트 경로 및 폴더 구조 업데이트
- `docs/reports/projectid-removal/00-README.md` — status 테이블 추가

## Preserved (intentionally untouched)
- `docs/adr/**` — 역사 기록
- `docs/reports/**` (단, `projectid-removal/` 현재 plan 디렉토리는 자체 업데이트)
- `docs/swagger/confirm.yaml` `GcpMetadata.projectId` 스키마 자체 (GCP native)
- `memory/**`, `.claude/skills/**`

## Verification
- `grep -rn "projectId" docs/ | grep -v "docs/adr/\|docs/reports/\|GCP\|Cloud Project"` → 0건 (또는 명시적 legacy 컨텍스트만)
- `grep -rn "\[projectId\]" docs/` → 0건 (route 경로)

## Ref
- Plan: `docs/reports/projectid-removal/00-README.md`
- Inventory: §10, §12
- Depends on: W1-W4 merged
```

## ⛔ Do NOT auto-merge
PR URL 보고 후 stop.

## Return (under 250 words)
1. PR URL
2. 수정된 문서 파일 수 + 파일 목록
3. Swagger 파일별 처리 방침 (replaced / deprecated 마킹 / 유지)
4. `docs/` 에서의 `projectId` 잔여 (ADR/reports 제외, GCP native 제외)
5. 보존 대상 검증 (`confirm.yaml GcpMetadata`, `user.yaml Legacy Replacement Map`)
6. Spec 편차 및 사유 (특히 일부 문서가 deprecated 유지인지 삭제인지 판단)

## Parallel coordination
- **Depends on**: W1, W2, W3, W4 모두 merge
- **Blocks**: 없음
- **Cleanup**: 이 wave merge 후 `docs/reports/projectid-removal/00-README.md` status 테이블에 최종 완료 표시
