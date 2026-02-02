# AWS 설치 모드 UI 기획

> 자동/수동 설치 모드를 사용자가 프로세스 전반에서 인지할 수 있도록 하는 UI 설계

---

## 1. 핵심 요구사항

| 요구사항 | 설명 |
|----------|------|
| 설치 모드 표시 | 프로젝트 상세 페이지에서 자동/수동 설치 모드 항상 표시 |
| 변경 불가 명시 | 설치 모드는 프로젝트 생성 시 결정되며 변경 불가함을 인지 |
| TF Role 경고 | 자동 설치 선택 시 TF Role 미등록이면 모든 단계에서 경고 |

---

## 2. 설치 모드 뱃지

### 2.1 위치
- `ProjectInfoCard` 내부 (프로젝트 기본 정보 영역)
- Cloud Provider 정보 아래 또는 옆에 배치

### 2.2 디자인

```
┌─────────────────────────────────────┐
│ 프로젝트 정보                         │
├─────────────────────────────────────┤
│ 서비스 코드    SERVICE-A              │
│ 프로젝트 코드   AWS-001               │
│ Cloud Provider  AWS                  │
│ 설치 모드      [🔄 자동 설치]  🔒     │ ← 뱃지 + 잠금 아이콘
│                                      │
│ 생성일         2026-01-15            │
└─────────────────────────────────────┘
```

### 2.3 뱃지 스타일

| 모드 | 아이콘 | 텍스트 | 색상 | Tailwind |
|------|--------|--------|------|----------|
| 자동 설치 | 🔄 또는 ⚡ | 자동 설치 | blue | `bg-blue-100 text-blue-700` |
| 수동 설치 | 📋 또는 ✋ | 수동 설치 | gray | `bg-gray-100 text-gray-700` |

### 2.4 잠금 아이콘 (변경 불가 표시)
- 뱃지 옆에 🔒 아이콘 표시
- Tooltip: "설치 모드는 프로젝트 생성 시 결정되며 변경할 수 없습니다"

---

## 3. TF Role 미등록 경고 배너

### 3.1 조건
- 설치 모드가 "자동 설치"이고
- TerraformExecutionRole이 미등록인 경우

### 3.2 표시 위치
- 프로젝트 상세 페이지 상단 (헤더 아래)
- **모든 프로세스 단계에서 표시**

### 3.3 디자인

```
┌──────────────────────────────────────────────────────────────────────┐
│ ⚠️ TerraformExecutionRole이 등록되지 않았습니다.                       │
│    자동 설치를 진행하려면 Role을 등록하세요.        [Role 등록 가이드]   │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.4 스타일
```
배경: bg-amber-50
테두리: border border-amber-200
아이콘: text-amber-500
텍스트: text-amber-800
버튼: text-amber-700 hover:text-amber-900 underline
```

### 3.5 버튼 동작
- "Role 등록 가이드" 클릭 시 모달 또는 외부 문서 링크

---

## 4. ProcessStatusCard 내 설치 모드 표시

### 4.1 위치
- INSTALLING 단계 UI 내부
- 기존 `AwsInstallationInline` 컴포넌트 상단

### 4.2 디자인 (자동 설치)

```
┌──────────────────────────────────────────────────┐
│ AWS 설치 상태                    1/2  [새로고침]   │
├──────────────────────────────────────────────────┤
│ 🔄 자동 설치 모드                                 │ ← 추가
│ 시스템이 자동으로 Terraform을 실행합니다.          │
├──────────────────────────────────────────────────┤
│ ● Service TF    [완료] ✓                         │
│ ○ BDC TF        [진행 중] ◌                      │
└──────────────────────────────────────────────────┘
```

### 4.3 디자인 (수동 설치)

```
┌──────────────────────────────────────────────────┐
│ AWS 설치 상태                    0/2  [새로고침]   │
├──────────────────────────────────────────────────┤
│ 📋 수동 설치 모드                                 │ ← 추가
│ TF Script를 다운로드하여 직접 실행해주세요.         │
├──────────────────────────────────────────────────┤
│ ○ Service TF    [대기 중]                        │
│ ○ BDC TF        [대기 중]                        │
├──────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────┐   │
│ │ TF Script를 다운로드 받아서                  │   │
│ │ 담당자와 함께 설치 일정을 조율하세요.          │   │
│ │                                            │   │
│ │ [TF Script 다운로드]                        │   │
│ └────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

---

## 5. 프로세스 단계별 표시 정리

| 단계 | 설치 모드 뱃지 | TF Role 경고 | 설치 모드 안내 |
|------|---------------|-------------|---------------|
| 1. 연동 대상 확정 | ✅ ProjectInfoCard | ✅ (자동 + 미등록 시) | - |
| 2. 승인 대기 | ✅ ProjectInfoCard | ✅ (자동 + 미등록 시) | - |
| 3. 설치 진행 | ✅ ProjectInfoCard | ✅ (자동 + 미등록 시) | ✅ AwsInstallationInline |
| 4. 연결 테스트 | ✅ ProjectInfoCard | ✅ (자동 + 미등록 시) | - |
| 5. 완료 | ✅ ProjectInfoCard | - | - |

---

## 6. 데이터 요구사항

### 6.1 Project 모델 확장

```typescript
interface Project {
  // 기존 필드...

  // AWS 설치 모드 (AWS만 해당)
  awsInstallationMode?: 'AUTO' | 'MANUAL';
}
```

### 6.2 TF Role 상태 API

```typescript
// GET /api/aws/projects/{projectId}/tf-role-status
interface TfRoleStatus {
  registered: boolean;
  roleArn?: string;
  lastVerifiedAt?: string;
}
```

또는 기존 `AwsInstallationStatus`에 포함:

```typescript
interface AwsInstallationStatus {
  provider: 'AWS';
  hasTfPermission: boolean;      // 설치 모드 (true=자동, false=수동)
  tfRoleRegistered: boolean;     // TF Role 등록 여부 (추가)
  serviceTfCompleted: boolean;
  bdcTfCompleted: boolean;
  // ...
}
```

---

## 7. 컴포넌트 구조

```
AwsProjectPage
├── TfRoleWarningBanner (조건부: 자동 설치 + TF Role 미등록)
├── ProjectInfoCard
│   └── InstallationModeBadge (AWS만)
├── ProcessStatusCard
│   └── AwsInstallationInline
│       └── InstallationModeInfo (설치 모드 안내)
└── ResourceTable
```

### 7.1 신규 컴포넌트

| 컴포넌트 | 위치 | 설명 |
|----------|------|------|
| `InstallationModeBadge` | `components/ui/` | 자동/수동 설치 뱃지 |
| `TfRoleWarningBanner` | `components/features/` | TF Role 미등록 경고 배너 |

---

## 8. 구현 우선순위

### Phase 1 (필수)
1. `InstallationModeBadge` 컴포넌트 생성
2. `ProjectInfoCard`에 설치 모드 뱃지 추가
3. `AwsInstallationInline`에 설치 모드 안내 추가

### Phase 2 (필수)
4. `TfRoleWarningBanner` 컴포넌트 생성
5. `AwsProjectPage`에 경고 배너 추가
6. TF Role 상태 API 연동 (또는 기존 API 확장)

### Phase 3 (선택)
7. 프로젝트 생성 시 설치 모드 선택 UI
8. Tooltip 및 가이드 모달

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-02-02 | 초안 작성 |
