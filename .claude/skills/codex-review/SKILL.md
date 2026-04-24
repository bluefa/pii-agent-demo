---
name: codex-review
description: Codex(gpt-5.5, reasoning=xhigh)로 현재 브랜치 변경사항을 2차 리뷰. 주요 결정 품의, PR 전 교차 검증, Claude 구현 결과를 외부 모델로 재검토할 때 사용.
---

# Codex Review Skill

Claude가 구현한 변경사항을 OpenAI Codex CLI(gpt-5.5 xhigh)로 교차 리뷰한다. "품의" 용도 — 주요 결정 사항은 Codex를 거쳐 반대 의견/놓친 케이스를 확인한다.

## 실행 원칙

1. **Full access 실행**: `--dangerously-bypass-approvals-and-sandbox` 필수. Codex가 `.claude/skills/` 하위 파일을 자유롭게 읽을 수 있어야 skill-aware 리뷰가 가능.
2. **모델 고정**: `-c model="gpt-5.5" -c model_reasoning_effort="xhigh"` 항상 명시 (config.toml 변경에 영향받지 않도록).
3. **Base 최신화**: 실행 전 `git fetch origin main` 수행.
4. **Foreground 실행**: Bash `timeout: 600000` (10분). 결과 stdout은 사용자에게 **원문 그대로** 노출 + 상단에 Claude 요약 1-3줄.

## 인자 처리

| 호출 | 동작 |
|---|---|
| `/codex-review` | HEAD vs `origin/main` 범위 리뷰 (기본) |
| `/codex-review uncommitted` | 스테이지/언스테이지/untracked 워킹트리 리뷰 |
| `/codex-review commit <sha>` | 특정 커밋 리뷰 |
| `/codex-review base=<branch>` | 베이스 브랜치 변경 |
| `/codex-review "<자유 문구>"` | 위 키워드에 안 걸리면 custom review instructions로 append |

## 실행 커맨드

Claude는 아래 템플릿을 그대로 조립해 Bash로 호출한다. `<REVIEW_PROMPT>` 블록은 아래 "Skill-aware 리뷰 프롬프트" 섹션의 텍스트를 heredoc으로 넘긴다.

```bash
codex exec review \
  --base origin/main \
  --dangerously-bypass-approvals-and-sandbox \
  -c model="gpt-5.5" \
  -c model_reasoning_effort="xhigh" \
  "$(cat <<'PROMPT'
<REVIEW_PROMPT>
PROMPT
)"
```

변형:
- `uncommitted` → `--base origin/main` 제거 + `--uncommitted` 추가
- `commit <sha>` → `--base origin/main` 제거 + `--commit <sha>` 추가
- 사용자 custom 프롬프트 → `<REVIEW_PROMPT>` 끝에 `## 추가 지침` 블록으로 append

## Skill-aware 리뷰 프롬프트

아래 프롬프트를 Codex에 **그대로** 전달한다. Codex가 diff 파일 경로/내용을 스캔해 관련 skill 파일을 자가 선택하도록 지시한다.

```
당신은 이 레포지토리의 외부 리뷰어입니다. OpenAI Codex CLI로 호출되어 Claude Code가 구현한 변경사항을 2차 검증합니다.

=== STEP 1. 컨텍스트 스캔 ===
diff에 포함된 모든 파일 경로를 확인한다. 경로/확장자/내용에 따라 아래 skill 파일을 읽어 리뷰 기준으로 삼는다. 여러 개가 해당되면 모두 읽는다.

필수 (모든 리뷰):
- .claude/skills/coding-standards/SKILL.md — 프로젝트 공통 코딩 규칙
- .claude/skills/anti-patterns/SKILL.md — 프론트엔드 안티패턴 카탈로그

조건부:
- React/Next.js 컴포넌트 변경 (`.tsx`, `components/`, `app/` 경로) → .claude/skills/vercel-react-best-practices/SKILL.md
- PR 전체 컨텍스트 관점 리뷰가 필요한 규모의 변경 (5+ 파일 또는 아키텍처 변경) → .claude/skills/pr-context-review/SKILL.md
- 프로젝트 최상위 CLAUDE.md, AGENTS.md (있으면) 훑어 규칙 맥락 확보

추가 렌즈 (파일 없음, 당신의 지식으로 적용):
- /simplify 렌즈: "재사용 가능한 기존 유틸이 있는데 중복 구현했는가? 불필요한 추상화/조기 최적화가 있는가? 50줄로 가능한 것을 200줄로 썼는가?"

=== STEP 2. 리뷰 수행 ===
읽은 skill 파일의 규칙을 diff에 적용한다. 발견 사항은 다음 3단계로 분류:
- **Critical**: 프로젝트 규칙(CLAUDE.md ⛔ 섹션, coding-standards) 위반, 보안, 명백한 버그
- **Major**: anti-patterns 위반, React 성능 문제, 아키텍처 불일치
- **Minor**: 가독성, 네이밍, /simplify 렌즈에서 잡히는 중복/과설계

=== STEP 3. 출력 형식 ===
반드시 아래 형식을 지킨다:

## 참조한 Skill
- <파일 경로> — <왜 선택했는지 한 줄>
- ...

## 요약
- 총 지적: Critical N / Major N / Minor N
- 가장 중요한 1건: <한 줄>

## Critical
(없으면 "없음")
### <파일:라인> — <제목>
<근거 + 인용>
<제안>

## Major
(동일 형식)

## Minor
(동일 형식)

## 종합 판단
- 머지 가능 여부: <Yes / 조건부 / No>
- 조건: <있다면>

=== 제약 ===
- 코드 수정 금지. 리뷰만.
- 확인 없이 추측한 사실 금지. 모르면 "확인 필요" 로 표시.
- 한국어로 작성.
```

## 출력 처리

- Codex stdout 전체를 사용자에게 그대로 노출 (외부 모델 원문이 품의의 가치).
- Codex 출력 **상단**에 Claude 요약 1-3줄: 참조 skill 개수, Critical/Major 개수, 머지 판단. 사용자가 요약만 보고도 대응 우선순위 결정 가능.
- Codex가 "문제 없음" 이라고 결론지어도 그대로 전달 (일치/불일치 데이터 자체가 품의).

## 실패 처리

- `codex: command not found` → 설치 가이드 안내 후 중단.
- Exit code ≠ 0 → stderr 원문 노출, 재시도 금지.
- 긴 diff로 timeout → 사용자에게 보고 후 `--commit <sha>` 로 범위 축소 제안.

## 금지 사항

- `--full-auto` 사용 금지 (sandbox 남음, skill 파일 접근 불안정).
- Codex 출력을 Claude가 "정정"해서 전달 금지 (bias 주입).
- 리뷰 결과를 보고 Claude가 **자동으로 코드 수정 금지**. 사용자가 명시적으로 "반영" 요청할 때까지 리뷰만 수행.
