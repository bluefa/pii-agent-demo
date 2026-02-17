# PR #179 리뷰 회고: AI 반복 실수 분석 및 방지 대책

## 요약

PR #179 (Legacy API → v1 마이그레이션)에서 AI가 **동일 유형의 실수를 4회 이상 반복**했습니다.
핵심 문제는 "swagger 계약 대비 실제 구현의 정합성 검증 부재"입니다.

---

## 1. 발생한 실수 목록

### 실수 1: 응답 envelope 불일치 (3회 반복)

| 회차 | swagger 계약 | 실제 구현 | 발견 시점 |
|------|-------------|----------|----------|
| 1차 | `{ targetSources: [...] }` | `{ projects: [...] }` | 코드 리뷰 |
| 2차 | `{ targetSource: {...} }` | `{ project: {...} }` | 코드 리뷰 |
| 3차 | POST `{ targetSource: {...} }` | `{ project: {...} }` | 2차 리뷰 |

**패턴**: route handler가 mock client 응답을 그대로 패스스루하면서, swagger가 요구하는 envelope 키와 다른 키가 반환됨.

### 실수 2: swagger 필드명 불일치

| swagger 정의 | 실제 데이터 |
|-------------|-----------|
| `targetSourceCode` (required) | `projectCode` |
| `name` (required) | 미존재 |

**원인**: swagger 스키마를 작성할 때 실제 mock 데이터의 필드명을 대조하지 않음.

### 실수 3: ADR-007 위반 — 변환 로직의 잘못된 위치

swagger 계약을 맞추기 위해 route handler에서 `response.json()` → envelope 재포장을 수행.
ADR-007은 route에서 `client.method()` 디스패치만 허용.

**수정 과정**:
1. route에서 재포장 (위반)
2. "swagger를 코드에 맞추자" → envelope 키를 `projects`/`project`로 변경 (잘못된 방향)
3. 사용자 지적 후 revert → client 계층에 `targetSources` 네임스페이스 추가 (올바른 해결)

### 실수 4: 수정 방향 혼동

| 상황 | AI의 선택 | 올바른 방향 |
|------|----------|-----------|
| swagger ≠ 코드 | swagger를 코드에 맞춤 | 코드를 swagger에 맞춤 |
| route에서 변환 필요 | route에서 직접 변환 | client 계층에서 변환 |

---

## 2. 근본 원인 분석

### 원인 A: "계약 먼저" 사고방식 부재

AI는 코드를 먼저 작성하고, swagger를 나중에 맞추려는 경향을 보임.
올바른 순서: **swagger 계약 확정 → 계약에 맞게 구현 → 구현이 계약과 일치하는지 검증**

```
❌ 코드 작성 → swagger 작성 → 불일치 발견 → swagger 수정
✅ swagger 확인 → 코드 작성 → swagger 대비 검증
```

### 원인 B: 엔드포인트별 독립 검증 누락

6개 엔드포인트를 마이그레이션하면서, 각 엔드포인트를 개별적으로 검증하지 않음.
GET 목록을 고치면서 POST 생성, GET 상세의 동일 문제를 놓침.

### 원인 C: 레이어 책임 경계 미숙지

```
swagger 계약 (외부 인터페이스)
    ↕ 이 간극을 누가 메꾸는가?
mock/bff client (내부 데이터)
```

AI는 이 간극을 route handler에서 메꾸려 했지만, ADR-007에 의해 client 계층이 담당해야 함.
**ADR을 읽었지만 실제 적용 시 위반** — 이해와 적용의 괴리.

### 원인 D: 검증 체크리스트 부재

구현 후 "빌드 통과 + 테스트 통과"만 확인하고, 계약 정합성은 체계적으로 검증하지 않음.

---

## 3. 방지 대책

### 대책 1: Contract-First 검증 체크리스트 (즉시 적용)

v1 API 작업 시 **매 엔드포인트마다** 아래를 순서대로 확인:

```
□ swagger path + method 확인
□ swagger request schema 필드명 == FE 전송 필드명
□ swagger response schema envelope 키 == client 반환 키
□ swagger response schema 필드명 == mock 데이터 필드명
□ route handler가 client.method() 디스패치만 수행 (ADR-007)
□ FE fetchJson 타입이 swagger response와 일치
```

### 대책 2: Swagger-Implementation 매핑 테이블 작성 (즉시 적용)

PR 작성 전, 변경 대상 엔드포인트별로 매핑 테이블을 만들고 교차 검증:

```markdown
| Endpoint | Swagger Envelope | Mock Response | Route Action | FE Reads |
|----------|-----------------|---------------|-------------|----------|
| GET /target-sources | { targetSources } | { projects } | client.targetSources.list() | data.targetSources |
```

### 대책 3: ADR 위반 감지 규칙 강화

`route.ts` 파일에서 다음 패턴이 보이면 ADR-007 위반 경고:
- `response.json()` 호출
- `NextResponse.json()` 직접 호출 (에러 응답 제외)
- 조건 분기 로직

### 대책 4: 엔드포인트 개별 검증 원칙

N개 엔드포인트 마이그레이션 시, "일괄 구현 → 일괄 검증"이 아닌 **"1개 구현 → 1개 검증 → 다음"** 순서로 진행.

---

## 4. 이번 PR에서의 수정 타임라인

```
커밋 1: v1 route 생성 + FE URL 변경 + legacy 삭제
  → [P1] projectId/targetSourceId 식별자 혼용 (GitHub 리뷰)

커밋 2: getProject(targetSourceId: number) + 호출부 전환
  → [P0] swagger envelope 불일치, fetchJson 미사용 (자체 리뷰)

커밋 3: envelope 재포장 + fetchJson 전환
  → [P1] ADR-007 위반 - route에서 재포장 (리뷰)
  → [P1] swagger 필드명 불일치 (리뷰)

커밋 4: swagger 필드명 수정 (projectCode)
커밋 5: legacyProjectId 제거
커밋 6: swagger envelope을 코드에 맞춤 (잘못된 방향) → revert
커밋 7: client 계층에 targetSources 네임스페이스 추가 (ADR-007 준수)
커밋 8: POST envelope 변환 + swagger id 필드 추가
커밋 9: swagger id 필드 취소

총 9회 커밋, 4회 리뷰 지적, 1회 revert
```

**9회 커밋 중 올바른 방향의 커밋: 4회 (44%)**
나머지 5회는 수정 → 재수정 → revert 사이클.

---

## 5. 결론

이번 실수의 본질은 **"swagger를 읽었지만 검증하지 않았다"** 입니다.

AI는 swagger 파일을 참조용으로만 읽고, 구현 후 계약 대비 정합성을 체계적으로 확인하지 않았습니다.
빌드/타입체크/테스트는 **코드 내부 일관성**만 검증하지, **외부 계약 준수**는 검증하지 못합니다.

Contract-First 체크리스트와 매핑 테이블을 도입하면, 동일 유형의 반복 실수를 구조적으로 방지할 수 있습니다.
