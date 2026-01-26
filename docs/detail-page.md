# 과제 상세 페이지 구현 계획

## 개요

과제(Project) 상세 페이지는 PII Agent 설치 프로세스의 핵심 페이지입니다.
5단계 설치 프로세스의 현재 상태를 보여주고, 단계별 액션을 수행할 수 있습니다.

**라우트**: `/projects/[projectId]`

---

## 페이지 구조

```
┌─────────────────────────────────────────────────────────────┐
│ Header: 로고 + "PII Agent" + 유저 프로필                      │
├─────────────────────────────────────────────────────────────┤
│ Breadcrumb: 관리자 > 서비스 코드 > 과제 코드                   │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────┐  ┌────────────────────────────────┐ │
│ │ 기본 정보            │  │ 프로세스 진행 상태              │ │
│ │ ───────────────────  │  │                                │ │
│ │ 과제 코드  N-IRP-001 │  │  ○───○───●───○───○            │ │
│ │ 서비스    SERVICE-A  │  │  1   2   3   4   5            │ │
│ │ Cloud     AWS 🔶     │  │                                │ │
│ │ 생성일    2024-01-15 │  │ ───────────────────────────── │ │
│ │ 리소스    4개        │  │                                │ │
│ │                      │  │ ⚙️ PII Agent를 설치하고 있습니다│ │
│ │ 설명                 │  │                                │ │
│ │ SERVICE-A 고객 DB에  │  │ ┌──────────────────────────┐  │ │
│ │ PII Agent를 설치...  │  │ │ ◐ 설치 상태 확인  2/3   │  │ │
│ │                      │  │ └──────────────────────────┘  │ │
│ └─────────────────────┘  └────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ 리소스 목록 섹션                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 필터: [전체] [연동 대상] [신규] (AWS만)                    │ │
│ │ ───────────────────────────────────────────────────────  │ │
│ │ □ | 타입 | 리소스 ID | Region | 연결 상태 | 상태 | 비고   │ │
│ │ ☑ | RDS  | rds-001  | ap-ne-2| 연결됨   | ACTIVE | -    │ │
│ │ ☑ | ATH  | ath-001  | ap-ne-2| 연결됨   | ACTIVE | -    │ │
│ │ □ | RS   | rs-001   | us-e-1 | 신규     | DISC   | NEW  │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 기본 정보 + 프로세스 진행 상태 합체 레이아웃

**좌측: 기본 정보 카드**
- 과제 코드, 서비스 코드, Cloud Provider, 생성일, 리소스 수, 설명

**우측: 프로세스 진행 상태 카드**
- Step Indicator (가로형, 컴팩트)
- 현재 단계 안내 텍스트
- 단계별 액션 버튼
- 3단계: "설치 상태 확인" 버튼 (스피너 + 진행률)

---

## Terraform 상태 표시 (변경됨)

Terraform 상태는 **3단계(설치 진행 중)일 때만** 팝업 모달로 조회 가능합니다.

### 3단계 액션 카드 UI

```
┌─────────────────────────────────────────────────────────────┐
│ 현재 단계                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ⚙️  PII Agent를 설치하고 있습니다                          │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ ◐ 설치 상태 확인                        2/3 완료    │   │
│   │     ↑ 스피너 애니메이션                  ↑ 진행률   │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   설치가 완료되면 자동으로 다음 단계로 진행됩니다.             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### "설치 상태 확인" 버튼 스타일

```tsx
// 버튼 컴포넌트 예시
<button className="w-full flex items-center justify-between px-4 py-3
                   bg-orange-50 border border-orange-200 rounded-lg
                   hover:bg-orange-100 transition-colors group">
  <div className="flex items-center gap-3">
    {/* 스피너 아이콘 */}
    <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent
                    rounded-full animate-spin" />
    <span className="font-medium text-orange-700">설치 상태 확인</span>
  </div>
  {/* 진행률 뱃지 */}
  <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-sm
                   font-medium rounded-full">
    2/3 완료
  </span>
</button>
```

### Terraform 상태 모달

```
┌─────────────────────────────────────────────────────────────┐
│ 설치 진행 상태                                         ✕    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  ✓  Service Terraform                      완료     │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  ◐  BDC Common Terraform                   진행중   │   │
│   │     └─ 리소스 프로비저닝 중...                       │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  ○  BDC Service Terraform                  대기     │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   ──────────────────────────────────────────────────────   │
│   설치가 완료되면 자동으로 다음 단계로 진행됩니다.             │
│                                                             │
│                                              [닫기]         │
└─────────────────────────────────────────────────────────────┘
```

