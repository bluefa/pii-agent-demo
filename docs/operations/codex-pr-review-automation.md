# Codex PR Review Automation (Self-hosted Runner)

이 문서는 **2026-02-14** 기준으로, 이 레포에서 다음을 자동화하는 방법을 정리합니다.

- PR 생성/업데이트 시 Codex(`gpt-5.3-codex`) 자동 리뷰
- Blocking 이슈가 있으면 체크 실패로 머지 차단
- Claude/Codex 스킬에서 리뷰 항목 확인 후 안전 머지
- self-hosted runner를 로컬 서버에서 직접 기동

## 1. GitHub Actions 구성

추가된 파일:

- `.github/workflows/codex-pr-review.yml`
- `scripts/ci/codex-pr-review.mjs`

동작:

1. `pull_request_target` 이벤트에서 실행
2. `head.repo.full_name == github.repository` 조건으로 fork PR 차단
3. PR diff를 GitHub API로 읽어 Codex에 전달
4. 결과를 PR 코멘트(`<!-- codex-pr-review -->`)로 업서트
5. Blocking finding이 1개 이상이면 job 실패(exit 1)

필수 Repository Secret:

- `OPENAI_API_KEY`: Codex 모델 호출용 API 키

권장 Branch protection:

1. GitHub Repo Settings -> Branches -> Branch protection rule
2. `Require status checks to pass before merging` 활성화
3. Required check에 **`Codex PR Review`** 추가

## 2. 리뷰 지침/스킬 구성

추가/변경된 파일:

- `.claude/skills/pr-merge/SKILL.md`
- `.codex/skills/pr-merge/SKILL.md`
- `scripts/pr-merge-if-clean.sh`

머지 절차:

1. PR 코멘트에서 Codex 리뷰 항목 확인
2. 아래 명령으로 Codex 체크 통과 여부를 게이트로 검증

```bash
bash scripts/pr-merge-if-clean.sh --pr <PR번호> --strategy squid
```

검증 조건:

- PR 상태가 `OPEN`
- `mergeable == MERGEABLE`
- `reviewDecision != CHANGES_REQUESTED`
- head SHA의 `Codex PR Review` check conclusion이 `success`

조건 미충족 시 머지를 중단하고 Codex 코멘트 스냅샷을 출력합니다.

## 3. Self-hosted Runner 선언/기동

추가된 파일:

- `scripts/setup-self-hosted-runner.sh`
- `scripts/start-self-hosted-runner.sh`
- `scripts/remove-self-hosted-runner.sh`

### 3.1 1회 설치/등록

```bash
bash scripts/setup-self-hosted-runner.sh --labels codex-review
```

기본값:

- runner dir: `~/.local/share/pii-agent-runner`
- runner name: `<hostname>-codex-review`
- labels: `codex-review`

### 3.2 실행

Foreground 실행:

```bash
bash scripts/start-self-hosted-runner.sh --runner-dir ~/.local/share/pii-agent-runner
```

서비스 모드(지원 OS만):

```bash
bash scripts/start-self-hosted-runner.sh --runner-dir ~/.local/share/pii-agent-runner --service
```

### 3.3 제거

```bash
bash scripts/remove-self-hosted-runner.sh --runner-dir ~/.local/share/pii-agent-runner
```

## 4. 보안 안정성 점검 결과 (현재 레포)

점검 시각: **2026-02-14**

실행/확인 항목:

- 시크릿 패턴 스캔(`rg` 기반): 하드코딩 키 패턴 미검출
- 워크플로우 권한 확인: 최소 권한(`contents: read`, `pull-requests: write`, `issues: write`) 적용
- fork PR 차단 조건 확인: 적용됨
- 의존성 취약점 확인: `npm audit --omit=dev --json`

발견 사항:

- `next@16.1.4`에 High 1건 포함(DoS 계열 advisory 다수)
- `npm audit` 기준 권장 수정 버전: `next@16.1.6`

권장 조치:

1. `next`를 `16.1.6` 이상으로 업데이트
2. Branch protection에 `Codex PR Review` required check 등록
3. self-hosted runner는 개인 개발 계정이 아닌 전용 OS 사용자로 구동
4. public/fork PR은 self-hosted에서 실행하지 않기(현재 워크플로우는 차단)

## 5. 운영 팁

- PR이 큰 경우 `MAX_DIFF_CHARS`를 조정해 리뷰 입력 크기를 제어할 수 있습니다.
- 리뷰 품질을 높이려면 `scripts/ci/codex-pr-review.mjs`의 system/user prompt에 팀 규칙을 추가하세요.
- Codex 리뷰는 게이트 역할, 최종 merge 권한은 사람(또는 명시적 자동화)에게 두는 구성을 권장합니다.
