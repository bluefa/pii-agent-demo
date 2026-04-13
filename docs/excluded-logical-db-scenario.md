# 논리 DB 제외 기능 시나리오 (Issue #258)

## 1. 개요

연동 대상 리소스에서 특정 논리 DB를 제외하고, Test Connection 완료 여부를 관리하는 기능입니다.

### 핵심 기능 3가지

| # | 기능 | API | 설명 |
|---|------|-----|------|
| 1 | 연동 제외 논리 DB 관리 | GET / PUT | 리소스별 제외 목록 조회·업데이트 |
| 2 | TC 결과 논리 DB 조회 | GET | 마지막 TC 성공 결과에서 확인된 논리 DB 목록 |
| 3 | TC 완료 확인 관리 | PUT | TargetSource 단위 TC 완료 설정/롤백 |

---

## 2. API 시나리오

### 2.1 연동 제외 논리 DB 목록 조회

**GET** `/install/v1/target-sources/{targetSourceId}/excluded-logical-databases?resourceId={resourceId}`

- `resourceId`는 **쿼리 파라미터**로 전달 (원본 swagger의 path parameter에서 변경)
- 응답: `targetSourceId`, `resourceId`, `excludedLogicalDatabases[]`

```
사용자 → [제외 목록 조회] → BFF → Infra Manager API
                                      ↓
                              excludedLogicalDatabases 반환
```

### 2.2 연동 제외 논리 DB 목록 업데이트

**PUT** `/install/v1/target-sources/{targetSourceId}/excluded-logical-databases?resourceId={resourceId}`

- `resourceId`는 **쿼리 파라미터**로 전달
- Body: `{ excludedLogicalDatabases: string[] }` (전체 교체)
- 응답: 업데이트된 `ExcludedLogicalDatabasesResponse`

#### 부수 효과 (서버 측 자동 수행)
1. **TC 이력 삭제** — 기존 Test Connection 이력이 삭제되어 미수행 상태로 초기화
2. **GCS 파일 업로드** — 제외할 논리 DB 목록을 GCS에 파일로 업로드
3. **다음 TC 시 제외 목록 전달** — Agent/Resource에 논리 DB 목록 전달

```
사용자 → [제외 목록 업데이트] → BFF → Infra Manager API
                                           ↓
                                  1. TC 이력 삭제 (미수행 상태)
                                  2. GCS 파일 업로드
                                  3. 업데이트된 목록 반환
```

### 2.3 TC 결과 논리 DB 목록 조회

**GET** `/install/v1/target-sources/{targetSourceId}/tested-logical-databases?resourceId={resourceId}`

- `resourceId`는 **쿼리 파라미터**로 전달
- 마지막 TC 버전의 SUCCESS 결과에서 확인된 논리 DB 이름 목록 반환
- 404 조건:
  - 해당 Resource 미존재
  - 마지막 TC 결과에서 해당 Resource가 SUCCESS가 아닌 경우

```
사용자 → [TC 결과 논리 DB 조회] → BFF → Infra Manager API
                                              ↓
                                   ConnectionTestedContext의
                                   databaseName 기반 목록 반환
```

### 2.4 TC 완료 확인 설정/롤백

**PUT** `/install/v1/target-sources/{targetSourceId}/test-connection-confirmation`

- resourceId 불필요 (TargetSource 단위)
- Body: `{ confirmed: boolean }`
- 완료 설정 (`confirmed: true`): confirmedAt에 현재 시간 기록
- 완료 롤백 (`confirmed: false`): confirmedAt을 null로 초기화

```
사용자 → [TC 완료 설정] → BFF → Infra Manager API
                                      ↓
                              confirmed=true, confirmedAt=now

사용자 → [TC 완료 롤백] → BFF → Infra Manager API
                                      ↓
                              confirmed=false, confirmedAt=null
```

### 2.5 TargetSource 조회 시 TC 완료 필드 포함

기존 TargetSource 조회 응답에 아래 2개 필드가 추가되어야 합니다:

