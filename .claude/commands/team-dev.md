# 팀 개발 모드 (Team Development)

$ARGUMENTS에 대해 팀 기반 개발을 시작합니다.

## 사전 조건

1. 현재 브랜치가 main이 아닌지 확인
2. main이면 worktree 생성:
   ```bash
   git worktree add ../pii-agent-demo-{name} -b feat/{name}
   ```

## 팀 구성

TeamCreate로 팀을 생성합니다. **분석/리뷰 에이전트만 팀원으로** 스폰하고, 구현 에이전트는 태스크별 서브에이전트로 사용합니다.

### 팀원 (Persistent — Phase 간 컨텍스트 유지)

| 에이전트 | subagent_type | 역할 |
|----------|---------------|------|
| ux-expert | ux-expert | UX 분석/제안 (Read-only) |
| code-reviewer | code-reviewer | 종합 코드 리뷰 (Read-only) |

### 서브에이전트 (Per-task — 태스크별 fresh 스폰)

| subagent_type | 역할 | 사용 시점 |
|---------------|------|----------|
| code-implementer | 코드 구현 | Phase 1 분석, Phase 2 구현, Phase 4 수정 |
| designer | UI 디자인/구현 | Phase 1 설계, Phase 2 UI 구현 |

> 구현 에이전트(code-implementer, designer)는 팀원이 아닌 서브에이전트로 사용합니다.
> 태스크별로 Task tool(`team_name` 없이)을 통해 fresh하게 스폰하여 병렬 처리합니다.

## 워크플로우

### Phase 1: 분석 (병렬)
다음 태스크를 **동시에** 실행합니다:
1. **ux-expert** (팀원) — 요구사항의 UX 분석
2. **designer** (서브에이전트) — UI 설계안/목업 작성
3. **code-implementer** (서브에이전트) — 구현 계획 분석 (영향 범위, 필요 타입/API)

### Phase 1.5: 의존성 분석 및 태스크 분할
Phase 1 결과를 기반으로 **team-lead가 직접** 수행:
1. 필요한 구현 태스크 목록 작성 (TaskCreate)
2. 태스크 간 **의존성 분석** (addBlockedBy)
3. **독립적인 태스크 그룹** 식별 → 병렬 실행 대상 결정

의존성 분석 예시:
```
기반 태스크 (순차)
  타입/상수 → Mock/Adapter
독립 태스크 (병렬 가능)
  ├── API Route A
  ├── API Route B
  ├── 컴포넌트 A
  └── 컴포넌트 B
```

### Phase 2: 구현 (의존성 기반 병렬)
1. **기반 태스크** 먼저 실행 (타입, 상수, 어댑터 — 서브에이전트 1개)
2. 기반 완료 후, **독립 태스크들을 병렬 스폰**:
   - 각 태스크마다 별도의 `code-implementer` 서브에이전트 스폰
   - UI 전용 태스크는 `designer` 서브에이전트 스폰
   - 하나의 메시지에서 여러 Task tool을 동시 호출
3. **같은 파일을 수정하는 태스크는 동시에 스폰하지 않음** → 순차 실행

서브에이전트 prompt 필수 포함 정보:
- 구현 대상 태스크의 구체적 설명
- 관련 타입/상수 파일 경로
- 참고할 기존 패턴 (예: "Azure API Route 패턴 참조: `app/api/azure/...`")
- 생성/수정할 파일 경로

### Phase 3: 리뷰 (병렬)
구현 완료 후 다음 2개를 **동시에** 실행:
1. **code-reviewer** (팀원) — 전체 변경사항 종합 리뷰
2. **ux-expert** (팀원) — 구현 결과 UX 검토 (Phase 1 컨텍스트 활용)

### Phase 4: 수정 및 마무리
1. Critical 이슈별로 해당 파일 대상 **code-implementer 서브에이전트** 스폰
2. 독립 이슈는 병렬, 같은 파일 이슈는 순차
3. 이슈 없을 때까지 Phase 3-4 반복
4. 문서화 확인 (docs/ 업데이트)
5. commit & push
6. 팀원(ux-expert, code-reviewer) shutdown

## 태스크 관리

- 모든 작업은 TaskCreate/TaskUpdate로 추적
- 의존성 있는 작업은 addBlockedBy로 연결
- 서브에이전트 완료 시 **team-lead가** TaskUpdate로 completed 처리
- team-lead는 TaskList로 진행 상황 확인하고 다음 병렬 그룹 스폰

## 주의사항

- code-reviewer와 ux-expert는 코드를 수정하지 않습니다
- 모든 Critical 이슈는 다음 phase 진행 전 해결해야 합니다
- 서브에이전트 prompt에 충분한 컨텍스트를 제공합니다
- 같은 파일을 수정하는 서브에이전트를 동시에 스폰하지 않습니다
- broadcast는 긴급 상황에서만 사용합니다
