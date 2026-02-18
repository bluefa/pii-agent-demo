# ConnectionTestPanel — UI/UX Flow 문서

## 개요

ConnectionTestPanel은 PII Agent가 설치된 리소스에 정상 접속되는지 비동기로 확인하는 UI 컴포넌트입니다.
프로세스 상태 `WAITING_CONNECTION_TEST` 단계에서 표시됩니다.

---

## UI 상태 (uiState)

| 상태 | 조건 | 설명 |
|------|------|------|
| `IDLE` | latestJob이 없음 | 연결 테스트를 한 번도 실행하지 않은 상태 |
| `PENDING` | latestJob.status === 'PENDING' | 테스트 진행 중 (4초 간격 polling) |
| `SUCCESS` | latestJob.status === 'SUCCESS' | 최근 테스트 전체 성공 |
| `FAIL` | latestJob.status === 'FAIL' | 최근 테스트에 실패한 리소스 존재 |

---

## 화면 구성 (상단 → 하단)

### 1. 마지막 성공 바 (LastSuccessBar)

항상 표시됩니다.

| 조건 | 표시 내용 |
|------|-----------|
| 성공 이력 없음 | "아직 성공한 연결 테스트가 없습니다" (info 배경) |
| 성공 이력 있음 | 날짜 + "성공 (N개 리소스)" (success 배경) + **CTA: "확인하러 가기"** |

**CTA: "확인하러 가기"** → 마지막 성공 테스트의 리소스별 결과를 아코디언으로 펼침/접음

### 2. 설명 영역

항상 표시됩니다.

> PII Agent가 설치된 리소스에 정상 접속되는지 확인합니다.
> Credential이 필요한 DB는 사전에 설정해주세요.

### 3. 버튼 영역

| 조건 | Primary CTA | Secondary CTA |
|------|-------------|---------------|
| IDLE (이력 없음) | **"연결 테스트 실행"** | — |
| PENDING | **"테스트 진행 중..."** (disabled, spinner) | — |
| SUCCESS/FAIL (이력 있음) | **"재실행"** | **"모든 연결 내역 확인하러 가기"** |

### 4. 트리거 에러 메시지

`triggerError`가 있을 때만 표시됩니다.

| 에러 유형 | 메시지 |
|-----------|--------|
| 409 Conflict | "이미 진행 중인 테스트가 있습니다" |
| 기타 에러 | API 에러 메시지 또는 "연결 테스트 실행에 실패했습니다" |

### 5. 진행률 바 (ProgressBar)

PENDING 상태에서만 표시됩니다.

**제공 정보:**
- 스피너 + "연결 테스트 진행 중..."
- 완료/전체 리소스 카운트 (예: "2/5 리소스 완료")
- 프로그레스 바 (퍼센트)
- 완료된 리소스별 미리보기 (resource_id + SUCCESS/FAIL 상태)

### 6. 결과 카드 (ResultCard)

SUCCESS 또는 FAIL 상태에서만 표시됩니다.

| 결과 | 표시 | CTA |
|------|------|-----|
| SUCCESS | "연결 성공 (N개 리소스)" (success 배경) | **"모든 리소스 확인하기"** (아코디언 토글) |
| FAIL | "M개 리소스 연결 실패 (총 N개)" (error 배경) | **"모든 리소스 확인하기"** (아코디언 토글) |

**아코디언 펼침 시:**
- 각 리소스별 상태 (SUCCESS/FAIL)
- FAIL 리소스: error_status + guide 메시지
  - AUTH_FAIL: "Credential 정보를 확인해주세요..."
  - CONNECTION_FAIL: "네트워크 설정을 확인해주세요..."
  - PERMISSION_DENIED: "해당 리소스에 대한 접근 권한이 부족합니다..."

---

## 모달

### 1. CredentialSetupModal

**진입 조건:** "연결 테스트 실행" 또는 "재실행" 클릭 시, `needsCredential(databaseType) && !selectedCredentialId`인 리소스가 존재할 때

**제공 정보:**
- 제목: "Credential 설정 필요"
- 부제: "연결 테스트를 실행하려면 아래 리소스에 Credential을 설정해주세요."
- 리소스별 행: resource type, resourceId, databaseType + Credential 선택 dropdown

**CTA:**
| 버튼 | 동작 |
|------|------|
| **"취소"** (secondary) | 모달 닫기 |
| **"설정 완료 후 테스트 실행"** (primary) | 모든 credential 저장 → 모달 닫기 → 자동으로 테스트 trigger |

**활성화 조건:** 모든 리소스에 credential이 선택되어야 "설정 완료 후 테스트 실행" 활성화

