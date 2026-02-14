# Architecture Decision Records (ADR)

프로젝트의 주요 설계 결정을 기록합니다.

## ADR 목록

| ID | 제목 | 상태 | 날짜 |
|----|------|------|------|
| [ADR-001](./001-process-state-architecture.md) | Data-Driven 프로세스 상태 아키텍처 | 승인됨 | 2026-02-02 |
| [ADR-003](./003-documentation-strategy.md) | 문서 관리 전략 | 승인됨 | 2026-02-02 |
| [ADR-004](./004-process-status-refactoring.md) | processStatus 저장 필드 리팩토링 | 폐기됨 | 2026-02-04 |
| [ADR-006](./006-integration-confirmation-approval-redesign.md) | 연동 확정 승인 프로세스 재설계 | 승인됨 | 2026-02-11 |
| [ADR-007](./007-api-client-pattern.md) | API Client 패턴 도입 | 승인됨 | 2026-02-14 |
| [ADR-008](./008-target-source-process-status-bff.md) | Target Source processStatus를 BFF에서 계산/반환 | 승인됨 | 2026-02-14 |

## ADR 작성 규칙

### 상태
- `제안됨`: 검토 중
- `승인됨`: 적용됨
- `폐기됨`: 다른 결정으로 대체됨
- `대체됨`: 새 ADR로 대체됨 (대체 ADR 링크 포함)

### 템플릿

```markdown
# ADR-XXX: 제목

## 상태
제안됨 / 승인됨 / 폐기됨 / 대체됨

## 맥락
왜 이 결정이 필요한가?

## 결정
무엇을 결정했는가?

## 결과
이 결정으로 인한 영향은?

## 관련 파일
- 영향받는 파일 목록
```
