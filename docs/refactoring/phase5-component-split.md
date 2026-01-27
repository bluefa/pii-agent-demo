# Phase 5: 대형 컴포넌트 분리

## 개요

이 문서는 Phase 5 리팩토링에서 분리된 대형 컴포넌트들의 새로운 구조를 설명합니다.

---

## 요약

| 컴포넌트 | Before | After | 감소율 |
|----------|--------|-------|--------|
| ProcessStatusCard | 590줄 | 200줄 | 66% |
| ResourceTable | 549줄 | 230줄 | 58% |
| AdminDashboard | 431줄 | 197줄 | 54% |

---

## ProcessStatusCard 분리

### 새 디렉토리 구조

```
app/components/features/
  ProcessStatusCard.tsx          # 메인 컴포넌트 (200줄)
  process-status/
    index.ts                     # 내보내기
    StepProgressBar.tsx          # 단계 진행 표시 (67줄)
    StepGuide.tsx                # 현재 단계 가이드 (72줄)
    ApprovalModals.tsx           # 승인/반려 모달 (93줄)
    ConnectionTestPanel.tsx      # 연결 테스트 패널 (153줄)
    MissingCredentialsTab.tsx    # 미설정 Credential 탭 (85줄)
```

### 컴포넌트별 역할

#### StepProgressBar
프로세스 단계 진행 표시 UI

```typescript
import { StepProgressBar } from './process-status';

<StepProgressBar currentStep={ProcessStatus.INSTALLING} />
```

#### StepGuide
현재 단계의 안내 메시지 표시

```typescript
import { StepGuide } from './process-status';

<StepGuide currentStep={ProcessStatus.WAITING_APPROVAL} />
// → "관리자 승인을 기다리는 중입니다"
```

#### ApprovalModals
승인/반려 모달 컴포넌트

```typescript
import { ApproveModal, RejectModal } from './process-status';

<ApproveModal
  isOpen={approveModal.isOpen}
  onClose={approveModal.close}
  onSubmit={() => doApprove(comment)}
  loading={loading}
  value={comment}
  onChange={setComment}
/>
```

#### ConnectionTestPanel
연결 테스트 영역 (탭 + History + Credentials)

```typescript
import { ConnectionTestPanel } from './process-status';

<ConnectionTestPanel
  connectionTestHistory={history}
  credentials={credentials}
  selectedResources={resources}
  onTestConnection={handleTest}
  testLoading={loading}
  onCredentialChange={handleChange}
/>
```

---

## ResourceTable 분리

### 새 디렉토리 구조

```
app/components/features/
  ResourceTable.tsx              # 메인 컴포넌트 (230줄)
  resource-table/
    index.ts                     # 내보내기
    ResourceRow.tsx              # 리소스 행 (110줄)
    RegionGroup.tsx              # AWS 리전 그룹 (63줄)
    ConnectionIndicator.tsx      # 연결 상태 표시 (30줄)
    StatusIcon.tsx               # 상태 아이콘 + 툴팁 (60줄)
    FilterTab.tsx                # 필터 탭 버튼 (25줄)
    EmptyState.tsx               # 빈 상태 표시 (28줄)
```

### 컴포넌트별 역할

#### ResourceRow
개별 리소스 행 렌더링

```typescript
import { ResourceRow } from './resource-table';

<ResourceRow
  resource={resource}
  isAWS={true}
  selectedIds={selectedIds}
  isCheckboxEnabled={true}
  showConnectionStatus={true}
  showCredentialColumn={true}
  onCheckboxChange={handleChange}
  getCredentialsForType={getCredentials}
  onCredentialChange={handleCredChange}
/>
```

#### RegionGroup
AWS 리전별 그룹핑 (헤더 + 리소스 목록)

```typescript
import { RegionGroup } from './resource-table';

<RegionGroup
  region="ap-northeast-2"
  resources={regionResources}
  // ... ResourceRow와 동일한 props
/>
```

#### ConnectionIndicator
연결 상태 표시 (연결됨/끊김/대기중)

