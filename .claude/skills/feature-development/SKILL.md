---
name: feature-development
description: 새 기능 개발 시 따르는 워크플로우. 기능 구현, API 개발, 컴포넌트 추가 요청 시 사용.
---

# 기능 개발 워크플로우

## 0. ⛔ Worktree 생성 (필수 — 스킵 불가)

코드 수정 전 반드시 실행:
```bash
bash scripts/guard-worktree.sh
# 차단되면 아래 명령으로 worktree 생성 후 해당 경로에서 작업
git worktree add ../pii-agent-demo-{name} -b {prefix}/{name}
# 이후 해당 디렉토리에서 작업 수행
```
- main 브랜치에서 직접 수정 절대 금지
- Prefix: `feat/`, `fix/`, `docs/`, `refactor/`, `chore/`, `test/`, `codex/`

## 1. 요구사항 확인

- BFF API 명세 확인 (`docs/api/`)
- 기존 코드 패턴 파악 (유사 기능 참고)
- 영향 범위 파악 (타입, 컴포넌트, API)
- 도메인 지식 필요 시 `docs/domain/README.md` 참조

### ADR 필요 여부
- 필요: 데이터 모델 변경, 새 아키텍처 패턴, 선택지 결정
- 불필요: 단순 CRUD, 명세대로 구현, 버그 수정

## 2. 구현 순서

```
1. lib/types/*.ts             → 타입 정의
2. lib/constants/*.ts         → 상수 정의
3. lib/mock-*.ts              → Mock 헬퍼 (개발용)
4. lib/api-client/mock/*.ts   → Mock 클라이언트 (비즈니스 로직)
5. app/api/**                 → API Routes (client.method() 디스패치)
6. lib/__tests__/*.ts         → 유닛 테스트
7. app/components/**          → UI 컴포넌트 (theme.ts 토큰 사용)
8. app/**                    → 페이지 통합
```

> `app/api/route.ts`는 `client.method()` 디스패치만 수행 (ADR-007)

## 3. 구현 후 검증

```bash
npm run test          # 유닛 테스트
npm run type-check    # 타입 체크
npm run build         # (선택) 빌드 확인
```

## 4. 문서화 (PR 전 필수)

- 새 API → `docs/api-routes/README.md`
- 설계 결정 → `docs/adr/*.md`
- BFF 명세 변경 → `docs/api/providers/*.md`
- 주요 기능 완료 → `docs/domain/README.md` TODO

## 5. Git (필수 — 개발 완료 즉시 자동 수행)

- **개발 완료 즉시 commit & push** — 사용자 확인 대기 없이 바로 수행
- 커밋: `<type>: <description>` (feat, fix, refactor, docs, test, chore)
- push 후 필요 시 PR 생성
