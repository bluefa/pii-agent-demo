# PII Agent 관리 시스템

## 프로젝트 개요
PM과 개발팀 간 소통을 위한 데모 웹페이지.
서비스 담당자가 PII Agent 설치를 직접 수행할 수 있는 시스템.
실제 백엔드 없이 Mock API로 동작.

## 기술 스택
- Framework: Next.js 14 (App Router)
- Language: TypeScript
- Styling: TailwindCSS
- Mock API: MSW (Mock Service Worker)
- 상태 관리: React useState (외부 라이브러리 사용 안 함)

## 명령어
- `npm run dev`: 개발 서버 실행
- `npm run build`: 프로덕션 빌드
- `npm run lint`: 린트 체크

## 폴더 구조
```
src/
├── app/                    # Next.js App Router 페이지
│   ├── page.tsx           # 메인 (서비스 코드 & 과제 목록)
│   ├── projects/[id]/     # 과제 상세
│   └── admin/             # 관리자 페이지
├── components/            # 재사용 컴포넌트
│   ├── ui/               # 버튼, 배지 등 기본 UI
│   └── features/         # 비즈니스 로직 컴포넌트
├── mocks/                # MSW 관련
│   ├── handlers.ts       # API 핸들러
│   └── data.ts          # Mock 데이터
├── types/                # TypeScript 타입 정의
└── lib/                  # 유틸리티 함수
```

## 코딩 규칙
- 컴포넌트: PascalCase (예: StepIndicator.tsx)
- 함수: arrow function 사용
- Props: interface로 정의
- 스타일: Tailwind 클래스 직접 사용
- any 타입 사용 금지

## 색상 체계
- 연결됨/완료: green-500
- 끊김/에러: red-500
- 신규: blue-500
- 진행중: orange-500
- 대기중: gray-400

## 주의사항
- 데스크탑만 지원 (반응형 불필요)
- 실제 인증 구현 안 함 (Mock 사용자 고정)
- 복잡한 에러 핸들링 불필요
- 한국어 UI

---

## 요구사항 문서

### 1. 시스템 구조

#### 권한 체계
- 서비스 코드 단위로 권한 관리
- 한 서비스 코드 내에 여러 과제(N-IRP 등) 존재
- 서비스 코드 권한 보유 시 → 해당 서비스의 모든 과제 접근 가능
- 권한 종류: 조회/Action 통합 (세분화 없음)

#### 사용자 역할
- 서비스 담당자: 자신이 권한 있는 서비스 코드의 과제 조회 및 PII Agent 관리
- 관리자: 모든 서비스 코드 접근 + 과제 등록 + 권한 부여 + 승인 처리

### 2. Cloud Provider 범위

#### 지원 Provider
- AWS: 리소스 스캔 기능 있음
- IDC: 리소스 스캔 기능 없음

#### AWS 리소스 예시
- RDS, Athena, DynamoDB 등

#### 신규 리소스
- ScanRole을 통해 주기적으로 리소스 스캔
- 이전에 발견되지 않은 리소스 = 신규 리소스

### 3. PII Agent 설치 프로세스 (5단계)

```
1. 연동 대상 확정 대기
   💡 Cloud Provider를 선택하고 연결할 리소스를 확정하세요
   → 서비스 담당자 액션: "PII Agent 연동 대상 확정" 버튼

2. 승인 대기
   ⏳ 관리자 승인을 기다리는 중입니다
   → 관리자 액션: 승인/반려

3. 설치 진행 중
   ⚙️ PII Agent를 설치하고 있습니다 (약 5-10분 소요)
   → 백그라운드 자동 처리

4. 연결 테스트 필요
   🔌 설치가 완료되었습니다. DB 연결을 테스트하세요
   → 서비스 담당자 액션: "Test Connection" 버튼

5. 설치 완료
   ✅ PII Agent 설치 및 연결이 완료되었습니다
```

#### 재설치 프로세스
- 연결 끊김 또는 신규 리소스 발견 시
- 서비스 담당자가 "PII Agent 연동 대상 확정" 다시 클릭
- 프로세스가 1단계로 리셋되어 처음부터 진행

### 4. 화면 구성

#### 4.1 서비스 담당자 화면

**페이지 1: 서비스 코드 & 과제 목록 (통합)**
```
┌─────────────────────────────────────┐
│ 좌측: 서비스 코드 목록              │
│ - SERVICE-A                         │
│ - SERVICE-B                         │
│                                     │
│ 우측: 선택된 서비스의 과제 목록     │
│ [SERVICE-A의 과제들]                │
│ - N-IRP-001 (설치 완료) ✅          │
│ - N-IRP-002 (승인 대기) ⏳          │
│ - OTHER-003 (설치 진행 중) ⚙️       │
└─────────────────────────────────────┘
```

표시 정보:
- 과제 코드
- 프로세스 상태 (5단계 중 현재 위치)
- 상태 아이콘/배지

**페이지 2: 과제 상세**

