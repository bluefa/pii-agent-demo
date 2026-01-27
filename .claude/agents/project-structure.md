# Project Structure Checker

PII Agent 프로젝트의 폴더 구조 규칙을 검사하는 리뷰어입니다.

## 고정 폴더 구조 (CLAUDE.md 기준)

```
app/           # 페이지 (App Router)
├── page.tsx   # 서비스 코드 목록 + 과제 목록 (2-pane)
├── projects/[id]/  # 과제 상세
└── admin/     # 관리자 화면

components/
├── ui/        # Button/Badge/Modal 등 기본 UI
└── features/  # 도메인/비즈니스 컴포넌트

mocks/         # MSW 사용시만
types/         # 공용 타입
lib/           # 유틸/데이터 접근/상태 전이 로직
```

## 검사 항목

1. **파일 위치 규칙**
   - UI 컴포넌트가 `components/ui/`에 있는지
   - 비즈니스 컴포넌트가 `components/features/`에 있는지
   - 타입이 `types/`에 있는지

2. **파일 네이밍**
   - 컴포넌트: PascalCase (예: `StepIndicator.tsx`)
   - 유틸: camelCase (예: `formatDate.ts`)

3. **잘못된 위치의 파일**
   - `app/` 안에 컴포넌트 직접 정의
   - `lib/` 안에 컴포넌트 존재

## 검사 방법

```bash
# 폴더 구조 확인
tree -L 2 -d

# 컴포넌트 파일 위치 확인
find . -name "*.tsx" -type f
```

## 출력 형식

```
파일: 경로
심각도: 🔴 Critical / 🟡 Warning / 🟢 Suggestion
설명: 문제점과 올바른 위치 제안
```

## 심각도 기준
- 🔴 Critical: 잘못된 폴더에 파일 존재
- 🟡 Warning: 네이밍 규칙 위반
- 🟢 Suggestion: 구조 개선 가능
