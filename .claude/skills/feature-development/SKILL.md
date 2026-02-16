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
bash scripts/create-worktree.sh --topic {name} --prefix {prefix}
# 이후 해당 디렉토리에서 작업 수행
bash scripts/bootstrap-worktree.sh "$(pwd)"
```
- main 브랜치에서 직접 수정 절대 금지
- Prefix: `feat/`, `fix/`, `docs/`, `refactor/`, `chore/`, `test/`, `codex/`
- 신규 브랜치 생성 전 로컬 `main`을 최신 `origin/main`으로 동기화 필수
- 신규 브랜치는 동기화된 로컬 `main` 기준으로만 생성

## 1. 요구사항 확인

- API Spec은 Swagger(`docs/swagger/*.yaml`)를 단일 소스로 확인
- 기존 코드 패턴 파악 (유사 기능 참고)
- 영향 범위 파악 (타입, 컴포넌트, API)
- 도메인 지식 필요 시 `docs/domain/README.md` 참조

### 계약 우선 모드 (필수)
- API 계약 기반 작업은 **Swagger 계약이 기존 코드보다 항상 우선**한다.
- 구현 전 endpoint별 계약 매핑표를 먼저 작성한다.
  - request required 필드
  - response required 필드
  - enum 값
  - 필드명 변경점(신규/삭제/구형 alias)
- 매핑표 작성 전 코드 수정을 시작하지 않는다.
- 기존 코드 패턴과 충돌하면 계약을 따르고, 남은 legacy 의존은 TODO + 제거 계획을 코드/PR에 남긴다.

### 탐색 범위/서브에이전트 규칙 (필수)
- 변경 대상 파일 중심으로만 탐색한다 (대량 Read/Grep 금지).
- 기본은 메인 세션 단독 구현이다.
- 구현 subagent를 여러 개로 분할해 동시에 계약 구현을 진행하지 않는다.
- subagent를 사용하더라도 각 단계 시작 시 계약 문서를 다시 확인한다.

### API Spec 변경 사전 확인 (필수)
- Swagger 신규/수정 시 사용자 확인을 반드시 먼저 받는다.
- 확인 전에는 제안안/초안까지만 작성하고 확정 반영은 보류한다.
- Swagger에 아래 항목이 없으면 경고 후 보완한다.
  - 각 API의 Error 코드 정의
  - 각 API의 Metadata 실행시간 (`x-expected-duration`)

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

### 계약 정합성 검증 (API 작업 필수)
- 요청/응답 타입이 Swagger required 필드를 모두 포함하는지 확인
- enum 값이 Swagger와 1:1로 일치하는지 확인
- 구형 필드명(alias)을 재도입하지 않았는지 확인
- 도메인별 금지 의존 검색:
  ```bash
  rg -n "{legacy_flag_or_field_1}|{legacy_flag_or_field_2}" <changed_paths>
  ```
  - 요청 생성/처리 경로에서 발견되면 수정하거나 TODO + 제거 계획을 남긴다.

## 4. 문서화 (PR 전 필수)

- 새 API/변경 API → `docs/swagger/*.yaml` 우선 반영 (Swagger-First)
- 설계 결정 → `docs/adr/*.md`
- BFF 명세 변경 → `docs/api/providers/*.md`
- 주요 기능 완료 → `docs/domain/README.md` TODO

### Swagger 점검 체크리스트 (필수)
- 모든 신규/변경 endpoint에 Error 코드/에러 응답 스키마가 선언되어 있는가?
- 모든 신규/변경 endpoint에 `x-expected-duration`이 선언되어 있는가?
- 누락 항목 발견 시 구현 진행 전 사용자에게 경고하고 확인을 받았는가?

## 5. Git (필수 — 작업 완료 시 자동 수행)

- 기능 개발 또는 문서 업데이트 완료 시 반드시 commit & push 수행
- 커밋: `<type>: <description>` (feat, fix, refactor, docs, test, chore)
- **⛔ push 전 반드시 main rebase** (충돌 방지):
  ```bash
  git fetch origin main && git rebase origin/main
  ```
  - rebase 충돌 시 해결 후 `git rebase --continue`
  - 테스트 재실행하여 rebase 후에도 통과 확인
- push 후 필요 시 PR 생성
