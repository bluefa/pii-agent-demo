---
name: pr-context-review
description: PR 링크 기반 심층 리뷰 워크플로우. PR Description, 커밋 이력, 기존 리뷰 코멘트까지 확인해 최신 head 기준으로 리뷰할 때 사용.
user_invocable: true
---

# /pr-context-review - Deep PR Review

PR 링크를 받았을 때, 단순 diff 확인이 아니라 맥락까지 포함한 재현 가능한 리뷰를 수행합니다.

## 입력

- `pr`: PR 번호 또는 URL

기본값:
- `base=main`

## 목적

1. 최신 head 기준으로만 리뷰합니다.
2. PR Description과 실제 구현의 불일치를 우선 탐지합니다.
3. 이전 코멘트/수정 이력을 확인해 이미 해결된 이슈를 재지적하지 않습니다.
4. 결과는 `severity + file:line + 근거` 형태로 남깁니다.

## 필수 절차

1. PR 메타데이터와 설명을 먼저 확인합니다.

```bash
gh pr view <pr> --json title,body,baseRefName,headRefName,commits,files
gh pr view <pr> --comments
```

2. 최신 head를 로컬 ref로 동기화합니다.

```bash
git fetch origin pull/<번호>/head:refs/remotes/origin/pr-<번호>
git rev-parse origin/pr-<번호>
git log --oneline -n 10 origin/pr-<번호>
```

3. 변경 범위를 확인하고 우선순위 파일부터 점검합니다.

```bash
git diff --name-only origin/main...origin/pr-<번호>
git diff --stat origin/main...origin/pr-<번호>
```

4. 핵심 파일은 원문 기준으로 읽습니다.

```bash
git show origin/pr-<번호>:<path>
```

5. 필요 시 관련 테스트를 실행해 주장 근거를 확보합니다.

```bash
npm run test:run -- <관련 테스트 파일>
```

## 리뷰 규칙

- 최신 head에 없는 과거 이슈를 지적하지 않습니다.
- "의도된 결정" 주장은 문서/코드 근거가 있을 때만 수용합니다.
- 계약(문서) vs 런타임(코드) 불일치는 우선순위를 높게 둡니다.
- 에러 처리 변경은 아래 4개를 항상 교차 확인합니다.
  - `app/api/_lib/handler.ts`
  - `app/api/_lib/problem.ts`
  - `lib/fetch-json.ts`
  - `docs/swagger/*.yaml`, `docs/adr/*.md`

## 출력 형식

1. Findings 먼저 제시 (심각도 순서)
2. 각 finding에 다음 포함
   - `severity` (`P1`/`P2`/`P3`)
   - `file:line`
   - 실제 영향
   - 왜 지금 발생하는지
3. No finding이면 명확히 선언
   - `Blocking findings 없음`
   - 남은 리스크(있으면)

## 금지 사항

- PR Description을 읽지 않고 코드만 보고 결론 내리지 않습니다.
- 최신 커밋 확인 없이 이전 코멘트를 재사용하지 않습니다.
- 재현/근거 없는 추측성 이슈를 추가하지 않습니다.
