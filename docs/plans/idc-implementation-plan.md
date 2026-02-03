# IDC 기능 구현 계획

> 2026-02-03 작성

## 1. 현재 상태

### 구현 완료
- **타입 정의**: `lib/types/idc.ts`
  - `IdcDatabaseType`, `IdcTfStatus`, `IdcInstallationStatus`
  - `IdcResourceCreateRequest`, `SourceIpRecommendation`
- **상수**: `lib/constants/idc.ts`
  - 에러 코드, 기본 포트, Source IP 추천
- **Mock 데이터**: `lib/mock-idc.ts`
  - 설치 상태 조회/갱신, 방화벽 확인, 서비스 설정
- **API Routes**:
  - `GET /api/idc/projects/[projectId]/installation-status`
  - `POST /api/idc/projects/[projectId]/check-installation`
  - `POST /api/idc/projects/[projectId]/confirm-firewall`
  - `GET /api/idc/firewall/source-ip-recommendation`
  - `GET/PUT /api/services/[serviceCode]/settings/idc`
- **문서**: `docs/cloud-provider-states.md`

---

## 2. IDC 프로세스 특이점

| 항목 | 다른 Provider | IDC |
|------|--------------|-----|
| 스캔 | 자동 스캔 | **없음** (직접 입력) |
| 승인 | 필요 | **불필요** |
| 리소스 입력 | 스캔 결과 확정 | **IP/Port 직접 입력** |
| 설치 단계 | TF → Test Connection | **BDC TF → 방화벽 확인 → Test Connection** |

---

## 3. 구현 범위

### 3.1 타입 확장 (`lib/types/idc.ts`)

```typescript
// 입력 포맷 타입
type IdcInputFormat = 'IP' | 'HOST';

// 리소스 입력 (UI용)
interface IdcResourceInput {
  name: string;
  inputFormat: IdcInputFormat;  // IP 또는 HOST 선택
  ips?: string[];               // IP 선택 시: 최대 3개, IPv4 형식 필수
  host?: string;                // HOST 선택 시: 단일, 100자 이내
  port: number;
  databaseType: IdcDatabaseType;
  serviceId?: string;           // Oracle 필수
}

// Validation 상수
const IDC_VALIDATION = {
  MAX_IPS: 3,
  MAX_HOST_LENGTH: 100,
  IP_REGEX: /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/,
};

// Confirm 요청 시 (API용) - IP/Host 구분 없이 통합
interface IdcConfirmTargetsRequest {
  resources: Array<{
    name: string;
    database_hosts: string[];   // IP든 Host든 통합
    port: number;
    databaseType: IdcDatabaseType;
    serviceId?: string;
  }>;
}

// Credential 입력용 타입
interface IdcCredentialInput {
  username: string;
  password: string;
  description?: string;
}
```

### 3.2 UI 컴포넌트

#### 3.2.1 IDC 리소스 입력 폼
**위치**: `app/components/features/idc/IdcResourceInputPanel.tsx`

**기능**:
- **입력 포맷 선택**: IP / HOST 중 택1
  - IP 선택 시: 복수 IP 입력 가능
  - HOST 선택 시: 단일 Host만 입력
- Database Type 선택 (기존 `VmDatabaseConfigPanel` 재활용)
- Port 입력 (단일)
- Oracle Service ID (조건부)
- DB Credential 입력 (username/password)

**UX 요구사항**:
1. **입력 포맷 토글**:
   ```
   [IP] [HOST]  ← 토글 버튼으로 선택
   ```
2. **입력 제한**:
   - IP: 최대 3개까지
   - IP 형식 validation 필수 (IPv4: `x.x.x.x`)
   - Host: 단일, 100자 이내
3. **Cluster IP 경고** (IP 모드에서 IP 2개 이상일 때):
   ```
   ⚠️ 여러 IP를 입력하셨습니다.
   서로 다른 DB가 아닌, 동일 DB의 Cluster IP 목록이 맞는지 확인해주세요.
   서로 다른 DB는 별도의 리소스로 등록해야 합니다.
   ```
4. **리소스 0개 입력 불가**: 최소 1개 이상 IP 또는 Host 필수
5. **리소스 편집만 가능**: 개별 추가/삭제 불가, 전체 목록 편집 후 저장

#### 3.2.2 IDC 설치 상태 UI
**위치**: `app/components/features/idc/IdcInstallationStatus.tsx`

**상태별 표시**:
| 상태 | UI 표시 |
|------|---------|
| `bdcTf: PENDING` | "리소스 연결 환경 구성 대기" |
| `bdcTf: IN_PROGRESS` | "리소스 연결 환경 구성 중..." (스피너) |
| `bdcTf: COMPLETED`, `firewallOpened: false` | "방화벽 확인 필요" + 확인 버튼 |
| `bdcTf: COMPLETED`, `firewallOpened: true` | "Test Connection 진행 가능" |
| `bdcTf: FAILED` | "환경 구성 실패" + 재시도 버튼 |

