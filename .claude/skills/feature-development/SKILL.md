---
name: feature-development
description: 새 기능 개발 시 따르는 워크플로우. 기능 구현, API 개발, 컴포넌트 추가 요청 시 사용.
---

# 기능 개발 워크플로우

새 기능을 구현할 때 반드시 따르는 프로세스입니다.

## 1. 구현 전 체크

### 1.1 요구사항 확인
- [ ] BFF API 명세 확인 (`docs/api/`)
- [ ] 기존 코드 패턴 파악 (유사 기능 참고)
- [ ] 영향 범위 파악 (타입, 컴포넌트, API)

### 1.2 ADR 필요 여부 판단

**ADR 작성이 필요한 경우:**
- 기존 데이터 모델 변경
- 새로운 아키텍처 패턴 도입
- 여러 선택지 중 하나를 결정

**ADR 불필요한 경우:**
- 단순 CRUD 구현
- 명세대로 구현
- 버그 수정

## 2. 구현 순서

```
1. lib/types/*.ts      - 타입 정의
2. lib/constants/*.ts  - 상수 정의
3. lib/mock-*.ts       - Mock 헬퍼 (개발용)
4. app/api/**          - API Routes
5. lib/__tests__/*.ts  - 유닛 테스트
6. app/components/**   - UI 컴포넌트
7. app/**              - 페이지 통합
```

## 3. 코드 규칙 체크

구현 중 반드시 확인:
- `CLAUDE.md` 코딩 규칙 준수
- 기존 패턴과 일관성 유지
- 타입 안전성 확보 (any 금지)
- 절대 경로(@/) 사용
- 커스텀 훅 활용 (useModal, useApiMutation)

## 4. 구현 후 검증

```bash
# 유닛 테스트 실행
npm run test

# 타입 체크
npm run type-check

# (선택) 빌드 확인
npm run build
```

## 5. 문서화 (PR Merge 이전 필수)

**문서화 체크리스트 (PR 생성 전 확인):**
- [ ] 새 API 추가 → `docs/api-routes/README.md` 업데이트
- [ ] 새 컴포넌트/훅 추가 → 필요시 관련 문서 업데이트
- [ ] 설계 결정 → `docs/adr/*.md` 작성
- [ ] BFF 명세 변경 → `docs/api/providers/*.md` 구현 상태 갱신
- [ ] 주요 기능 완료 → `CLAUDE.md` TODO 업데이트

**주의:** 문서화 없이 PR Merge 금지

## 6. Git 규칙

### 브랜치
- main 직접 push 금지
- git worktree 사용 권장 (병렬 작업 시)
- 기능 개발 완료 시 반드시 commit & push

### 커밋 메시지

```
<type>: <description>

# types: feat, fix, refactor, docs, test, chore
# 예시:
# feat: Add Azure installation status API
# fix: Resolve null pointer in resource table
# refactor: Extract useResourceFilter hook
```

## 예시: Provider API 구현

```
1. docs/api/providers/[provider].md 확인
2. lib/types/[provider].ts 생성
3. lib/constants/[provider].ts 생성
4. lib/mock-[provider].ts 생성
5. app/api/[provider]/** 구현
6. lib/__tests__/mock-[provider].test.ts 작성
7. docs/api-routes/README.md에 섹션 추가
8. (필요시) ADR 작성
9. CLAUDE.md TODO 업데이트
```
