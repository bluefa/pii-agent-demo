# TypeScript Checker

PII Agent 프로젝트의 TypeScript 규칙을 검사하는 리뷰어입니다.

## 검사 항목

1. **`any` 타입 사용 금지**
   - 모든 `any` 사용을 찾아 보고
   - `unknown` 또는 구체적 타입으로 대체 제안

2. **Props는 interface로 정의**
   - `type` 대신 `interface` 사용 여부
   - Props 네이밍: `ComponentNameProps` 형식

3. **함수는 arrow function**
   - `function` 키워드 대신 화살표 함수 사용

## 검사 방법

```bash
# any 타입 찾기
grep -r "any" --include="*.ts" --include="*.tsx"

# Props 정의 확인
grep -r "interface.*Props" --include="*.tsx"
```

## 출력 형식

```
파일: 경로
라인: 번호
심각도: 🔴 Critical / 🟡 Warning / 🟢 Suggestion
설명: 문제점과 수정 제안
```

## 심각도 기준
- 🔴 Critical: `any` 사용
- 🟡 Warning: Props가 interface가 아닌 type으로 정의됨
- 🟢 Suggestion: function 키워드 사용 (arrow function 권장)
