# Phase 4: 디자인 토큰 시스템

## 개요

이 문서는 Phase 4 리팩토링에서 구축된 디자인 토큰 시스템을 설명합니다.
Look & Feel 변경 시 이 시스템을 통해 일관되게 스타일을 수정할 수 있습니다.

---

## 생성된 파일

```
lib/
  theme.ts            # Tailwind 클래스 매핑 및 헬퍼 함수
app/
  globals.css         # CSS 변수 (디자인 토큰)
```

---

## CSS 디자인 토큰 (globals.css)

### Primary Color (주요 색상)

| 변수 | 값 | 용도 |
|------|----|----|
| `--color-primary` | blue-600 | 버튼, 링크, 강조 |
| `--color-primary-hover` | blue-700 | 호버 상태 |
| `--color-primary-light` | blue-100 | 배경 (선택됨, 정보) |

### Status Colors (상태 색상)

CLAUDE.md 규칙에 따른 상태 색상:

| 변수 | 값 | 용도 |
|------|----|----|
| `--color-status-success` | green-500 | 완료, 연결됨 |
| `--color-status-error` | red-500 | 오류, 연결 끊김 |
| `--color-status-warning` | orange-500 | 진행 중, AWS |
| `--color-status-pending` | gray-400 | 대기 중 |
| `--color-status-info` | blue-500 | 신규 |

### Surface Colors (표면 색상)

| 변수 | 값 | 용도 |
|------|----|----|
| `--color-surface-primary` | white | 카드 배경 |
| `--color-surface-secondary` | gray-50 | 섹션 배경, 테이블 헤더 |
| `--color-surface-tertiary` | gray-100 | 비활성 배경 |

### Border & Text Colors

| 변수 | 값 | 용도 |
|------|----|----|
| `--color-border-default` | gray-200 | 기본 테두리 |
| `--color-border-light` | gray-100 | 연한 테두리, 구분선 |
| `--color-text-primary` | gray-900 | 제목, 본문 |
| `--color-text-secondary` | gray-500 | 보조 텍스트 |
| `--color-text-muted` | gray-400 | 비활성 텍스트 |

### Spacing & Layout

| 변수 | 값 | 용도 |
|------|----|----|
| `--space-card-padding` | 1.5rem (p-6) | 카드 내부 패딩 |
| `--space-section-gap` | 1.5rem (gap-6) | 섹션 간 간격 |
| `--radius-card` | 0.75rem (rounded-xl) | 카드 모서리 |
| `--radius-button` | 0.5rem (rounded-lg) | 버튼 모서리 |

---

## TypeScript 테마 시스템 (lib/theme.ts)

### 컴포넌트 스타일

```typescript
import { buttonStyles, cardStyles, inputStyles } from '@/lib/theme';

// 버튼 스타일
buttonStyles.base        // 'px-4 py-2 rounded-lg font-medium...'
buttonStyles.variants.primary   // 'bg-blue-600 text-white hover:bg-blue-700...'
buttonStyles.variants.secondary // 'bg-gray-100 text-gray-700...'
buttonStyles.variants.danger    // 'bg-red-600 text-white...'

// 카드 스타일
cardStyles.base          // 'bg-white rounded-xl shadow-sm'
cardStyles.padding.default // 'p-6'
cardStyles.header        // 'px-6 py-4 border-b border-gray-100'

// 입력 필드 스타일
inputStyles.base         // 'w-full px-4 py-3 border...'
inputStyles.error        // 'border-red-300 bg-red-50...'
```

### 상태 색상

```typescript
import { statusColors } from '@/lib/theme';

// 성공 상태
statusColors.success.bg    // 'bg-green-100'
statusColors.success.text  // 'text-green-500'
statusColors.success.dot   // 'bg-green-500'

// 에러 상태
statusColors.error.bg      // 'bg-red-100'
statusColors.error.text    // 'text-red-500'

// 경고 상태
statusColors.warning.bg    // 'bg-orange-100'
statusColors.warning.text  // 'text-orange-500'
```

### 헬퍼 함수

```typescript
import { cn, getButtonClass, getInputClass } from '@/lib/theme';

// 클래스 조합
cn('text-gray-900', isActive && 'font-bold', className)
// → 'text-gray-900 font-bold ...'

// 버튼 클래스 생성
getButtonClass('primary', 'md')
// → 'px-4 py-2 rounded-lg font-medium... bg-blue-600 text-white...'

getButtonClass('danger', 'sm')
// → 'px-3 py-1.5 text-sm... bg-red-600 text-white...'

// 입력 필드 클래스 생성
getInputClass()        // 기본 스타일
getInputClass('error') // 에러 스타일
getInputClass('success') // 성공 스타일
```

---

## Look & Feel 변경 가이드

### 1. 주요 색상 변경

파란색 테마를 보라색으로 변경하려면:

**globals.css:**
```css
:root {
  --color-primary: theme('colors.purple.600');
  --color-primary-hover: theme('colors.purple.700');
  --color-primary-light: theme('colors.purple.100');
}
```

**lib/theme.ts:**
```typescript
export const buttonStyles = {
  variants: {
    primary: 'bg-purple-600 text-white hover:bg-purple-700...',
    // ...
  },
};
```

### 2. 모서리 라운딩 변경

더 둥근 스타일로 변경:

```css
:root {
  --radius-card: theme('borderRadius.2xl');
  --radius-button: theme('borderRadius.xl');
}
```

### 3. 그림자 강도 변경

더 강한 그림자:

```css
:root {
  --shadow-card: theme('boxShadow.md');
  --shadow-modal: theme('boxShadow.2xl');
}
```

---

## 타입 정의

```typescript
import type {
  StatusType,
  ButtonVariant,
  ButtonSize,
  CardPadding,
  ModalSize,
} from '@/lib/theme';

// 사용 예
const status: StatusType = 'success';     // 'success' | 'error' | 'warning' | 'pending' | 'info'
const variant: ButtonVariant = 'primary'; // 'primary' | 'secondary' | 'danger' | 'success' | 'ghost'
const size: ButtonSize = 'md';            // 'sm' | 'md' | 'lg'
```

---

## 주요 변경 사항

### blue-500 vs blue-600 통일

- **Before**: `blue-500`과 `blue-600`이 혼용됨
- **After**: Primary color는 `blue-600`으로 통일

### 색상 의미 통일

| 색상 | 의미 | 컴포넌트 |
|------|------|----------|
| `green-500` | 성공/완료/연결됨 | Badge, 상태 표시 |
| `red-500` | 실패/오류/연결 끊김 | Badge, 에러 메시지 |
| `orange-500` | 진행 중/AWS | 설치 진행, AWS 뱃지 |
| `gray-400` | 대기 중/비활성 | Pending 상태 |
| `blue-600` | 주요 액션/강조 | 버튼, 링크 |

---

## 향후 개선 사항

1. **다크 모드 완전 지원**: 현재 기본 구조만 있음
2. **CSS 변수 직접 사용**: 컴포넌트에서 CSS 변수 참조 확대
3. **애니메이션 토큰**: 전환 효과 변수화
