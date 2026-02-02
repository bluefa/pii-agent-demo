# History 공통 컴포넌트 구현 계획

## 개요

Cloud Provider 공통으로 사용할 History 컴포넌트 설계 및 구현

## 현황 분석

### 기존 History 타입 (3가지)

| 타입 | 용도 | 현재 컴포넌트 |
|------|------|--------------|
| ProjectHistory | 승인/반려/리소스 변경 | ❌ 없음 |
| ConnectionTestHistory | 연결 테스트 이력 | ConnectionHistoryTab |
| ScanHistory | 스캔 이력 | ❌ 없음 |

### 공통 패턴

- 테이블 형태의 목록 표시
- 시간순 정렬 (최신순)
- 상세 보기 모달 연동
- 페이지네이션/필터링

## 구현 계획

### Phase 1: 공통 컴포넌트 (ui/)

```
components/ui/
├── HistoryTable/
│   ├── index.ts
│   ├── HistoryTable.tsx      # 제네릭 테이블
│   ├── HistoryRow.tsx        # 행 컴포넌트
│   └── HistoryEmptyState.tsx # 빈 상태
└── Pagination.tsx            # 페이지네이션 (공용)
```

#### HistoryTable Props

```typescript
interface HistoryTableProps<T> {
  items: T[];
  columns: HistoryColumn<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  loading?: boolean;
}

interface HistoryColumn<T> {
  key: string;
  label: string;
  width?: string;
  render: (item: T) => React.ReactNode;
}
```

### Phase 2: 도메인 컴포넌트 (features/)

```
components/features/history/
├── index.ts
├── ProjectHistoryPanel.tsx      # 프로젝트 히스토리 패널
├── ProjectHistoryTable.tsx      # 프로젝트 히스토리 테이블
├── ProjectHistoryFilter.tsx     # 필터 (all/approval/resource)
├── ProjectHistoryDetail.tsx     # 상세 모달
├── ScanHistoryPanel.tsx         # 스캔 히스토리 패널
└── ScanHistoryTable.tsx         # 스캔 히스토리 테이블
```

### Phase 3: 기존 코드 리팩토링

- ConnectionHistoryTab → HistoryTable 사용으로 리팩토링
- ConnectionDetailModal 유지 (도메인 로직 포함)

## 컴포넌트 상세 설계

### 1. HistoryTable (제네릭)

```typescript
// 사용 예시
<HistoryTable
  items={projectHistory}
  columns={[
    { key: 'timestamp', label: '일시', render: (h) => formatDateTime(h.timestamp) },
    { key: 'type', label: '유형', render: (h) => <HistoryTypeBadge type={h.type} /> },
    { key: 'actor', label: '담당자', render: (h) => h.actor.name },
    { key: 'details', label: '상세', render: (h) => <HistoryDetails details={h.details} /> },
  ]}
  keyExtractor={(h) => h.id}
  onRowClick={(h) => modal.open(h)}
/>
```

### 2. ProjectHistoryPanel

```typescript
interface ProjectHistoryPanelProps {
  projectId: string;
  initialHistory?: ProjectHistory[];
}

// 내부 구조
// - 필터 UI (all/approval/resource)
// - HistoryTable
// - Pagination
// - DetailModal
```

### 3. 필터 컴포넌트

```typescript
type HistoryFilter = 'all' | 'approval' | 'resource';

interface ProjectHistoryFilterProps {
  value: HistoryFilter;
  onChange: (filter: HistoryFilter) => void;
}
```

## API 연동

### 기존 API 활용

```typescript
// lib/api.ts에 추가
export const historyApi = {
  getProjectHistory: (projectId: string, params?: HistoryParams) =>
    fetchApi<HistoryResponse>(`/projects/${projectId}/history`, { params }),

  getScanHistory: (projectId: string, params?: PaginationParams) =>
    fetchApi<ScanHistoryResponse>(`/v2/projects/${projectId}/scan/history`, { params }),
};
```

### Hook 추가

```typescript
// hooks/useProjectHistory.ts
export const useProjectHistory = (projectId: string) => {
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [pagination, setPagination] = useState({ limit: 20, offset: 0 });
  // ...
};
```

## 작업 순서

1. [ ] HistoryTable 공통 컴포넌트 구현
2. [ ] Pagination 컴포넌트 구현 (또는 기존 것 확인)
3. [ ] ProjectHistoryPanel 구현
4. [ ] ProjectHistoryFilter 구현
5. [ ] useProjectHistory 훅 구현
6. [ ] ConnectionHistoryTab 리팩토링 (HistoryTable 사용)
7. [ ] ScanHistoryPanel 구현 (선택)

## 예상 파일 변경

### 신규 파일
- `components/ui/HistoryTable/` (3개 파일)
- `components/features/history/` (6개 파일)
- `hooks/useProjectHistory.ts`

### 수정 파일
- `components/features/ConnectionHistoryTab.tsx` (리팩토링)
- `lib/api.ts` (historyApi 추가)

## 고려사항

1. **타입 안전성**: Discriminated Union 패턴 유지
2. **페이지네이션**: 서버 사이드 vs 클라이언트 사이드 결정 필요
3. **권한**: API에서 처리 (기존 로직 활용)
4. **테스트**: 기존 테스트 36개 유지, 새 컴포넌트 테스트 추가

## 질문 사항

1. ProjectHistory UI가 사용될 화면은 어디인가요? (프로젝트 상세?)
2. ScanHistory 패널도 함께 구현할까요?
3. 페이지네이션 방식: 무한 스크롤 vs 페이지 번호?
