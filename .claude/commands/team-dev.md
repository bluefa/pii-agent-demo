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

| subagent_type | 역할 | skills (자동 적용) | 사용 시점 |
|---------------|------|-------------------|----------|
| code-implementer | 코드 구현 | feature-development, coding-standards | Phase 2 구현, Phase 4 수정 |
| designer | UI 디자인/구현 | frontend-design, coding-standards | Phase 1 설계, Phase 2 UI 구현 |

> 서브에이전트는 frontmatter의 skills 필드를 통해 프로젝트 규칙을 자동 참조합니다.
> team-lead가 prompt에 규칙을 반복할 필요 없이 **태스크 맥락만 전달**하면 됩니다.

## 워크플로우

### Phase 0: 요구사항 정렬 (⛔ 스킵 금지)

team-lead가 **직접** 수행합니다:

1. **사전 질문** — AskUserQuestion으로 다음을 확인:
   - 작업 범위 (어떤 Provider/기능까지?)
   - 톤/스타일 기대치 (운영 수준? 데모 수준? 특정 참조?)
   - 우선순위 (품질 vs 속도)

2. **콘텐츠 선행 판단** — 가이드/문서/텍스트가 포함된 작업인지 확인:
   - **Yes** → 콘텐츠 문서(`docs/design/`)를 먼저 작성 → 사용자 확인 → 구현
   - **No** → Phase 1로 진행

> 콘텐츠 없이 구현에 돌입하면 텍스트 재작업이 반복됩니다.
> "콘텐츠 확정 → 구현"이 항상 "구현 → 콘텐츠 수정"보다 효율적입니다.

### Phase 1: 분석 + UX 사전 검토 (병렬)

다음 태스크를 **동시에** 실행합니다:
1. **ux-expert** (팀원) — 요구사항의 UX 분석 + **UI 목업 수준 제안**
2. **designer** (서브에이전트) — UI 설계안/목업 작성
3. **code-implementer** (서브에이전트) — 구현 계획 분석 (영향 범위, 필요 타입/API)

Phase 1 결과를 사용자에게 공유하고 **방향 확인**을 받습니다.

> 구현 전에 UX/디자인 방향을 확인해야 아이콘/스타일/레이아웃 재작업을 방지합니다.

### Phase 1.5: 의존성 분석 및 태스크 분할

Phase 1 결과를 기반으로 **team-lead가 직접** 수행:

1. TaskCreate로 구현 태스크 목록 작성 (**구조화된 description** 필수):
   ```
   ## scope
   생성: lib/types/process-guide.ts
   수정: app/components/features/ProcessStatusCard.tsx

   ## context
   참조 패턴: app/components/features/process-status/StepProgressBar.tsx
   참조 타입: lib/types/index.ts (ProcessStatus, CloudProvider)

   ## criteria
   - ProcessGuideStep, ProviderProcessGuide 타입 정의
   - npx tsc --noEmit 통과
   ```
2. 태스크 간 **의존성 분석** (addBlockedBy)
3. **독립적인 태스크 그룹** 식별 → 병렬 실행 대상 결정

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
- TaskGet으로 가져온 태스크 description (scope/context/criteria)
- worktree 경로 (code가 있는 실제 디렉토리)

> 서브에이전트는 skills(coding-standards, feature-development)를 자동 참조하므로
> 프로젝트 규칙(import 경로, theme.ts, any 금지 등)을 prompt에 반복하지 않습니다.

### Phase 3: 리뷰 (병렬)

구현 완료 후 다음 2개를 **동시에** 실행:
1. **code-reviewer** (팀원) — 전체 변경사항 종합 리뷰
2. **ux-expert** (팀원) — 구현 결과 UX 검토 (Phase 1 컨텍스트 활용)

### Phase 4: 수정 및 마무리

1. **소규모 수정 (1-2 파일, ~30줄 이하)** → team-lead가 직접 수행
2. **대규모 수정** → Critical 이슈별 code-implementer 서브에이전트 스폰
3. 독립 이슈는 병렬, 같은 파일 이슈는 순차
4. 이슈 없을 때까지 Phase 3-4 반복
5. 문서화 확인 (docs/ 업데이트)
6. commit & push
7. 팀원(ux-expert, code-reviewer) shutdown

## 태스크 관리

- 모든 작업은 TaskCreate/TaskUpdate로 추적
- 의존성 있는 작업은 addBlockedBy로 연결
- 서브에이전트 완료 시 **team-lead가** TaskUpdate로 completed 처리
- team-lead는 TaskList로 진행 상황 확인하고 다음 병렬 그룹 스폰

### 태스크 description 구조

모든 TaskCreate는 아래 구조를 따릅니다:
```
## scope
생성/수정할 파일 경로

## context
참조할 기존 패턴 파일 경로

## criteria
완료 조건 (구체적, 검증 가능)
```

이 description이 서브에이전트 prompt의 핵심이 됩니다.

## 주의사항

- code-reviewer와 ux-expert는 코드를 수정하지 않습니다
- 모든 Critical 이슈는 다음 phase 진행 전 해결해야 합니다
- 같은 파일을 수정하는 서브에이전트를 동시에 스폰하지 않습니다
- broadcast는 긴급 상황에서만 사용합니다

## 컨텍스트 관리

> Team-lead의 컨텍스트 윈도우는 한정적입니다. Auto compaction을 방지하려면 아래 규칙을 반드시 준수합니다.

### Team-lead는 조정자

- team-lead는 **파일을 직접 Read하지 않음** — 코드 분석이 필요하면 서브에이전트에 위임
- team-lead의 역할: 태스크 분배, 결과 요약 판단, 다음 Phase 결정
- 서브에이전트 prompt에는 **파일 경로만 전달** (파일 내용 복붙 금지)

### 서브에이전트 결과 보고

- **10줄 이내 요약**으로 보고
- 코드 전문이나 파일 내용을 결과에 포함하지 않음
- "변경 파일 목록 + 핵심 변경사항 1줄씩" 형태로 보고

### 중복 Read 방지

- 이미 읽은 파일을 같은 세션에서 다시 읽지 않음
- 플랜/분석 결과는 **파일로 저장**하고 이후 Phase에서는 경로만 참조
- 여러 Phase에 걸쳐 같은 파일이 필요하면 서브에이전트가 각자 읽도록 위임
