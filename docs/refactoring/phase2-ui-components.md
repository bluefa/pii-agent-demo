# Phase 2: 공통 UI 컴포넌트

## 개요

이 문서는 Phase 2 리팩토링에서 생성된 재사용 가능한 UI 컴포넌트들의 사용법을 설명합니다.

---

## 생성된 파일

```
app/components/ui/
  Modal.tsx           # 재사용 모달
  Badge.tsx           # 상태 뱃지
  Card.tsx            # 카드 래퍼
  Table.tsx           # 재사용 테이블
```

---

## Modal 컴포넌트

### 파일 위치
`app/components/ui/Modal.tsx`

### Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `isOpen` | `boolean` | 필수 | 모달 표시 여부 |
| `onClose` | `() => void` | 필수 | 닫기 콜백 |
| `title` | `string` | 필수 | 모달 제목 |
| `subtitle` | `string` | - | 부제목 |
| `icon` | `ReactNode` | - | 헤더 아이콘 |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl' \| '2xl'` | `'md'` | 모달 크기 |
| `children` | `ReactNode` | 필수 | 모달 내용 |
| `footer` | `ReactNode` | - | 푸터 영역 |
| `closeOnBackdropClick` | `boolean` | `true` | 배경 클릭으로 닫기 |
| `closeOnEscape` | `boolean` | `true` | ESC 키로 닫기 |

### 사용 예시

```typescript
import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';

const [showModal, setShowModal] = useState(false);

<Modal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  title="새 프로젝트 생성"
  subtitle="PII Agent 설치 과제를 생성합니다"
  icon={
    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  }
  size="lg"
  footer={
    <>
      <Button variant="secondary" onClick={() => setShowModal(false)}>
        취소
      </Button>
      <Button onClick={handleSubmit}>
        생성
      </Button>
    </>
  }
>
  <form className="space-y-4">
    <input type="text" placeholder="프로젝트 이름" />
  </form>
</Modal>
```

### 기존 모달 마이그레이션

**Before:**
```typescript
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
    <div className="px-6 py-4 border-b">
      <h3>제목</h3>
      <button onClick={onClose}>X</button>
    </div>
    <div className="p-6">{/* content */}</div>
    <div className="px-6 py-4 border-t">{/* buttons */}</div>
  </div>
</div>
```

**After:**
```typescript
<Modal
  isOpen={isOpen}
  onClose={onClose}
  title="제목"
  footer={<Button onClick={onClose}>닫기</Button>}
>
  {/* content */}
</Modal>
```

---

## Badge 컴포넌트

### 파일 위치
`app/components/ui/Badge.tsx`

### Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `variant` | `BadgeVariant` | `'neutral'` | 뱃지 스타일 |
| `size` | `'sm' \| 'md'` | `'sm'` | 뱃지 크기 |
| `dot` | `boolean` | `false` | 상태 점 표시 |
| `children` | `ReactNode` | 필수 | 뱃지 내용 |
| `className` | `string` | `''` | 추가 CSS |

### Variant 종류

| Variant | 색상 | 용도 |
|---------|------|------|
| `success` | 초록 | 성공, 완료, 연결됨 |
| `error` | 빨강 | 오류, 실패, 연결 끊김 |
| `warning` | 주황 | 경고, 설치 중 |
| `pending` | 노랑 | 대기 중 |
| `info` | 파랑 | 정보, 신규 |
| `neutral` | 회색 | 기본 |
| `aws` | 주황 | AWS 클라우드 |
| `idc` | 회색 | IDC |

### 사용 예시

```typescript
import { Badge } from '@/app/components/ui/Badge';

// 기본 사용
<Badge variant="success">완료</Badge>
<Badge variant="error">오류</Badge>
<Badge variant="warning">설치 중</Badge>

// 상태 점 포함
<Badge variant="success" dot>연결됨</Badge>
<Badge variant="error" dot>연결 끊김</Badge>

// 클라우드 프로바이더
<Badge variant="aws">AWS</Badge>
<Badge variant="idc">IDC</Badge>

// 크기 조절
<Badge variant="info" size="md">NEW</Badge>
```

### 마이그레이션 가이드

