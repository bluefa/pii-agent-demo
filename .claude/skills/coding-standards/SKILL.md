---
name: coding-standards
description: 코드 작성 시 따르는 코딩 규칙과 패턴. 컴포넌트, 훅, API, 타입 작성 시 자동 적용.
---

# PII Agent 코딩 규칙

코드 작성 시 반드시 따르는 규칙입니다.

## 1. 파일 및 명명 규칙

### 파일명
- 컴포넌트: **PascalCase** (`StepIndicator.tsx`, `ResourceTable.tsx`)
- 훅/유틸: **camelCase** (`useModal.ts`, `date.ts`)
- 타입: **PascalCase** (`Project.ts`, `Resource.ts`)

### 코드 명명
- 함수: **arrow function** 사용
- Props: **interface**로 정의
- 상수: **UPPER_SNAKE_CASE**

```typescript
// Good
interface ButtonProps {
  variant: 'primary' | 'secondary';
  onClick: () => void;
}

const Button = ({ variant, onClick }: ButtonProps) => {
  return <button onClick={onClick}>{variant}</button>;
};

// Bad
type ButtonProps = { ... }  // interface 사용
function Button(props) { ... }  // arrow function 사용
```

## 2. Import 규칙

### 절대 경로 필수
```typescript
// Good
import { Button } from '@/app/components/ui/Button';
import { Project } from '@/lib/types';
import { useModal } from '@/hooks/useModal';

// Bad
import { Button } from '../../../components/ui/Button';
import { Project } from '../../lib/types';
```

### Import 순서
```typescript
// 1. React/Next.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 2. 외부 라이브러리
import { format } from 'date-fns';

// 3. 내부 컴포넌트/훅
import { Button } from '@/app/components/ui/Button';
import { useModal } from '@/hooks/useModal';

// 4. 타입
import type { Project } from '@/lib/types';
```

## 3. 타입 안전성

### any 금지
```typescript
// Good
const handleData = (data: ProjectData) => { ... };

// Bad
const handleData = (data: any) => { ... };
```

### 타입 가드 활용
```typescript
// Provider별 분기 처리
if (resource.provider === 'AWS') {
  // resource.metadata는 AwsMetadata 타입
}
```

## 4. 커스텀 훅 활용

### 모달 상태: useModal()
```typescript
// Good
const { isOpen, open, close } = useModal();

// Bad
const [isOpen, setIsOpen] = useState(false);
const open = () => setIsOpen(true);
const close = () => setIsOpen(false);
```

### API Mutation: useApiMutation()
```typescript
// Good
const { mutate, isLoading, error } = useApiMutation('/api/projects');

// Bad
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState(null);
try { ... } catch (e) { ... } finally { ... }
```

## 5. 스타일링 규칙

### Tailwind 직접 사용
```typescript
// Good
<div className="flex items-center gap-4 p-4 bg-white rounded-lg">

// Bad
<div className={styles.container}>  // CSS 모듈 지양
```

### 상태별 색상 (theme.ts 참조)
- 연결됨/완료: `green-500`
- 끊김/에러: `red-500`
- 신규: `blue-500`
- 진행중: `orange-500`
- 대기중: `gray-400`
- Primary (버튼/링크): `blue-600`

## 6. 컴포넌트 구조

### 300줄 이상 → 폴더로 분리
```
components/features/
├── resource-table/
│   ├── index.ts          # 내보내기
│   ├── ResourceTable.tsx # 메인 컴포넌트
│   ├── ResourceRow.tsx   # 하위 컴포넌트
│   └── useResourceFilter.ts
```

### Props 정의
```typescript
interface ResourceTableProps {
  resources: Resource[];
  onSelect: (id: string) => void;
  isLoading?: boolean;  // optional은 마지막에
}
```

## 7. API Routes 규칙

### BFF 명세 준수
- API Routes는 `docs/api/` 명세를 따라 구현
- 응답 형식은 BFF API와 동일하게

### mock 용어 금지
```typescript
// Good
const projectData = { ... };

// Bad (lib/mock-*.ts 파일은 예외)
const mockProject = { ... };
```

## 8. 피해야 할 패턴

- CSS 파일 생성 (Tailwind 사용)
- 반응형 스타일 (Desktop only)
- 불필요한 추상화
- try-catch-finally 직접 작성 (훅 사용)
- 상대 경로 import
