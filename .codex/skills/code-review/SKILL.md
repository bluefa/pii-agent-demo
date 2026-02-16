---
name: code-review
description: 코드 리뷰 요청 시 프로젝트 규칙에 맞게 검토. 리뷰, 검토, 확인 요청 시 사용.
context: fork
agent: Explore
---

# PII Agent 코드 리뷰 가이드

코드 리뷰 시 확인하는 체크리스트입니다.

## 리뷰 순서

1. **규칙 위반 확인** (Critical)
2. **패턴 일관성 확인** (Major)
3. **개선 제안** (Minor)

---

## 1. Critical: 규칙 위반 체크

### 1.1 타입 안전성
- [ ] `any` 타입 사용 여부
- [ ] 타입 단언(`as`) 남용 여부
- [ ] undefined/null 처리 누락

```typescript
// 위반 예시
const data = response as any;
const item = list.find(x => x.id === id);  // undefined 처리 필요
```

### 1.2 Import 규칙
- [ ] 상대 경로(`../`) 사용 여부
- [ ] 절대 경로(`@/`) 미사용

```typescript
// 위반
import { Button } from '../../../components/ui/Button';

// 올바름
import { Button } from '@/app/components/ui/Button';
```

### 1.3 명명 규칙
- [ ] 컴포넌트 파일: PascalCase인가?
- [ ] Props: interface로 정의했는가?
- [ ] 함수: arrow function인가?

### 1.4 금지 패턴
- [ ] CSS 파일 생성
- [ ] 반응형 스타일
- [ ] mock 변수명 (lib/mock-*.ts 제외)

---

## 2. Major: 패턴 일관성

### 2.1 훅 사용
- [ ] 모달 상태: `useModal()` 사용하는가?
- [ ] API 호출: `useApiMutation()` 사용하는가?
- [ ] try-catch-finally 직접 작성 여부

```typescript
// 권장
const { isOpen, open, close } = useModal();
const { mutate, isLoading } = useApiMutation('/api/...');

// 비권장
const [isOpen, setIsOpen] = useState(false);
try { await fetch(...) } catch { ... } finally { ... }
```

### 2.2 컴포넌트 구조
- [ ] 300줄 초과 시 분리 검토했는가?
- [ ] Props interface 정의 위치가 적절한가?

### 2.3 스타일링
- [ ] Tailwind 클래스 직접 사용하는가?
- [ ] 상태별 색상이 theme.ts와 일치하는가?
  - 완료: `green-500`
  - 에러: `red-500`
  - 진행중: `orange-500`
  - Primary: `blue-600`

---

## 3. Minor: 개선 제안

### 3.1 코드 품질
- 불필요한 re-render 가능성
- 중복 코드 추출 가능 여부
- 변수/함수명 명확성

### 3.2 타입 개선
- Union 타입 활용 가능 여부
- Discriminated Union 적용 가능 여부

### 3.3 문서화
- 복잡한 로직에 주석 필요 여부
- docs/ 업데이트 필요 여부

---

## 리뷰 결과 형식

```markdown
## 코드 리뷰 결과

### Critical (수정 필수)
- [ ] `file.ts:123` - any 타입 사용

### Major (권장)
- [ ] `Component.tsx:45` - useModal 훅 미사용

### Minor (선택)
- [ ] `utils.ts:67` - 함수명 개선 제안: `formatDate` → `formatKoreanDate`

### 통과 항목
- Import 규칙 준수
- 명명 규칙 준수
- 스타일링 규칙 준수
```

---

## GitHub PR 리뷰 등록

PR URL/번호가 주어졌다면 로컬 분석 결과만 전달하지 말고, 반드시 PR에 리뷰를 등록합니다.

- [ ] 기본 상태는 `COMMENT`로 등록했는가?
- [ ] 머지 차단 수준 이슈가 있으면 `REQUEST_CHANGES`로 등록했는가?
- [ ] 리뷰 본문에 심각도 + `file:line` 근거를 포함했는가?
- [ ] 등록 후 최신 리뷰가 실제 반영됐는지 확인했는가?

```bash
# 코멘트 리뷰
gh pr review <pr-number-or-url> --repo <owner/repo> --comment --body-file /tmp/review.md

# 변경 요청 리뷰(차단 이슈 존재 시)
gh pr review <pr-number-or-url> --repo <owner/repo> --request-changes --body-file /tmp/review.md

# 등록 확인
gh pr view <pr-number-or-url> --repo <owner/repo> --json url,reviews
```

사용자가 "로컬 리뷰만"을 명시한 경우에만 PR 등록을 생략합니다.

---

## API 코드 추가 체크

API Routes 코드의 경우 추가 확인:

- [ ] BFF API 명세(`docs/api/`)와 일치하는가?
- [ ] 응답 형식이 명세와 동일한가?
- [ ] `docs/api/*.md` 명세를 업데이트했는가?
- [ ] 테스트 작성했는가?

### API Client 패턴 (ADR-007)
- [ ] `app/api/route.ts`가 `client.method()` 디스패치만 수행하는가?
- [ ] Mock 비즈니스 로직이 `lib/api-client/mock/*.ts`에 위치하는가?