### 진행률 계산 로직

```typescript
const getProgress = (terraformState: TerraformState) => {
  const states = [
    terraformState.serviceTf,
    terraformState.bdcCommonTf,
    terraformState.bdcServiceTf,
  ];
  const completed = states.filter(s => s === 'COMPLETED').length;
  return { completed, total: states.length };
};
```

---

## AWS vs IDC 차이점

### 공통 (재활용)
| 영역 | 설명 |
|------|------|
| Header | 로고 + 유저 프로필 |
| Breadcrumb | 서비스 코드 > 과제 코드 |
| Step Indicator | 5단계 프로세스 표시 |
| 기본 정보 카드 | 과제 코드, 서비스 코드, Cloud Provider, 생성일, 설명 |
| 현재 단계 액션 카드 | 안내 텍스트 + 단계별 액션 버튼 |
| Terraform 상태 모달 | 3단계에서만 표시 |

### AWS 전용
| 영역 | 설명 |
|------|------|
| 스캔 재실행 버튼 | 액션 카드에 항상 표시 |
| 리소스 테이블 컬럼 | Region, awsType 표시 |
| 필터 | "신규" 필터 표시 |
| 신규 리소스 | isNew 플래그로 NEW 뱃지 표시 |

### IDC 전용
| 영역 | 설명 |
|------|------|
| 리소스 테이블 컬럼 | Region 컬럼 숨김 |
| 필터 | "신규" 필터 숨김 |

---

## 컴포넌트 구조

```
app/projects/[projectId]/page.tsx          # 페이지 (Server Component)
app/projects/[projectId]/ProjectDetail.tsx # 클라이언트 컴포넌트 (메인)

app/components/features/
├── ProjectInfoCard.tsx             # 기본 정보 카드 (좌측)
├── ProcessStatusCard.tsx           # 프로세스 진행 상태 카드 (우측)
│                                   # - Step Indicator (컴팩트)
│                                   # - 안내 텍스트
│                                   # - 단계별 액션 버튼
├── ResourceTable.tsx               # 리소스 목록 테이블 (AWS/IDC 분기)
└── TerraformStatusModal.tsx        # Terraform 상태 모달 (3단계 전용)
```

---

## Phase 1: 기본 구조 + 공통 컴포넌트 ✅ 완료

### 목표
페이지 골격과 완전 재활용 가능한 컴포넌트 구현

### 구현 파일

#### 1. `app/api/projects/[projectId]/route.ts` (Mock API) ✅
- 기존에 구현되어 있음

#### 2. `app/projects/[projectId]/page.tsx` (Server Component) ✅
```typescript
// 라우트 페이지
// ProjectDetail 클라이언트 컴포넌트 렌더링
```

#### 3. `app/projects/[projectId]/ProjectDetail.tsx` (Client Component) ✅
```typescript
// 메인 클라이언트 컴포넌트
// - API 호출 (useEffect)
// - 로딩/에러 상태 처리
// - 하위 컴포넌트 렌더링
```

#### 4. `app/components/features/ProjectInfoCard.tsx` ✅
```typescript
interface ProjectInfoCardProps {
  project: Project;
}

// 표시 항목:
// - 과제 코드 (projectCode)
// - 서비스 코드 (serviceCode)
// - Cloud Provider (AWS/IDC 아이콘 + 텍스트)
// - 생성일 (createdAt, 포맷: YYYY-MM-DD)
// - 리소스 수
// - 설명 (description)
```

#### 5. `app/components/features/ProcessStatusCard.tsx` ✅
```typescript
interface ProcessStatusCardProps {
  project: Project;
}

// 프로세스 진행 상태 카드 (우측)
// - Step Indicator (컴팩트 버전)
// - 현재 단계 안내 텍스트
// - 단계별 액션 버튼 (Placeholder)
```

**단계별 라벨**:
| 단계 | 라벨 |
|------|------|
| 1 | 연동 대상 확정 |
| 2 | 승인 대기 |
| 3 | 설치 진행 |
| 4 | 연결 테스트 |
| 5 | 완료 |