**Before:**
```typescript
<span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
  status === 'SUCCESS'
    ? 'bg-green-100 text-green-800'
    : 'bg-red-100 text-red-800'
}`}>
  {status}
</span>
```

**After:**
```typescript
<Badge variant={status === 'SUCCESS' ? 'success' : 'error'}>
  {status}
</Badge>
```

---

## Card 컴포넌트

### 파일 위치
`app/components/ui/Card.tsx`

### Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `title` | `string` | - | 카드 제목 |
| `headerAction` | `ReactNode` | - | 헤더 우측 액션 |
| `children` | `ReactNode` | 필수 | 카드 내용 |
| `padding` | `'none' \| 'sm' \| 'default' \| 'lg'` | `'default'` | 패딩 |
| `className` | `string` | `''` | 추가 CSS |
| `flat` | `boolean` | `false` | 그림자 없는 플랫 스타일 |

### 사용 예시

```typescript
import { Card } from '@/app/components/ui/Card';

// 기본 사용
<Card>
  <p>카드 내용</p>
</Card>

// 제목과 헤더 액션
<Card
  title="프로젝트 목록"
  headerAction={<Button size="sm">새 프로젝트</Button>}
>
  <ProjectList />
</Card>

// 패딩 없음 (테이블용)
<Card title="리소스" padding="none">
  <table className="w-full">...</table>
</Card>
```

---

## Table 컴포넌트

### 파일 위치
`app/components/ui/Table.tsx`

### Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `data` | `T[]` | 필수 | 테이블 데이터 |
| `columns` | `TableColumn<T>[]` | 필수 | 컬럼 정의 |
| `keyExtractor` | `(item: T, index: number) => string` | 필수 | 키 추출 함수 |
| `onRowClick` | `(item: T, index: number) => void` | - | 행 클릭 핸들러 |
| `emptyMessage` | `string` | `'데이터가 없습니다.'` | 빈 상태 메시지 |
| `emptyIcon` | `ReactNode` | - | 빈 상태 아이콘 |
| `rowClassName` | `(item: T, index: number) => string` | - | 행 CSS 함수 |
| `hoverable` | `boolean` | `true` | 호버 효과 |

### TableColumn 타입

```typescript
interface TableColumn<T> {
  key: string;                              // 고유 키
  header: ReactNode;                        // 헤더 내용
  render: (item: T, index: number) => ReactNode;  // 셀 렌더링
  className?: string;                       // 셀 CSS
  headerClassName?: string;                 // 헤더 CSS
}
```

### 사용 예시

```typescript
import { Table, TableColumn } from '@/app/components/ui/Table';

interface User {
  id: string;
  name: string;
  email: string;
}

const columns: TableColumn<User>[] = [
  {
    key: 'name',
    header: '이름',
    render: (user) => <span className="font-medium">{user.name}</span>,
  },
  {
    key: 'email',
    header: '이메일',
    render: (user) => user.email,
  },
  {
    key: 'actions',
    header: '',
    render: (user) => (
      <Button size="sm" onClick={() => editUser(user)}>
        수정
      </Button>
    ),
    className: 'text-right',
  },
];

<Table
  data={users}
  columns={columns}
  keyExtractor={(user) => user.id}
  onRowClick={(user) => selectUser(user)}
  emptyMessage="등록된 사용자가 없습니다."
/>
```

---

## 변경된 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `ConnectionDetailModal.tsx` | Badge 컴포넌트 사용 |
| `ConnectionHistoryTab.tsx` | Badge 컴포넌트 사용 |

---

## 추가 마이그레이션 대상 (향후 작업)

다음 파일들은 추가로 공통 컴포넌트로 마이그레이션할 수 있습니다:

1. **ProcessStatusCard.tsx**
   - 승인/반려 모달 → Modal 컴포넌트

2. **ProjectCreateModal.tsx**
   - 기존 모달 구조 → Modal 컴포넌트

3. **TerraformStatusModal.tsx**
   - 기존 모달 구조 → Modal 컴포넌트

4. **AdminDashboard.tsx**
   - CloudProviderBadge → Badge 컴포넌트
   - 상태 뱃지들 → Badge 컴포넌트
