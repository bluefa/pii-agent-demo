---
name: ux-audit
description: 기존 UI/UX를 코드에서 읽어 구조화된 분석 문서를 생성하는 스킬. UX 수정/개선 전 현황 파악, UX 리뷰, 기능 이해 요청 시 사용.
---

# UX Audit 스킬

컴포넌트 코드를 읽고, 현재 UX를 **사람이 이해할 수 있는 구조화된 문서**로 변환합니다.

## 언제 사용하는가

- 기존 UX를 수정하기 전에 현황을 파악할 때
- 특정 기능의 UX 흐름을 이해하고 싶을 때
- `/ux-requirements` 실행 전에 입력 자료를 준비할 때

## 분석 프로세스

### Step 1: 대상 컴포넌트 특정

사용자가 분석 대상을 지정하면, 관련 파일을 탐색한다.

```
사용자: "Connection Test UX를 분석해줘"
→ 검색: ConnectionTest*, TestConnection* 컴포넌트
→ 관련 페이지, API, 타입, Mock까지 추적
```

탐색 범위:

| 계층 | 탐색 대상 |
|------|----------|
| 페이지 | `app/**/page.tsx` — 해당 컴포넌트를 렌더링하는 페이지 |
| 컴포넌트 | `app/components/**` — 대상 컴포넌트 + import하는 하위 컴포넌트 |
| API | `app/api/**`, `app/lib/api/**` — 컴포넌트가 호출하는 API |
| 타입 | `lib/types.ts`, `lib/types/**` — 사용하는 데이터 모델 |
| Mock | `lib/mock-*.ts`, `lib/api-client/mock/**` — 개발 환경 동작 |
| 상수 | `lib/constants/**` — 관련 상수, 설정값 |

### Step 2: 7가지 관점으로 분석

각 관점은 **코드에서 근거를 찾아** 기술한다. 추측이 아니라 코드 기반이어야 한다.

---

## 분석 관점 7가지

### 1. UX Flow (사용자 여정)

사용자가 이 기능을 사용할 때 밟는 **단계별 흐름**을 기술한다.

```markdown
### UX Flow

1. [진입점] — 사용자가 이 화면에 도달하는 경로
   └→ 예: 프로젝트 상세 → ProcessStatusCard에서 WAITING_CONNECTION_TEST 도달

2. [Step 1] — 첫 번째 사용자 행동
   └→ 예: "연결 테스트 실행" 버튼 클릭

3. [Step 2] — 시스템 반응 + 사용자 대기/행동
   └→ 예: 5~15초 대기, 진행률 표시

4. [Step 3] — 결과 확인 + 후속 행동
   └→ 예: 성공 시 완료 확인, 실패 시 재시도
```

코드에서 찾는 법:
- 페이지의 렌더링 조건 (`if/switch`)으로 진입점 파악
- 이벤트 핸들러 (`onClick`, `onSubmit`)로 사용자 행동 파악
- API 호출 + 상태 변경으로 시스템 반응 파악

### 2. 시나리오별 제공 정보

각 화면 상태에서 사용자에게 **보이는 정보**를 나열한다.

```markdown
### 제공 정보

| 시나리오 | 사용자에게 보이는 정보 | 데이터 소스 |
|----------|---------------------|------------|
| 테스트 전 | "연결 테스트를 실행하세요" | 정적 텍스트 |
| 진행 중 | "3/7 리소스 완료" | GET /latest → resource_results.length |
| 성공 | "연결 성공 (7개 리소스)" | GET /latest → status + resource count |
| 실패 | "2개 리소스 연결 실패" | GET /latest → fail count |
```

코드에서 찾는 법:
- JSX 내 텍스트 리터럴, 변수 바인딩
- 조건부 렌더링 (`{condition && <span>...`})
- 데이터 포맷팅 함수 (toLocaleString, 뱃지 텍스트 등)

### 3. CTA (Call-to-Action)

사용자가 **클릭할 수 있는 모든 액션**을 나열한다.

```markdown
### CTA 목록

| 시나리오 | CTA | 유형 | 활성 조건 | 클릭 시 동작 |
|----------|-----|------|----------|-------------|
| 테스트 전 | "연결 테스트 실행" | Primary | 항상 | POST /test-connection |
| 진행 중 | "테스트 진행 중..." | Primary (disabled) | PENDING | - |
| 성공 | "재실행" | Primary | 항상 | POST /test-connection |
| 성공 | "확인하러 가기" | Secondary | last-success 존재 | 모달 오픈 |
```

코드에서 찾는 법:
- `<button>`, `<a>` 요소와 onClick 핸들러
- `disabled` 조건
- 버튼 텍스트의 조건부 변경 (`{loading ? '진행 중...' : '실행'}`)

### 4. 화면 상태와 전환

화면이 가질 수 있는 **모든 상태**와 상태 간 **전환 조건**을 정리한다.