| 필드 | 타입 | 설명 |
|------|------|------|
| `testConnectionConfirmed` | `boolean` | TC 완료 확인 여부 |
| `testConnectionConfirmedAt` | `string \| null` | TC 완료 확인 시각 (ISO 8601) |

---

## 3. BFF API 라우트 매핑

| BFF Route (Next.js) | Method | Backend API |
|---------------------|--------|-------------|
| `/integration/api/v1/target-sources/[targetSourceId]/excluded-logical-databases` | GET | `GET /install/v1/target-sources/{id}/excluded-logical-databases?resourceId=` |
| `/integration/api/v1/target-sources/[targetSourceId]/excluded-logical-databases` | PUT | `PUT /install/v1/target-sources/{id}/excluded-logical-databases?resourceId=` |
| `/integration/api/v1/target-sources/[targetSourceId]/tested-logical-databases` | GET | `GET /install/v1/target-sources/{id}/tested-logical-databases?resourceId=` |
| `/integration/api/v1/target-sources/[targetSourceId]/test-connection-confirmation` | PUT | `PUT /install/v1/target-sources/{id}/test-connection-confirmation` |

---

## 4. resourceId 쿼리 파라미터 변경 사항

원본 swagger(이슈 #258)에서 `resourceId`는 **path parameter**로 정의되어 있었으나, 다음과 같이 **query parameter**로 변경합니다:

### 변경 전 (path parameter)
```
/target-sources/{targetSourceId}/resources/{resourceId}/excluded-logical-databases
/target-sources/{targetSourceId}/resources/{resourceId}/tested-logical-databases
```

### 변경 후 (query parameter)
```
/target-sources/{targetSourceId}/excluded-logical-databases?resourceId={resourceId}
/target-sources/{targetSourceId}/tested-logical-databases?resourceId={resourceId}
```

### 변경 이유
- `resourceId`는 리소스 계층의 하위 경로가 아닌, 필터링 조건에 가까움
- 기존 BFF 라우트 구조(`/target-sources/[targetSourceId]/...`)와 일관성 유지
- path depth를 줄여 라우트 파일 구조 단순화

---

## 5. UI 와이어프레임

### 5.1 연결 테스트 패널 — TC 전체 성공 시 [다음] 버튼 활성화

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  연결 테스트                                                    전체 내역 →  │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│  ┌─ 리소스 목록 ──────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  리소스              DB 유형         TC 결과                           │  │
│  │  ─────────────────────────────────────────────────────────────────────│  │
│  │  RDS  rds-prod-01   MySQL           ● 성공                           │  │
│  │  RDS  rds-prod-02   PostgreSQL      ● 성공                           │  │
│  │  RDS  rds-prod-03   MySQL           ● 성공                           │  │
│  │  EC2  ec2-worker    Oracle          ● 성공                           │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  최근 테스트 결과: 4개 성공 · 4/13 14:30                      상세 보기 →    │
│                                                                             │
│  [연결 테스트 수행]                           [다음 →] ← TC 전체 성공 시 활성 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### [다음] 버튼 활성화 조건
- 마지막 TC 결과가 **전체 리소스 SUCCESS**일 때만 활성
- 1개라도 FAIL이거나 TC 미수행이면 비활성(disabled)

#### TC 결과 상태 표기

| 아이콘 | 상태 | 설명 |
|--------|------|------|
| ● 성공 (green) | SUCCESS | 마지막 TC에서 해당 리소스 연결 성공 |
| ● 실패 (red) | FAIL | 마지막 TC에서 해당 리소스 연결 실패 |
| ○ 미수행 (gray) | N/A | TC 이력 없거나, 제외 목록 변경으로 초기화됨 |

### 5.2 [다음] 클릭 → 논리 DB 확인 모달

[다음] 버튼 클릭 시, 각 리소스별로 **tested-logical-databases** + **excluded-logical-databases**를 조회하여 한 화면에 보여줍니다.

```
┌──────────────────────────────────────────────────────────────────────┐
│  논리 DB 확인                                                   [X] │
│──────────────────────────────────────────────────────────────────────│
│                                                                      │
│  연결 테스트 결과를 확인해주세요.                                       │
│  각 리소스별 논리 DB 수와 제외 목록입니다.                               │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  리소스                DB 유형     논리 DB    제외 DB           │  │
│  │  ────────────────────────────────────────────────────────────  │  │
│  │  RDS  rds-prod-01     MySQL       6개        2건 제외          │  │
│  │       제외: db_legacy_01, db_temp_migration                    │  │
│  │  ────────────────────────────────────────────────────────────  │  │
│  │  RDS  rds-prod-02     PostgreSQL  4개        —                │  │
│  │  ────────────────────────────────────────────────────────────  │  │
│  │  RDS  rds-prod-03     MySQL       3개        1건 제외          │  │
│  │       제외: db_deprecated                                      │  │
│  │  ────────────────────────────────────────────────────────────  │  │
│  │  EC2  ec2-worker      Oracle      2개        —                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  총 15개 논리 DB · 제외 3건                                           │
│                                                                      │
│  ───────────────────────────────────────────────────────────────────  │
│  확인되셨습니까?                                                      │
│  확인 시 Test Connection 완료로 처리됩니다.                             │
│                                                                      │
│                                          [취소]     [확인]           │
└──────────────────────────────────────────────────────────────────────┘
```

#### 모달 동작

| 버튼 | 동작 |
|------|------|
| **[확인]** | `PUT test-connection-confirmation { confirmed: true }` → TC 완료 처리 → 다음 단계로 이동 |
| **[취소]** | 모달 닫기, 현재 상태 유지 |

#### 제외 DB가 없는 경우

```
│  RDS  rds-prod-02     PostgreSQL  4개        —                │
```

#### 제외 DB가 있는 경우 — 하위에 제외 목록 표시

```
│  RDS  rds-prod-01     MySQL       6개        2건 제외          │
│       제외: db_legacy_01, db_temp_migration                    │
```

### 5.3 전체 흐름 시나리오

```
1. 사용자: [연결 테스트 수행] 클릭 → TC 실행
       ↓
2. TC 진행 중: 리소스 목록에 상태 실시간 갱신
       ↓
3. TC 완료 — 전체 SUCCESS:
       → [다음 →] 버튼 활성화
       ↓
   TC 완료 — 일부 FAIL:
       → [다음 →] 버튼 비활성
       → 실패 리소스 확인 후 재시도
       ↓
4. 사용자: [다음 →] 클릭
       ↓
5. 모달 오픈:
       - 리소스별 tested-logical-databases API 호출 → 논리 DB 수 표시
       - 리소스별 excluded-logical-databases API 호출 → 제외 목록 표시
       ↓
6. 사용자: 내용 확인 → [확인] 클릭
       ↓
7. PUT test-connection-confirmation { confirmed: true }
       → TC 완료 확인 처리
       → 다음 프로세스 단계로 이동
```

### 5.4 제외 목록은 언제 관리하나?

제외 목록 편집은 TC 실행 **이전** 단계에서 별도로 수행합니다.
[다음] 모달은 읽기 전용 확인 화면이며, 여기서 제외 목록을 수정하지 않습니다.

```
[제외 DB 설정] → [연결 테스트 수행] → TC 전체 성공 → [다음] → 확인 모달 → [확인]
     ↑                                                              ↓
     └──── 제외 변경 필요 시 돌아감 ←──── [취소]로 되돌아옴 ──────────┘
```

---

## 6. 구현 범위

### Phase 1: API 계층
1. Swagger 파일 작성 (`docs/swagger/excluded-logical-db.yaml`) — resourceId를 query param으로 반영
2. BFF Route 4개 생성
3. API Client 함수 추가 (`app/lib/api/`)
4. Mock 데이터 준비

### Phase 2: UI 계층
5. 연동 제외 논리 DB 관리 UI
6. TC 결과 논리 DB 조회 UI
7. TC 완료 확인 설정/롤백 UI
8. TargetSource 상세 조회에 TC 완료 필드 표시

### Phase 3: 통합
9. 제외 목록 업데이트 → TC 이력 초기화 흐름 연동
10. E2E 시나리오 검증
