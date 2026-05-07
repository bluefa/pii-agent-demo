# ProcessBar 애니메이션 구현 프롬프트 (designer agent용)

이 문서는 [`docs/feature/process-bar-animation.md`](./process-bar-animation.md) plan v3 기반의 **구현 작업 프롬프트**입니다.
`designer` 서브에이전트(또는 동등 권한 implementer)에게 그대로 전달해 사용합니다.

---

## 0. 사용 방법

```
Task tool 호출:
  subagent_type: designer
  description: ProcessBar Toss-style RAF animation 구현
  prompt: <아래 § "에이전트 프롬프트 (verbatim)" 영역 그대로 복사>
```

또는 새 창에서 직접:
```
/clear
<프롬프트 본문 그대로 붙여넣기>
```

---

## 1. 사전 점검 (호출 전 확인사항)

호출 전에 다음을 확인:

- [ ] worktree에 있는가? (`pwd` 가 `/Users/study/pii-agent-demo-*` 형태)
  - 아니라면 `bash scripts/create-worktree.sh --topic process-bar-raf-motion --prefix feat`
- [ ] `origin/main` 최신인가? (`git fetch origin --quiet && git log --oneline -1 origin/main`)
- [ ] 기존 `StepProgressBar` 가 있는가? (있어야 함 — adapter로 대체 예정)
- [ ] plan v3 (`docs/feature/process-bar-animation.md`) 가 최신인가?

---

## 2. 에이전트 프롬프트 (verbatim — 이 부분을 designer에게 전달)