```markdown
### 화면 상태

| 상태 | 진입 조건 | UI 표현 | 가능한 전환 |
|------|----------|---------|------------|
| 초기 | 이력 없음 | 설명 + 실행 버튼 | → 진행 중 |
| 진행 중 | POST 성공 | spinner + progress bar | → 성공/실패 |
| 성공 | status=SUCCESS | 성공 배너 + 접힌 결과 | → 진행 중 (재실행) |
| 실패 | status=FAIL | 실패 배너 + 접힌 결과 | → 진행 중 (재실행) |
```

코드에서 찾는 법:
- **명시적 상태**: `enum`, `type`, `useState`로 정의된 상태 변수
- **암묵적 상태**: 조건부 렌더링 (`if/switch/ternary`)에서 추론
  - `{loading && <Spinner />}` → "로딩" 상태 존재
  - `{data ? <Result /> : <Empty />}` → "데이터 있음/없음" 상태 존재
  - `{error && <ErrorBanner />}` → "에러" 상태 존재
- **전환 조건**: 이벤트 핸들러, useEffect, API 콜백에서 상태 변경 추적

### 5. 데이터 의존성

각 UI 요소가 **어떤 데이터에 의존**하는지 매핑한다.

```markdown
### 데이터 의존성

| UI 요소 | 데이터 소스 | 갱신 방식 |
|---------|------------|----------|
| 마지막 성공 시각 | GET /last-success | 페이지 로드 시 |
| 진행률 바 | GET /latest → resource_results | 5초 polling |
| 리소스별 결과 | GET /latest → resource_results | 완료 시 1회 |
```

코드에서 찾는 법:
- `fetch`, `useSWR`, `useEffect` 내 API 호출
- polling/interval 패턴 (`setInterval`, `setTimeout`, `refetchInterval`)
- props 체인 추적 (부모 → 자식으로 어떤 데이터가 전달되는지)

### 6. 피드백 메커니즘

상태 변화를 사용자에게 **어떻게 전달**하는지 기술한다.

```markdown
### 피드백 메커니즘

| 이벤트 | 피드백 방식 | 구현 |
|--------|-----------|------|
| 테스트 시작 | 버튼 spinner + disabled | LoadingButton |
| 진행 중 | progress bar + 텍스트 | polling 기반 |
| 완료 | shake 애니메이션 | CSS @keyframes |
| 에러 | 빨간 뱃지 + 에러 메시지 | statusColors.error |
```

코드에서 찾는 법:
- 애니메이션 클래스 (`animate-*`, `transition-*`)
- 로딩 컴포넌트 (`LoadingSpinner`, `Skeleton`)
- 조건부 스타일 변경 (색상, 아이콘, 텍스트)

### 7. 빈 상태 / 에러 처리

데이터가 없거나 실패했을 때 **사용자에게 보이는 것**을 기술한다.

```markdown
### 빈 상태 / 에러 처리

| 상황 | 현재 처리 | 사용자에게 보이는 것 |
|------|----------|-------------------|
| 테스트 이력 없음 | 텍스트 표시 | "아직 성공한 연결 테스트가 없습니다" |
| API 실패 | 미처리 / catch | (현재 처리 없음) |
| 409 Conflict | 미처리 | (현재 처리 없음) |
| 리소스 0개 | 조건부 렌더링 | 패널 자체 숨김 |
```

코드에서 찾는 법:
- `if (!data)`, `if (list.length === 0)` 분기
- `try/catch`, `.catch()` 에러 핸들링
- API 응답 코드별 처리 (`404`, `409`, `500`)

---

## 출력 형식

### 전체 분석 문서 구조

```markdown
## [기능명] UX 현황 분석

> 분석 대상: [컴포넌트 목록]
> 분석 기준: [커밋/브랜치]

### 1. UX Flow
[단계별 흐름]

### 2. 시나리오별 제공 정보
[테이블]

### 3. CTA 목록
[테이블]

### 4. 화면 상태와 전환
[테이블]

### 5. 데이터 의존성
[테이블]

### 6. 피드백 메커니즘
[테이블]

### 7. 빈 상태 / 에러 처리
[테이블]

### 발견 사항
- [현재 UX에서 누락되거나 개선 가능한 점]
- [미처리 에러, 빈 상태 등]
```

### "발견 사항" 작성 규칙

- **사실만 기술한다** — "이게 더 좋다"는 판단 금지. "현재 X가 처리되지 않음"까지만.
- **코드 근거를 포함한다** — `ConnectionTestPanel.tsx:55` 처럼 파일:라인 참조
- **개선 제안은 하지 않는다** — 그건 `/ux-requirements`에서 사용자와 함께 결정

---

## `/ux-requirements`와의 연결

`/ux-audit` 출력물은 `/ux-requirements` Phase 1의 입력이 됩니다.

```
/ux-audit 실행
    ↓ [현황 분석 문서]
/ux-requirements Phase 1 스킵 (이미 분석됨)
    ↓
/ux-requirements Phase 2~ 시작 (갭 분석 + 설계 대화)
```