### 체크리스트
- [x] Mock API 엔드포인트 (기존 활용)
- [x] 페이지 라우트 생성
- [x] ProjectDetail 클라이언트 컴포넌트 생성
- [x] ProjectInfoCard 컴포넌트 생성
- [x] ProcessStatusCard 컴포넌트 생성 (Step Indicator 포함)
- [x] 로딩/에러 상태 처리
- [x] 브라우저에서 `/projects/proj-1` 접근 테스트

---

## Phase 2: 리소스 테이블 (AWS/IDC 통합)

### 목표
cloudProvider에 따라 다르게 표시되는 리소스 테이블 구현

### 구현 파일

#### 1. `app/components/features/ResourceTable.tsx`
```typescript
interface ResourceTableProps {
  resources: Resource[];
  cloudProvider: CloudProvider;
  processStatus: ProcessStatus;
  onSelectionChange?: (selectedIds: string[]) => void;
}

// AWS 컬럼: 선택 | 타입 | 리소스 ID | Region | 연결 상태 | 라이프사이클 | 비고
// IDC 컬럼: 선택 | 타입 | 리소스 ID | 연결 상태 | 라이프사이클 | 비고

// 기능:
// - 필터: 전체 / 연동 대상(isSelected) / 신규(isNew, AWS만)
// - 체크박스: processStatus === 1 일 때만 활성화
// - 연결 상태 뱃지: CONNECTED(녹색), DISCONNECTED(빨간색), NEW(파란색)
// - 라이프사이클 뱃지: 상태별 색상
```

**연결 상태 뱃지 색상** (connectionStatus):
| 상태 | 색상 | 텍스트 |
|------|------|--------|
| CONNECTED | green-500 | 연결됨 |
| DISCONNECTED | red-500 | 끊김 |
| PENDING | gray-400 | 대기중 |

**신규 리소스 표시** (isNew 플래그):
| 조건 | 색상 | 텍스트 |
|------|------|--------|
| isNew === true | blue-500 | NEW |

**라이프사이클 상태 뱃지**:
| 상태 | 색상 | 텍스트 |
|------|------|--------|
| DISCOVERED | gray-400 | 스캔됨 |
| TARGET | blue-500 | 연동 대상 |
| PENDING_APPROVAL | orange-500 | 승인 대기 |
| INSTALLING | orange-500 | 설치중 |
| READY_TO_TEST | orange-500 | 테스트 필요 |
| ACTIVE | green-500 | 활성 |

### 체크리스트
- [ ] ResourceTable 컴포넌트 생성
- [ ] AWS/IDC 컬럼 분기 로직
- [ ] 필터 UI 및 로직
- [ ] 체크박스 선택 로직 (1단계만)
- [ ] 연결 상태 뱃지
- [ ] 라이프사이클 뱃지
- [ ] 빈 상태 처리

---

## Phase 3: 프로세스 액션 영역 + Terraform 모달

### 목표
단계별 다른 액션 버튼과 안내 텍스트 구현 + 3단계 전용 Terraform 모달

### 구현 파일

#### 1. `app/components/features/ProjectActionCard.tsx`
```typescript
interface ProjectActionCardProps {
  project: Project;
  selectedResourceIds: string[];
  userRole: UserRole;
  onAction: (action: string) => void;
  onShowTerraformStatus?: () => void;  // 3단계에서 모달 열기
}

// 표시 내용:
// - 현재 단계 안내 텍스트
// - 단계별 액션 버튼
// - AWS: 스캔 재실행 버튼 (항상)
// - 3단계: "설치 상태 확인" 버튼 (스피너 + 진행률)
```

**단계별 안내 텍스트**:
| 단계 | 안내 텍스트 |
|------|------------|
| 1 | Cloud Provider를 선택하고 연결할 리소스를 확정하세요 |
| 2 | 관리자 승인을 기다리는 중입니다 |
| 3 | PII Agent를 설치하고 있습니다 |
| 4 | 설치가 완료되었습니다. DB 연결을 테스트하세요 |
| 5 | 설치 및 연결이 완료되었습니다 |

**단계별 액션 버튼**:
| 단계 | 버튼 | 조건 |
|------|------|------|
| 1 | PII Agent 연동 대상 확정 | 선택된 리소스 1개 이상 |
| 2 | 승인 / 반려 | 관리자만 |
| 3 | 설치 상태 확인 (스피너 + 진행률) | 항상 표시 |
| 4 | Test Connection | - |
| 5 | (없음) | 완료 상태 |

