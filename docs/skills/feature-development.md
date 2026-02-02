# Skill: 기능 개발 워크플로우

Claude Code가 새 기능을 구현할 때 따르는 프로세스.

## 1. 구현 전

### 1.1 요구사항 확인
- BFF API 명세 확인 (`docs/api/`)
- 기존 코드 패턴 파악 (유사 기능 참고)
- 영향 범위 파악 (타입, 컴포넌트, API)

### 1.2 ADR 필요 여부 판단

**ADR 작성이 필요한 경우:**
- 기존 데이터 모델 변경
- 새로운 아키텍처 패턴 도입
- 여러 선택지 중 하나를 결정

**ADR 불필요한 경우:**
- 단순 CRUD 구현
- 명세대로 구현
- 버그 수정

## 2. 구현 중

### 2.1 파일 생성 순서
```
1. lib/types/*.ts      - 타입 정의
2. lib/constants/*.ts  - 상수 정의
3. lib/mock-*.ts       - Mock 헬퍼 (개발용)
4. app/api/**          - API Routes
5. lib/__tests__/*.ts  - 유닛 테스트
```

### 2.2 코드 규칙
- `CLAUDE.md` 코딩 규칙 준수
- 기존 패턴과 일관성 유지
- 타입 안전성 확보 (any 금지)

## 3. 구현 후

### 3.1 검증
```bash
# 유닛 테스트 실행
npm run test

# 타입 체크
npm run type-check

# (선택) 빌드 확인
npm run build
```

### 3.2 문서 업데이트

**항상 업데이트:**
- `docs/api-routes/README.md` - 새 API 엔드포인트 추가

**조건부 업데이트:**
- `docs/api/providers/*.md` - BFF 명세 변경 시 구현 상태 갱신
- `docs/adr/*.md` - 설계 결정 시 ADR 작성
- `CLAUDE.md` TODO - 주요 기능 완료 시

### 3.3 커밋
```bash
# 커밋 메시지 형식
<type>: <description>

# types: feat, fix, refactor, docs, test, chore
# 예: feat: Add Azure installation status API
```

## 4. 체크리스트

```markdown
## 구현 체크리스트
- [ ] BFF API 명세 확인
- [ ] 타입 정의 완료
- [ ] API Routes 구현
- [ ] 유닛 테스트 작성 및 통과
- [ ] docs/api-routes/README.md 업데이트
- [ ] (필요시) ADR 작성
- [ ] 커밋 및 푸시
```

## 예시: Azure API 구현

```
1. docs/api/providers/azure.md 확인
2. lib/types/azure.ts 생성
3. lib/constants/azure.ts 생성
4. lib/mock-azure.ts 생성
5. app/api/azure/** 구현 (7개 엔드포인트)
6. lib/__tests__/mock-azure.test.ts 작성 (25개 테스트)
7. docs/api-routes/README.md에 Azure 섹션 추가
8. ADR-001, ADR-002 작성 (설계 결정 기록)
9. CLAUDE.md TODO 업데이트
```
