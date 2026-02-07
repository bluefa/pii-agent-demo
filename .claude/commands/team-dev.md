# 팀 개발 모드 (Team Development)

$ARGUMENTS에 대해 팀 기반 개발을 시작합니다.

## 사전 조건

1. 현재 브랜치가 main이 아닌지 확인
2. main이면 worktree 생성:
   ```bash
   git worktree add ../pii-agent-demo-{name} -b feat/{name}
   ```

## 팀 구성

TeamCreate로 팀을 생성하고, Task tool로 4명의 에이전트를 스폰합니다:

| 에이전트 | subagent_type | 역할 | 접근 권한 |
|----------|---------------|------|----------|
| code-reviewer | code-reviewer | 종합 코드 리뷰 | Read-only |
| code-implementer | code-implementer | 코드 구현 | Full |
| designer | designer | UI 디자인/구현 | Full |
| ux-expert | ux-expert | UX 분석/제안 | Read-only |

## 워크플로우

### Phase 1: 분석 (병렬)
다음 3개 태스크를 **동시에** 생성하고 할당합니다:
1. **ux-expert** — 요구사항의 UX 분석 (사용자 플로우, 인터랙션 패턴)
2. **designer** — UI 설계안/목업 작성 (theme.ts 기반)
3. **code-implementer** — 구현 계획 분석 (영향 범위, 필요 타입/API, 기존 코드 파악)

### Phase 2: 구현 (순차/병렬)
1. Phase 1 결과를 취합하여 구현 방향 결정
2. **code-implementer**에게 핵심 로직 구현 할당
3. **designer**에게 UI 컴포넌트 병렬 구현 할당 (독립 파일인 경우)
4. 같은 파일 수정이 필요하면 순차 실행

### Phase 3: 리뷰 (병렬)
구현 완료 후 다음 2개 태스크를 **동시에** 실행:
1. **code-reviewer** — 전체 변경사항 종합 리뷰
2. **ux-expert** — 구현 결과 UX 검토

### Phase 4: 수정 및 마무리
1. Critical 이슈가 있으면 **code-implementer**에게 수정 요청
2. 이슈 없을 때까지 Phase 2-3 반복
3. 문서화 확인 (docs/ 업데이트)
4. commit & push
5. 팀원 shutdown

## 태스크 관리

- 모든 작업은 TaskCreate/TaskUpdate로 추적
- 의존성 있는 작업은 addBlockedBy로 연결
- 각 에이전트는 완료 시 TaskUpdate로 completed 처리
- Leader는 TaskList로 진행 상황 확인

## 주의사항

- code-reviewer와 ux-expert는 코드를 수정하지 않습니다
- 모든 Critical 이슈는 다음 phase 진행 전 해결해야 합니다
- 팀원 간 직접 DM(SendMessage) 사용을 권장합니다
- broadcast는 긴급 상황에서만 사용합니다
- 구현 중 아키텍처 변경이 필요하면 Leader에게 보고합니다