#### 2. `app/components/features/TerraformStatusModal.tsx`
```typescript
interface TerraformStatusModalProps {
  terraformState: TerraformState;
  onClose: () => void;
}

// 3단계 전용 모달
// - 3개 TF 상태를 카드 형태로 표시
// - 각 상태별 아이콘/색상:
//   - COMPLETED: 체크 아이콘 (녹색)
//   - IN_PROGRESS: 스피너 아이콘 (주황색) + 설명 텍스트
//   - PENDING: 빈 원 아이콘 (회색)
// - 안내 메시지: "설치가 완료되면 자동으로 다음 단계로 진행됩니다."
```

#### 3. Mock API 엔드포인트들
```
PATCH /api/projects/:projectId/confirm-targets  # 1단계 → 2단계
PATCH /api/projects/:projectId/approve          # 2단계 → 3단계
PATCH /api/projects/:projectId/reject           # 2단계 → 1단계
PATCH /api/projects/:projectId/test-connection  # 4단계 → 5단계
POST  /api/projects/:projectId/scan             # AWS 스캔 재실행
```

### 체크리스트
- [ ] ProjectActionCard 컴포넌트 생성
- [ ] 단계별 안내 텍스트
- [ ] 단계별 액션 버튼
- [ ] TerraformStatusModal 컴포넌트 생성
- [ ] 3단계 "설치 상태 확인" 버튼 (스피너 + 진행률)
- [ ] Mock API 엔드포인트 생성 (기존에 일부 있음)
- [ ] 상태 전이 로직
- [ ] 로딩 상태 처리
- [ ] 에러 처리

---

## Phase 4: 통합 테스트 + UI Polish

### 목표
전체 플로우 테스트 및 UI 개선

### 체크리스트
- [ ] 전체 플로우 테스트 (1단계 → 5단계)
- [ ] AWS/IDC 분기 테스트
- [ ] 반려 플로우 테스트
- [ ] 스캔 재실행 테스트 (AWS)
- [ ] 로딩/에러 상태 최종 점검
- [ ] Placeholder 영역 제거
- [ ] UI polish

---

## API 스펙

### GET /api/projects/:projectId
**Response**: `Project` 객체 전체

```typescript
{
  id: string;
  projectCode: string;
  serviceCode: string;
  cloudProvider: 'AWS' | 'IDC';
  processStatus: 1 | 2 | 3 | 4 | 5;
  resources: Resource[];
  terraformState: TerraformState;
  createdAt: string;
  updatedAt: string;
  name: string;
  description: string;
}
```

### PATCH /api/projects/:projectId/confirm-targets
**Request Body**: `{ resourceIds: string[] }`
**Response**: 업데이트된 `Project`
**로직**:
- 선택된 리소스의 isSelected = true, lifecycleStatus = 'PENDING_APPROVAL'
- processStatus = 2

### PATCH /api/projects/:projectId/approve
**Response**: 업데이트된 `Project`
**로직**:
- 선택된 리소스의 lifecycleStatus = 'INSTALLING'
- processStatus = 3
- (데모용) 일정 시간 후 자동으로 processStatus = 4로 전이

### PATCH /api/projects/:projectId/reject
**Response**: 업데이트된 `Project`
**로직**:
- 선택된 리소스의 lifecycleStatus = 'DISCOVERED', isSelected = false
- processStatus = 1

### PATCH /api/projects/:projectId/test-connection
**Response**: 업데이트된 `Project`
**로직**:
- 선택된 리소스의 connectionStatus = 'CONNECTED', lifecycleStatus = 'ACTIVE'
- processStatus = 5

### POST /api/projects/:projectId/scan (AWS만)
**Response**: 업데이트된 `Project`
**로직**:
- 새로운 리소스 추가 (Mock)
- 기존 리소스 상태 변경 없음

---

## 디자인 가이드

### 컬러
- **연결됨/완료**: `green-500`
- **끊김/에러**: `red-500`
- **신규**: `blue-500`
- **진행중**: `orange-500`
- **대기중**: `gray-400`

### 스타일 원칙
- **깊이**: border 대신 shadow 사용
- **계층**: 대문자 섹션 헤더 (text-xs uppercase tracking-wide)
- **아이콘**: 이모지 대신 SVG 아이콘
- **인터랙션**: 호버 효과, 부드러운 transition
- **상태**: 로딩/빈 상태에 아이콘과 안내 메시지 제공