2-1. 프로세스 현황 섹션
- 5단계 프로세스 시각화 (스텝 인디케이터)
- 현재 단계 강조 표시
- 각 단계별 설명 텍스트
- 다음 액션 버튼 (단계에 따라 표시)

2-2. 리소스 연결 상태 섹션
```
| 리소스 타입 | 리소스 ID | 연결 상태 | 비고 |
|------------|----------|----------|------|
| RDS        | rds-001  | ✅ 연결됨 |      |
| Athena     | ath-002  | ⚠️ 끊김  |      |
| DynamoDB   | ddb-003  | 🔵 신규  | NEW  |
```

2-3. 액션 버튼 영역
- 스캔 재실행 (AWS만, IDC는 없음)
- PII Agent 연동 대상 확정 (프로세스 1단계 또는 재설치 시)
- Test Connection (프로세스 4단계에서 활성화)

2-4. TF 설치 상태 (읽기 전용)
```
1. 서비스 측 TF: ✓ 완료
2. BDC 측 TF common: 🔄 진행중
3. BDC service level TF: ⏸ 대기중
```

#### 4.2 관리자 화면

**페이지 1: 서비스 코드 & 과제 목록**
- 서비스 담당자 화면과 동일 구조
- 추가 기능: 과제 등록 버튼, 권한 관리 버튼

**과제 등록 모달/폼:**
- 과제 코드 입력
- 서비스 코드 선택
- Cloud Provider 선택 (AWS/IDC)

**권한 관리 모달/폼:**
```
서비스 코드: SERVICE-A

현재 권한 보유 사용자:
- 홍길동 (이메일: hong@company.com) [제거]
- 김철수 (이메일: kim@company.com) [제거]

[+ 사용자 추가]
이메일 또는 사번 입력: _____________
[추가]
```

**페이지 2: 과제 상세**
- 서비스 담당자 화면과 동일
- 추가: 프로세스 2단계 "승인 대기"에서 승인/반려 버튼

### 5. Mock API 설계

#### 엔드포인트 구조

**인증/권한**
- GET /api/user/me - 현재 사용자 정보 + 권한
- GET /api/user/services - 접근 가능한 서비스 코드 목록

**과제 관리**
- GET /api/services/{serviceCode}/projects - 과제 목록
- GET /api/projects/{projectId} - 과제 상세
- POST /api/projects - 과제 등록 (관리자)
- DELETE /api/projects/{projectId} - 과제 삭제 (관리자)

**PII Agent 관리**
- POST /api/projects/{projectId}/confirm-targets - 연동 대상 확정
- POST /api/projects/{projectId}/approve - 승인 (관리자)
- POST /api/projects/{projectId}/reject - 반려 (관리자)
- POST /api/projects/{projectId}/test-connection - 연결 테스트

**리소스 관리**
- GET /api/projects/{projectId}/resources - 리소스 목록 + 상태
- GET /api/projects/{projectId}/terraform-status - TF 설치 상태
- POST /api/projects/{projectId}/scan - 리소스 스캔 재실행

**권한 관리**
- GET /api/services/{serviceCode}/permissions - 권한 보유 사용자 목록
- POST /api/services/{serviceCode}/permissions - 사용자 권한 추가
- DELETE /api/services/{serviceCode}/permissions/{userId} - 권한 제거

### 6. Mock 데이터 타입

```typescript
// 프로세스 상태
enum ProcessStatus {
  WAITING_TARGET_CONFIRMATION = 1,  // 연동 대상 확정 대기
  WAITING_APPROVAL = 2,              // 승인 대기
  INSTALLING = 3,                    // 설치 진행 중
  WAITING_CONNECTION_TEST = 4,       // 연결 테스트 필요
  INSTALLATION_COMPLETE = 5          // 설치 완료
}

// 연결 상태
type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'NEW';

// TF 상태
type TerraformStatus = 'COMPLETED' | 'IN_PROGRESS' | 'PENDING';

// 사용자 역할
type UserRole = 'SERVICE_MANAGER' | 'ADMIN';

// Cloud Provider
type CloudProvider = 'AWS' | 'IDC';
```

### 7. 우선순위 및 일정

**Day 1 목표 (핵심 기능)**
- 프로젝트 셋업 + Mock API 기본 구조
- 서비스 담당자 - 과제 목록 페이지
- 서비스 담당자 - 과제 상세 페이지 (프로세스 현황 + 리소스 상태)
- 기본 액션 (연동 대상 확정, Test Connection)

**Day 2 목표 (추가 기능 및 정제)**
- 관리자 - 과제 등록 기능
- 관리자 - 권한 관리 기능
- 관리자 - 승인/반려 기능
- TF 설치 상태 표시
- 스캔 재실행 기능
- UI 정제 및 설명 텍스트 추가

### 8. 디자인 가이드라인

**스타일**
- 깔끔하고 심플한 비즈니스 UI
- TailwindCSS 사용
- 프로세스 시각화는 스텝 인디케이터 형태

**레퍼런스**
- AWS Console 스타일의 깔끔한 대시보드
- Linear.app의 심플한 프로젝트 관리 UI