### 2. TestConnectionHistoryModal

**진입 조건:** "모든 연결 내역 확인하러 가기" 버튼 클릭

**제공 정보:**
- 제목: "연결 테스트 내역"
- 부제: "총 N건"
- 페이지네이션 (5건/페이지)
- 각 이력 카드: 날짜 + 상태 배지 (성공/실패/진행 중) + 아코디언 펼침

**CTA:**
| 버튼 | 동작 |
|------|------|
| **이력 카드 행** (클릭) | 해당 테스트의 리소스별 결과 아코디언 펼침/접음 |
| **"이전"/"다음"** (footer, 2페이지 이상일 때) | 페이지 이동 |
| **X 버튼** (header) | 모달 닫기 |

---

## 시나리오별 CTA 요약

### 시나리오 1: 첫 연결 테스트 (이력 없음)

```
[LastSuccessBar] "아직 성공한 연결 테스트가 없습니다"
[설명]
[CTA] "연결 테스트 실행" (primary)
```

### 시나리오 2: 첫 테스트 + Credential 미설정

```
사용자: "연결 테스트 실행" 클릭
→ [CredentialSetupModal] 오픈
  - [CTA] "취소" / "설정 완료 후 테스트 실행"
→ 설정 완료 → 자동 테스트 시작
```

### 시나리오 3: 테스트 진행 중

```
[LastSuccessBar] (이전 성공 결과 있으면 표시)
[설명]
[CTA] "테스트 진행 중..." (disabled)
[ProgressBar] 2/5 리소스 완료 + 완료된 리소스 미리보기
```

### 시나리오 4: 테스트 전체 성공

```
[LastSuccessBar] "2/18 14:30 성공 (5개 리소스)" + [CTA] "확인하러 가기"
[설명]
[CTA] "재실행" (primary) + "모든 연결 내역 확인하러 가기" (secondary)
[ResultCard] "연결 성공 (5개 리소스)" + [CTA] "모든 리소스 확인하기"
```

### 시나리오 5: 테스트 부분 실패

```
[LastSuccessBar] (이전 성공 없으면: "아직 성공한 연결 테스트가 없습니다")
[설명]
[CTA] "재실행" (primary) + "모든 연결 내역 확인하러 가기" (secondary)
[ResultCard] "2개 리소스 연결 실패 (총 5개)" + [CTA] "모든 리소스 확인하기"
  → 펼침: AUTH_FAIL, CONNECTION_FAIL 등 가이드 메시지
```

### 시나리오 6: 이력 조회

```
사용자: "모든 연결 내역 확인하러 가기" 클릭
→ [TestConnectionHistoryModal] 오픈
  - 이력 목록 (최신순)
  - 각 행 클릭 → 리소스별 결과 아코디언
  - [CTA] "이전"/"다음" (페이지네이션)
```

---

## CTA 전체 목록

| # | CTA 텍스트 | 위치 | 타입 | 조건 |
|---|-----------|------|------|------|
| 1 | **연결 테스트 실행** | 버튼 영역 | Primary | IDLE, 이력 없음 |
| 2 | **재실행** | 버튼 영역 | Primary | SUCCESS/FAIL, 이력 있음 |
| 3 | **테스트 진행 중...** | 버튼 영역 | Primary (disabled) | PENDING |
| 4 | **모든 연결 내역 확인하러 가기** | 버튼 영역 | Secondary | 이력 있음 + !PENDING |
| 5 | **확인하러 가기** | LastSuccessBar | Text link | 성공 이력 존재 |
| 6 | **모든 리소스 확인하기** | ResultCard | Text link | SUCCESS/FAIL 완료 |
| 7 | **취소** | CredentialSetupModal | Secondary | 모달 열림 |
| 8 | **설정 완료 후 테스트 실행** | CredentialSetupModal | Primary | 모든 credential 선택됨 |
| 9 | **이력 카드 행** | HistoryModal | Clickable row | 이력 존재 |
| 10 | **이전/다음** | HistoryModal footer | Ghost | 2페이지 이상 |

---

## 프로세스 상태 전환

| 이벤트 | connectionTest.status 변경 | 프로세스 단계 영향 |
|--------|---------------------------|-------------------|
| 전체 리소스 SUCCESS | `NOT_TESTED` → `PASSED` | `WAITING_CONNECTION_TEST` → `CONNECTION_VERIFIED` |
| 일부 리소스 FAIL | `NOT_TESTED` → `FAILED` | `WAITING_CONNECTION_TEST` 유지 |
| 프로세스 재시작 (승인 요청) | → `NOT_TESTED` | 이력 전체 삭제, 단계 초기화 |