```typescript
import { ConnectionIndicator } from './resource-table';

<ConnectionIndicator status="CONNECTED" />
// → ● 연결됨

<ConnectionIndicator status="DISCONNECTED" hasCredentialError={true} />
// → ● Credential 미선택
```

#### StatusIcon
상태 아이콘 + 툴팁

```typescript
import { StatusIcon } from './resource-table';

<StatusIcon type="selected" />   // ✓ 연동 대상
<StatusIcon type="new" />        // ★ 신규 발견된 리소스
<StatusIcon type="disconnected" /> // ⚠ 연결이 끊어졌습니다
```

---

## AdminDashboard 분리

### 새 디렉토리 구조

```
app/components/features/
  AdminDashboard.tsx             # 메인 컴포넌트 (197줄)
  admin/
    index.ts                     # 내보내기
    AdminHeader.tsx              # 헤더 (32줄)
    ServiceSidebar.tsx           # 서비스 목록 사이드바 (47줄)
    PermissionsPanel.tsx         # 권한 관리 패널 (73줄)
    ProjectsTable.tsx            # 과제 테이블 (168줄)
```

### 컴포넌트별 역할

#### AdminHeader
관리자 페이지 헤더

```typescript
import { AdminHeader } from './admin';

<AdminHeader />
// → PII Agent 관리자 로고 + 사용자 정보
```

#### ServiceSidebar
서비스 코드 목록 사이드바

```typescript
import { ServiceSidebar } from './admin';

<ServiceSidebar
  services={services}
  selectedService={selected}
  onSelectService={setSelected}
  projectCount={projects.length}
/>
```

#### PermissionsPanel
서비스별 권한 유저 관리

```typescript
import { PermissionsPanel } from './admin';

<PermissionsPanel
  permissions={users}
  onAddUser={handleAdd}
  onRemoveUser={handleRemove}
/>
```

#### ProjectsTable
과제 목록 테이블 + 액션 버튼

```typescript
import { ProjectsTable } from './admin';

<ProjectsTable
  projects={projects}
  loading={loading}
  actionLoading={actionId}
  onCompleteInstallation={handleComplete}
  onConfirmCompletion={handleConfirm}
/>
```

---

## Import 패턴

### 전체 import (index.ts 사용)

```typescript
// ProcessStatusCard 관련
import {
  StepProgressBar,
  StepGuide,
  ApproveModal,
  RejectModal,
  ConnectionTestPanel,
} from './process-status';

// ResourceTable 관련
import {
  ResourceRow,
  RegionGroup,
  FilterTab,
  EmptyState,
  FilterType,
} from './resource-table';

// AdminDashboard 관련
import {
  AdminHeader,
  ServiceSidebar,
  PermissionsPanel,
  ProjectsTable,
} from './admin';
```

### 개별 import

```typescript
import { StepProgressBar } from './process-status/StepProgressBar';
import { ResourceRow } from './resource-table/ResourceRow';
import { ProjectsTable } from './admin/ProjectsTable';
```

---

## 장점

### 1. 유지보수성 향상
- 각 컴포넌트의 역할이 명확해짐
- 변경 시 영향 범위가 줄어듦
- 코드 리뷰가 용이해짐

### 2. 재사용성
- StepProgressBar, StatusIcon 등은 다른 곳에서도 사용 가능
- 모달 컴포넌트 패턴 통일

### 3. 테스트 용이성
- 작은 단위로 분리되어 단위 테스트 작성이 쉬움
- 각 컴포넌트의 Props 인터페이스가 명확

### 4. 성능
- 코드 스플리팅에 유리
- 불필요한 리렌더링 최소화

---

## 주의사항

1. **순환 참조 방지**: index.ts를 통해 내보내기를 관리하여 순환 참조 방지
2. **Props 드릴링**: 필요시 Context나 상태 관리 라이브러리 도입 고려
3. **일관된 네이밍**: 폴더명은 kebab-case, 파일명은 PascalCase 유지