```text
[GOAL]
PII Agent Demo의 `StepProgressBar` 컴포넌트를 Toss-style interaction design 으로 재구현한다.
설계 문서: `docs/feature/process-bar-animation.md` (이하 "plan").
이 plan은 외부 모델(Codex)이 두 차례 리뷰한 v3로, Critical/Major 결함이 모두 정정됨.

[ABSOLUTE RULES — 위반 시 즉시 중단]
1. main 브랜치 직접 수정 금지. 현재 worktree 안에서만 작업한다.
2. `any` 타입 금지. unknown + guard 또는 concrete type 사용.
3. 상대 경로 import 금지. 모두 `@/` 절대 경로.
4. raw 색 클래스 직접 사용 금지. `lib/theme.ts` 토큰 또는 § plan §3.1 의 `colorRaw` 만 사용.
5. inline SVG 금지(AP-H1). 새 아이콘은 `app/components/ui/icons/` 에 추가하고 barrel export.
6. 영어 전용 경로의 코드 주석/PR description은 영어. 한국어 UI 문자열은 그대로.
7. plan에 명시되지 않은 새 기능, 추상화, refactoring을 임의로 추가하지 않는다.

[INPUTS YOU MUST READ FIRST]
필수:
- docs/feature/process-bar-animation.md (plan v3 — 끝까지 정독)
- CLAUDE.md (프로젝트 룰)
- AGENTS.md (공통 룰)
- .claude/skills/coding-standards/SKILL.md
- .claude/skills/anti-patterns/SKILL.md (특히 AP-H1, AP-A5, AP-E2, AP-G1)
- lib/theme.ts (현재 토큰 형태)
- app/components/features/process-status/StepProgressBar.tsx (현재 구현 — 어댑터로 전환 대상)
- app/components/features/process-status/ProcessTimelineCompact.tsx (a11y/motion-reduce 모범)
- app/components/features/ProcessStatusCard.tsx (consumer 1)
- app/integration/admin/guides/components/GuidePreviewPanel.tsx (consumer 2)
- vitest.config.ts (테스트 환경 확인)

선택:
- DESIGN.md (디자인 시스템 contract)
- app/components/ui/icons/StatusSuccessIcon.tsx (icon 패턴 reference)

[SCOPE — 이번 PR에 포함]
1. 새 파일:
   - `lib/hooks/useReducedMotion.ts` (plan §4.7)
   - `lib/hooks/useIsomorphicLayoutEffect.ts` (plan §5.1.2)
   - `app/components/ui/icons/CheckIcon.tsx` (plan §5.4) + barrel export
   - `app/components/features/process-status/motion/easing.ts` (plan §5.3)
   - `app/components/features/process-status/motion/colorMix.ts` (plan §5.2)
   - `app/components/features/process-status/motion/stepperMotionEngine.ts` (plan §4.1.1, §5)
   - `app/components/features/process-status/ProcessProgressBar.tsx` (plan §5.5)
   - `app/components/features/process-status/InstallationProcessProgressBar.tsx` (plan §5.6)
   - 각 파일의 `*.test.ts(x)` 단위 테스트
2. 수정:
   - `lib/theme.ts` — `colorRaw` 와 `motion` 토큰 추가 (plan §3.1, §3.2)
   - `app/components/ui/icons/index.ts` — CheckIcon export
   - `app/components/features/process-status/index.ts` — 새 export + StepProgressBar deprecation alias
   - `app/components/features/ProcessStatusCard.tsx` — import 업데이트
   - `app/integration/admin/guides/components/GuidePreviewPanel.tsx` — import 업데이트
3. 삭제 또는 alias:
   - `app/components/features/process-status/StepProgressBar.tsx` 의 본체 → `InstallationProcessProgressBar` 로 대체. 동일 경로/이름의 alias 1 cycle 유지 후 별도 PR에서 제거.

[SCOPE — 이번 PR에 포함하지 않음 (out of scope)]
- `StepIndicator.tsx` 통합 (별도 follow-up)
- `ProcessGuideTimeline.tsx` 의 inline SVG 정리 (별도)
- spring physics, sound, haptic
- `customSteps` 외부 사용자가 0건이므로 deprecation 만 명시 (실제 prop 제거는 다음 cycle)

[NON-FUNCTIONAL REQUIREMENTS]
- a11y: `<nav aria-label>`, `<ol role="list">`, `aria-current="step"`, `<CheckIcon aria-hidden>`. plan §4.8.
- reduced-motion: `useReducedMotion` 활성 시 RAF 미실행, CSS 클래스만으로 final state 도달.
- SSR: `useIsomorphicLayoutEffect` 사용. `npm run build` 로 prerender 경고 없음.
- 성능: `transform: scaleX()` (compositor only) + `will-change: transform`.
- 인터럽트: rapid step change 시 RAF cancel + `finalize()` 호출로 잔상 0.
- 가변 N: N=2, N=7, N=15 모두 동작. 총 애니메이션 길이 ≤ 1200ms.

[ACCEPTANCE CRITERIA — plan §7]
plan §7 의 AC1~AC17 모두 충족. 특히:
- AC4: connector 길이의 98% 도달 시점에 다음 circle 색 전환 시작 (engine math 단위 테스트로 검증)
- AC5/AC6: forward/backward cascade 동작 시 origin = 'left' (단위 테스트)
- AC7: N=2, 7, 15 동작
- AC10: prefers-reduced-motion ON → RAF 미실행 (Mock matchMedia 검증)
- AC11: mid-flight 인터럽트 — cleanup → finalize → 새 RAF
- AC14: 기존 consumer props 시그니처 무변경

[STEP-BY-STEP PLAN — plan §8 그대로 따른다]
1. tokens + helpers (theme/easing/colorMix/CheckIcon/hooks) → 단위 테스트 통과
2. RAF Engine → mock RAF 셋업으로 단위 테스트
3. ProcessProgressBar generic → 첫 마운트 RAF skip, snapshot diff, reduced-motion 분기 검증
4. InstallationProcessProgressBar adapter → toSteps() 모든 ProcessStatus 값 검증
5. consumer migration → 시각 회귀 없음
6. 시각 검증 (dev 서버, slow-mo + 정상 속도)
7. 정리 — follow-up 이슈 (StepIndicator 통합 등) 메모만

각 step 완료마다 commit. step 단위 atomic.

[VERIFICATION GATES — 각 step 완료 시]
- `npm run lint`
- `npx tsc --noEmit` (또는 `npm run type-check`)
- `npm run test:run -- <changed scope>`
- 마지막에 `npm run test:run` 전체

UI 변경이 반영되는 step (3 이후)에서는:
- `npm run dev` 후 ProcessStatusCard 가 보이는 페이지 진입
- mock seed로 step 단계 변경:
  - Step1 → Step2 (단일 진행)
  - Step1 → Step3 (점프 forward)
  - Step3 → Step1 (역행)
  - Step1 → Step7 (최장)
- Reduced motion ON 상태(시스템 설정) 재진입
- `GuidePreviewPanel` (관리자 가이드 미리보기) 정상 동작

[COMMIT / PR]
- Prefix: `feat/`
- 메시지는 step별로 분리, 영문
- 마지막 PR push 전:
  - `git fetch origin main && git rebase origin/main`
  - `npm run test:run` 전체 통과 확인
- PR 본문 영문, before/after 짧은 GIF 또는 영상 첨부 권장

[DELIVERABLES — 작업 종료 시 보고할 것]
1. 만들어진 파일 목록 (절대 경로)
2. plan §7 AC 매트릭스 — 각 항목 ✅/❌ + (실패 시 사유)
3. 시각 검증 결과 — 각 시나리오별 한 줄 코멘트
4. 새로 발견한 plan의 결함 또는 명확화 필요한 부분 (잘못된 가정으로 진행하지 말 것 — 발견 즉시 보고)
5. 단위 테스트 커버리지 요약
6. 남은 작업 / follow-up 후보

[BEHAVIOR REMINDERS — CLAUDE.md "Behavioral Guidelines" 준수]
- 가정이 있다면 코드 작성 전에 명시. 모호하면 멈추고 질문.
- 단순함 우선. plan에 없는 추상화 추가 금지.
- 외과적 변경. 무관한 코드 정리/주석 변경 금지.
- 검증 가능한 목표. step별 verify 체크 통과 후 다음 단계.
- 플랜 §11 의 "Open questions" 5건 중 시각 미세조정(baseSpeed, pulse amplitude)은 시각 검증 단계에서 권장값 사용 + 발견 사항을 PR 본문에 기록.

[FAILURE MODES TO AVOID]
- "구현했다"라고 보고하기 전에 시각 검증 안 함.
- mid-flight 인터럽트 케이스 테스트 누락.
- `transform-origin: 'left'` 통일 누락 (plan v3 의 핵심 정정 사항).
- backward source step RAF 미처리 (plan v3 의 핵심 정정 사항).
- cleanup 시 finalize() 호출 누락 (plan v3 의 핵심 정정 사항).
- snapshot diff 에 length/ids 비교 누락 (plan v3 의 핵심 정정 사항).
- inline SVG 잔존 (AP-H1).

[DO NOT]
- spring physics, framer-motion, GSAP 등 추가 의존성 도입.
- `customSteps` 의 새 사용처 추가.
- 7-step install 도메인 로직을 generic 컴포넌트에 누출.
- 라벨 색을 RAF로 직접 보간 (CSS `transition-colors` 만 사용 — plan §5.5).
- "preserve original behavior" 같은 이유로 plan과 다른 구현 선택 (안티패턴 — 명시적으로 plan 수정 후 진행).

이상.
```

---

## 3. designer agent 호출 시 주의사항

- agent는 plan 문서를 정독한 뒤 작업 시작해야 함. 첫 응답에 plan 요약 + assumption 명시를 요구.
- agent가 결함을 발견하면 즉시 보고하도록 프롬프트에 명시 (위 "DELIVERABLES" §4).
- agent가 막히면 user 에게 escalate. silent guess 금지.
- agent 종료 후 시각 회귀를 user 가 직접 확인 권장 (RAF 애니메이션은 단위 테스트로 100% 커버 불가).

---

## 4. 호출 후 follow-up

agent 작업이 끝나면:
1. PR diff 직접 review
2. dev 서버에서 UI 시각 검증
3. macOS "동작 줄이기" ON/OFF 확인
4. `/codex-review` 로 외부 검증 (선택)
5. 미세 조정값(baseSpeed 1.4 vs 1.6, pulse 5.5% vs 7%) 결정 후 별도 commit