### Header 스타일 (AdminDashboard와 동일)
```tsx
<header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
  <div className="flex items-center gap-3">
    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
      {/* Shield 아이콘 */}
    </div>
    <h1 className="text-xl font-bold text-gray-900">PII Agent</h1>
  </div>
  <div className="flex items-center gap-3">
    <span className="text-sm text-gray-600">{user.name}</span>
    <div className="w-8 h-8 bg-gray-200 rounded-full">
      {/* User 아이콘 */}
    </div>
  </div>
</header>
```

### "설치 상태 확인" 버튼 스타일
```tsx
<button className="w-full flex items-center justify-between px-4 py-3
                   bg-orange-50 border border-orange-200 rounded-lg
                   hover:bg-orange-100 transition-colors">
  <div className="flex items-center gap-3">
    <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent
                    rounded-full animate-spin" />
    <span className="font-medium text-orange-700">설치 상태 확인</span>
  </div>
  <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-sm
                   font-medium rounded-full">
    {completed}/{total} 완료
  </span>
</button>
```

---

## 테스트 시나리오

### 시나리오 1: AWS 프로젝트 전체 플로우
1. `/projects/proj-4` (IDC, 1단계) 접근
2. 리소스 선택 → "연동 대상 확정" 클릭
3. 관리자로 "승인" 클릭
4. 3단계에서 "설치 상태 확인" 버튼 클릭 → 모달에서 진행률 확인
5. 자동으로 4단계 전이 확인
6. "Test Connection" 클릭
7. 5단계 완료 상태 확인

### 시나리오 2: AWS 스캔 재실행
1. `/projects/proj-1` (AWS, 5단계) 접근
2. "스캔 재실행" 클릭
3. 새로운 리소스 추가 확인

### 시나리오 3: 반려 처리
1. `/projects/proj-2` (AWS, 2단계) 접근
2. 관리자로 "반려" 클릭
3. 1단계로 돌아가는지 확인

### 시나리오 4: 3단계 Terraform 상태 확인
1. `/projects/proj-3` (AWS, 3단계) 접근
2. "설치 상태 확인" 버튼에 스피너 + "2/3 완료" 표시 확인
3. 버튼 클릭 → 모달 열림
4. 모달에서 각 TF 상태 (완료/진행중/대기) 표시 확인
5. 닫기 버튼으로 모달 닫기

---

## Mock 데이터

기존 `lib/mock-data.ts`의 프로젝트 데이터 활용:

| ID | 과제 코드 | Cloud | 단계 | 설명 |
|----|----------|-------|------|------|
| proj-1 | N-IRP-001 | AWS | 5 (완료) | 설치 완료 상태 |
| proj-2 | N-IRP-002 | AWS | 2 (승인 대기) | 승인 대기 상태 |
| proj-3 | OTHER-003 | AWS | 3 (설치중) | 설치 진행 중 - **TF 모달 테스트용** |
| proj-4 | N-IRP-004 | IDC | 1 (확정 대기) | IDC 환경 테스트용 |
| proj-5 | DATA-005 | AWS | 4 (테스트 필요) | 연결 테스트 필요 |

---

## 세션 분할 가이드

### 세션 1: Phase 1 ✅ 완료
- Mock API + 페이지 라우트 + StepIndicator + ProjectInfoCard
- **예상 작업량**: 파일 5-6개
- **체크포인트**: `/projects/proj-1` 접근 시 기본 정보 표시

### 세션 2: Phase 2
- ResourceTable (AWS/IDC 분기, 필터, 선택)
- **예상 작업량**: 파일 1개 (복잡도 높음)
- **체크포인트**: 리소스 테이블 표시, AWS/IDC 차이 확인

### 세션 3: Phase 3
- ProjectActionCard + TerraformStatusModal + 액션 API
- **예상 작업량**: 파일 2개 + API 5개
- **체크포인트**:
  - 단계별 액션 버튼 동작
  - 3단계 "설치 상태 확인" 버튼 + 모달 동작

### 세션 4: Phase 4
- 통합 테스트 + UI Polish + Placeholder 제거
- **예상 작업량**: 수정 위주
- **체크포인트**: 전체 플로우 동작 확인
