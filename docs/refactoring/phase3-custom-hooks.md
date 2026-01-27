# Phase 3: 커스텀 훅 시스템

## 개요

이 문서는 Phase 3 리팩토링에서 생성 및 적용된 커스텀 훅들의 사용법을 설명합니다.

---

## 생성된 파일

```
app/hooks/
  useAsync.ts         # (기존) 비동기 작업 훅
  useModal.ts         # (신규) 모달 상태 관리 훅
  useApiMutation.ts   # (신규) API mutation 훅
```

---

## useModal 훅

### 파일 위치
`app/hooks/useModal.ts`

### 반환 값

| 속성 | 타입 | 설명 |
|------|------|------|
| `isOpen` | `boolean` | 모달 열림 상태 |
| `data` | `T \| undefined` | 모달에 전달된 데이터 |
| `open` | `(data?: T) => void` | 모달 열기 |
| `close` | `() => void` | 모달 닫기 |
| `toggle` | `() => void` | 모달 토글 |

### 사용 예시

```typescript
import { useModal } from '@/app/hooks/useModal';

// 기본 사용 (데이터 없음)
const confirmModal = useModal();

<button onClick={confirmModal.open}>확인</button>
<Modal isOpen={confirmModal.isOpen} onClose={confirmModal.close}>
  확인하시겠습니까?
</Modal>

// 데이터와 함께 사용
interface User {
  id: string;
  name: string;
}

const detailModal = useModal<User>();

<button onClick={() => detailModal.open(user)}>상세보기</button>
{detailModal.data && (
  <Modal isOpen={detailModal.isOpen} onClose={detailModal.close}>
    <p>이름: {detailModal.data.name}</p>
  </Modal>
)}
```

### 마이그레이션 가이드

**Before (4줄):**
```typescript
const [showModal, setShowModal] = useState(false);
const [selectedItem, setSelectedItem] = useState<Item | null>(null);

// 열기
setSelectedItem(item);
setShowModal(true);

// 닫기
setShowModal(false);
setSelectedItem(null);
```

**After (1줄):**
```typescript
const modal = useModal<Item>();

// 열기
modal.open(item);

// 닫기
modal.close();
```

---

## useApiMutation 훅

### 파일 위치
`app/hooks/useApiMutation.ts`

### 옵션

| 옵션 | 타입 | 설명 |
|------|------|------|
| `onSuccess` | `(result, data) => void` | 성공 시 콜백 |
| `onError` | `(error, data) => void` | 에러 시 콜백 |
| `errorMessage` | `string` | 에러 시 기본 메시지 |
| `suppressAlert` | `boolean` | alert 비활성화 |

### 반환 값

| 속성 | 타입 | 설명 |
|------|------|------|
| `loading` | `boolean` | 로딩 상태 |
| `error` | `Error \| null` | 에러 객체 |
| `mutate` | `(data: TData) => Promise<TResult>` | mutation 실행 |
| `reset` | `() => void` | 상태 초기화 |

### 사용 예시

```typescript
import { useApiMutation } from '@/app/hooks/useApiMutation';

// 기본 사용
const { mutate: createProject, loading } = useApiMutation(
  (data: CreateProjectInput) => api.createProject(data),
  {
    onSuccess: (result) => {
      setProjects([...projects, result]);
      closeModal();
    },
    errorMessage: '프로젝트 생성에 실패했습니다.',
  }
);

const handleSubmit = () => {
  createProject({ name: projectName });
};

<button onClick={handleSubmit} disabled={loading}>
  {loading ? '생성 중...' : '생성'}
</button>
```

### 마이그레이션 가이드

**Before (15줄):**
```typescript
const [submitting, setSubmitting] = useState(false);

const handleApprove = async () => {
  try {
    setSubmitting(true);
    const updated = await approveProject(project.id, comment);
    onProjectUpdate?.(updated);
    setShowApproveModal(false);
    setApproveComment('');
  } catch (err) {
    alert(err instanceof Error ? err.message : '승인에 실패했습니다.');
  } finally {
    setSubmitting(false);
  }
};
```

**After (10줄):**
```typescript
const { mutate: doApprove, loading: approving } = useApiMutation(
  (comment: string) => approveProject(project.id, comment),
  {
    onSuccess: (updated) => {
      onProjectUpdate?.(updated);
      approveModal.close();
      setApproveComment('');
    },
    errorMessage: '승인에 실패했습니다.',
  }
);

const handleApprove = () => doApprove(approveComment);
```

---

## useApiAction 훅

파라미터 없는 API 호출을 위한 단순화된 훅입니다.

### 사용 예시

```typescript
import { useApiAction } from '@/app/hooks/useApiMutation';

const { execute: runTest, loading: testLoading } = useApiAction(
  () => runConnectionTest(projectId),
  {
    onSuccess: (result) => setTestResult(result),
    errorMessage: '연결 테스트에 실패했습니다.',
  }
);

<button onClick={runTest} disabled={testLoading}>
  {testLoading ? '테스트 중...' : 'Test Connection'}
</button>
```

---

## useAsync 훅 (기존)

### 파일 위치
`app/hooks/useAsync.ts`

### 사용 예시

```typescript
import { useAsync } from '@/app/hooks/useAsync';

const { loading, error, execute } = useAsync(
  async (userId: string) => {
    const response = await fetch(`/api/users/${userId}`);
    return response.json();
  },
  {
    onSuccess: (user) => setUser(user),
    errorMessage: '사용자 정보를 불러오는데 실패했습니다.',
  }
);

// 실행
execute('user-123');
```

---

## 변경된 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `ConnectionHistoryTab.tsx` | useModal 적용 (selectedHistory 상태 제거) |
| `ProcessStatusCard.tsx` | useModal, useApiMutation 적용 (4개 모달 + 2개 API 호출) |

---

## 코드 라인 수 감소

### ProcessStatusCard.tsx

| 항목 | Before | After |
|------|--------|-------|
| 모달 상태 | 4개 useState + 1개 데이터 상태 | 4개 useModal |
| API 핸들러 | 2개 try-catch-finally (각 15줄) | 2개 useApiMutation (각 10줄) |
| 총 감소 | - | 약 20줄 감소 |

---

## 추가 적용 대상 (향후 작업)

다음 파일들에 추가로 훅을 적용할 수 있습니다:

1. **AdminDashboard.tsx**
   - 4개 try-catch 패턴 → useApiMutation

2. **ProjectDetail.tsx**
   - 3개 try-catch 패턴 → useApiMutation/useAsync

3. **TestConnectionTab.tsx**
   - 1개 try-catch 패턴 → useApiMutation