#### 3.2.3 IDC 프로세스 흐름 컴포넌트
**위치**: `app/components/features/idc/IdcProcessFlow.tsx`

**단계**:
```
1. 리소스 입력  →  2. 환경 구성  →  3. 방화벽 확인  →  4. Test Connection  →  5. 완료
   (IP/Port/Cred)    (BDC TF)        (담당자 확인)       (연결 테스트)
```

### 3.3 API Routes 추가

#### 3.3.1 IDC 리소스 목록 조회
```
GET /api/idc/projects/[projectId]/resources
```
- Response: 등록된 IDC 리소스 목록

#### 3.3.2 IDC 리소스 편집 (전체 저장)
```
PUT /api/idc/projects/[projectId]/resources
```
- Request: `{ resources: IdcResourceInput[] }`
- Response: 저장된 리소스 목록
- 참고: 개별 추가/삭제 불가, 전체 목록을 한 번에 저장

#### 3.3.3 IDC 연동 대상 확정
```
POST /api/idc/projects/[projectId]/confirm-targets
```
- Request: `IdcConfirmTargetsRequest` (database_hosts로 통합)
- Response: 확정 결과
- 참고: 리소스 0개면 에러 반환

### 3.4 페이지 통합

**위치**: `app/projects/[projectId]/ProjectDetail.tsx`

IDC Provider일 때 분기 처리:
1. 리소스 입력 UI 표시 (스캔 UI 대신)
2. 승인 단계 스킵
3. 설치 상태 UI 변경

---

## 4. 구현 순서

### Phase 1: 타입 및 API
1. [ ] `lib/types/idc.ts` 확장 (InputFormat, database_hosts, Credential)
2. [ ] `lib/mock-idc.ts` 리소스 조회/편집 함수 추가
3. [ ] API Routes 추가 (리소스 조회/편집, confirm-targets)

### Phase 2: UI 컴포넌트
4. [ ] `IdcResourceInputPanel.tsx` 구현
   - 기존 `VmDatabaseConfigPanel` 참고
   - IP 복수 입력 + Cluster 경고문
5. [ ] `IdcInstallationStatus.tsx` 구현
   - BDC TF 상태 표시
   - 방화벽 확인 UI

### Phase 3: 페이지 통합
6. [ ] `ProjectDetail.tsx`에서 IDC 분기 처리
7. [ ] IDC 전용 프로세스 플로우 연결

### Phase 4: 테스트 및 검증
8. [ ] Unit Test 추가
9. [ ] E2E 시나리오 검증

---

## 5. 주요 UX 결정사항

### 5.1 IP vs Host 입력 ✅ 확정
- **입력 포맷 토글**: IP / HOST 중 택1
- IP 선택 시: 복수 입력 가능 (Cluster IP)
- HOST 선택 시: 단일 입력만
- API 전송 시: `database_hosts`로 통합

### 5.2 Cluster IP 경고 타이밍
- **옵션 A**: IP 2개 이상 입력 시 즉시 경고 ✅ 권장
- **옵션 B**: 저장 버튼 클릭 시 확인 모달

### 5.3 Credential 입력 위치
- **옵션 A**: 리소스 입력 폼에 포함 ✅ 권장
- **옵션 B**: 별도 설정 페이지

### 5.4 리소스 편집 방식 ✅ 확정
- 개별 추가/삭제 불가
- 전체 목록 편집 후 한 번에 저장

---

## 6. 기존 컴포넌트 재활용

| 기존 컴포넌트 | 재활용 항목 |
|--------------|------------|
| `VmDatabaseConfigPanel` | Database Type 선택 UI, Port 입력, Oracle Service ID |
| `ProcessStatusCard` | 설치 진행 상태 카드 레이아웃 |
| `StepGuide` | 단계별 가이드 UI |

---

## 7. 파일 구조 (예상)

```
app/components/features/idc/
├── IdcResourceInputPanel.tsx    # 리소스 입력 폼
├── IdcInstallationStatus.tsx    # 설치 상태 표시
├── IdcProcessFlow.tsx           # 프로세스 흐름
├── IdcFirewallGuide.tsx         # 방화벽 설정 가이드
├── ClusterIpWarning.tsx         # Cluster IP 경고 컴포넌트
├── InputFormatToggle.tsx        # IP/HOST 토글 컴포넌트
└── index.ts

app/api/idc/projects/[projectId]/
├── resources/
│   └── route.ts                 # GET, PUT (전체 편집)
└── confirm-targets/
    └── route.ts                 # POST (연동 대상 확정)
```

---

## 8. 의존성

- 기존 IDC BFF API 브랜치 (`claude/implement-idc-bff-api-E7Iwg`) 기반
- `VmDatabaseConfigPanel` 컴포넌트 참조
- `lib/theme.ts` 스타일 토큰 사용

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-02-03 | 초안 작성 |
| 2026-02-03 | 피드백 반영: 리소스 편집만 가능, IP/HOST 토글 분리, database_hosts 통합 |
| 2026-02-03 | 입력 제한 추가: IP 최대 3개 + validation, Host 100자 이내 |
