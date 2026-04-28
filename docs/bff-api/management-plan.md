# BFF API 문서 관리 운영 계획

> 상태: Draft
> 작성일: 2026-04-28
> 마지막 수정일: 2026-04-28
> 대상: `docs/bff-api/` 하위 문서를 작성·갱신하는 개발자, 기획자, QA, 운영 담당자
> 근거: [strategy.md](./strategy.md)

이 문서는 `docs/bff-api/` 하위 문서를 어떤 흐름으로 갱신할지 정의한다.
**무엇을** 관리할지(전략)는 [strategy.md](./strategy.md)에, **어떻게** 갱신할지(운영)는 이 문서에 정리한다.
이 운영 계획은 `/bff-api-docs` 스킬이 자동화·검증하는 대상이기도 하다.

## 1. 핵심 결정 (요약)

| 항목 | 결정 |
| --- | --- |
| API 계약의 원본 | 백엔드의 BFF Swagger (외부 시스템) |
| Repo 내부의 Tag 단위 사본 | `docs/bff-api/tag-guides/{slug}.md`의 인라인 YAML 블록 (B안 채택) |
| 사본의 정합성 보장 방법 | `/bff-api-docs validate`가 인라인 YAML과 별도 등록한 _업스트림 swagger 스냅샷_을 비교 |
| 진행 중인 변경 논의 위치 | `docs/bff-api/discussions/YYYY-MM-DD-{tag}-{topic}.md` |
| 에러 코드 카탈로그 | `docs/bff-api/catalogs/error-codes.md` (단일 카탈로그) |
| Confluence 매핑 | 각 문서 본문 상단의 `> Confluence:` 라인으로 보존 (파일명에는 번호를 두지 않음) |
| 문서 언어 | 한국어 (CLAUDE.md 영어 전용 경로에 포함되지 않음) |

### 1.1 (B)안을 채택한 이유

repo 안에 Tag 단위로 정렬된 swagger 원본이 없기 때문에 (`docs/swagger/*.yaml`은 화면/영역 단위) Tag별 사본이 그 자체로 운영 기준이 된다.
사본의 stale 여부를 검증할 수 없으면 사본은 위험한 자산이 되므로, 사본을 유지하되 **검증 절차를 명시적으로 끼워 넣는다**.

## 2. 디렉터리 책임 분리

```text
docs/bff-api/
├── README.md             # 진입점, Tag 가이드 인덱스, 목적별 진입 경로
├── strategy.md           # 왜 이런 구조를 쓰는가 (의사결정 기록)
├── management-plan.md    # 어떻게 운영하는가 (이 문서)
├── tag-guides/           # API Tag별 본문. 인라인 BFF Swagger + 운영 설명
├── catalogs/             # 공통 카탈로그 (현재 error-codes; 추후 enums-and-states 추가)
└── discussions/          # API 변경/추가/폐기/에러코드 변경 논의 기록
```

각 디렉터리는 **단일 책임**을 갖는다. 예를 들어 에러 코드 의미 정의는 항상 `catalogs/error-codes.md`에만 두고, Tag 가이드와 discussion은 그 카탈로그를 참조만 한다.

## 3. 문서 본문 메타데이터 규약

모든 문서는 H1 바로 아래에 `> Key: Value` 라인을 둔다. 다음 키를 표준으로 한다.

| 키 | 적용 대상 | 비고 |
| --- | --- | --- |
| `Confluence` | 모든 문서 | 매핑되는 Confluence 페이지 번호 |
| `상태` | 모든 문서 | Draft / Reviewing / Accepted / Implemented / Released / Deprecated / Rejected |
| `API Tag` | tag-guides/* | Tag 표시 이름 (Swagger의 `tags[].name`) |
| `담당` | tag-guides/*, discussions/* | 책임 팀/사람 (TBD 허용) |
| `작성일`, `마지막 수정일` | 모든 문서 | YYYY-MM-DD |
| `대상 Tag` | discussions/* | 영향받는 Tag (다중일 경우 콤마 구분) |
| `변경 유형` | discussions/* | Added / Changed / Deprecated / Removed / Fixed |
| `관련 PR` | tag-guides/*, discussions/* | URL |
| `Confluence Title` | discussions/* | `[yy.mm.dd] ... 관련 논의` 원형 |

스킬은 위 키 중 필수 항목 누락 / 값 enum 오기를 검증한다.

## 4. 운영 워크플로우

### 4.1 신규 Tag 가이드 추가 (W1)

1. 새 Tag가 backend BFF에 추가됐다는 신호(PR 링크, 백엔드 ADR, 슬랙 등)를 확인한다.
2. `discussions/YYYY-MM-DD-{tag}-added.md`를 먼저 만든다 (배경, PR, 영향).
3. `/bff-api-docs new-tag-guide {slug}` 또는 수동으로 `tag-guides/{slug}.md`를 표준 골격으로 생성한다.
4. 인라인 BFF Swagger 섹션에 해당 Tag의 path만 추출한 YAML을 붙인다. `Swagger 상태`를 명시(예: Draft).
5. response 설명 / 운영 규칙 섹션 작성. enum, error code는 카탈로그 링크로만 둔다.
6. README의 Tag 인덱스 표에 새 Tag를 추가한다 (`/bff-api-docs index`로 자동화 가능).
7. discussion 상태를 `Reviewing → Accepted → Implemented → Released` 순으로 갱신한다.

### 4.2 기존 Tag의 API 계약 변경 (W2)

1. backend에서 path/schema가 바뀐다는 신호를 받는다.
2. `discussions/YYYY-MM-DD-{tag}-{topic}.md` 생성 (변경 유형 = Changed).
3. `tag-guides/{slug}.md`의 인라인 Swagger를 수정한다.
4. response 설명 / 변경/논의 이력 표에 행을 추가한다.
5. `/bff-api-docs validate` 실행. drift 정책에 따른 결과를 확인한다 (§5).
6. discussion 상태를 갱신한다.

### 4.3 신규 Discussion 작성 (W3)

`/bff-api-docs new-discussion {tag} {topic}`를 사용하거나 `discussions/README.md`의 템플릿을 복사한다.
스킬은 다음을 자동 수행한다.

- 파일명 `YYYY-MM-DD-{tag}-{topic}.md` 생성 (오늘 날짜 자동 채움)
- frontmatter 메타 필드 채움 (대상 Tag, 변경 유형 placeholder)
- Confluence Title 라인 (`[yy.mm.dd] ... 관련 논의`) 자동 생성
- discussions/README.md 인덱스 표에 행 추가

### 4.4 에러 코드 업데이트 (W4) — 핵심 흐름

에러 코드는 **Tag보다 변경이 잦고 영향 범위가 넓기 때문에** 명시적 워크플로우를 둔다.
모든 에러 코드 변경은 `catalogs/error-codes.md`를 단일 진실의 원천으로 두고, Tag 가이드는 _참조만_ 한다.

#### 4.4.1 트리거 시그널

다음 중 하나가 발생하면 W4를 시작한다.

- backend가 새 에러 코드를 응답에 추가하거나 추가 예정임
- HTTP status, 재시도 가능 여부, 발생 조건이 바뀐다
- 사용자/운영자 액션 가이드를 보강해야 한다 (운영 회고, 인시던트 후속)
- 에러 코드를 폐기·교체한다

#### 4.4.2 변경 유형별 작업

| 유형 | catalogs/error-codes.md | discussions/* | 영향받는 tag-guides/* |
| --- | --- | --- | --- |
| **Added** (신규) | 신규 행 추가. 모든 필수 컬럼 채움 (코드, HTTP status, 의미, 발생 조건, 재시도, 사용자 액션, 운영자 확인, 관련 Tag, 관련 API, 추가일) | `YYYY-MM-DD-error-codes-{code}-added.md` 작성 | 해당 코드를 응답하는 API의 Tag 가이드의 _관련 error code_ 링크 갱신, 변경/논의 이력 표에 한 줄 추가 |
| **Changed** (의미·status 변경) | 해당 행 편집. `변경일` 갱신. 의미 변경이면 변경 전 값을 discussion에 기록 | `YYYY-MM-DD-error-codes-{code}-changed.md` 작성 | 운영 의미 변경이라면 영향받는 Tag 가이드 변경/논의 이력에 행 추가 |
| **Guidance Updated** (가이드만 보강) | 사용자/운영자 액션 컬럼만 편집, `변경일` 갱신 | discussion 생략 가능 (인시던트 후속이면 작성 권장) | 변경 없음 |
| **Deprecated** | `폐기 예정 여부 = Yes`로 표시, 대체 코드/EOL 일자 추가 | `YYYY-MM-DD-error-codes-{code}-deprecated.md` 작성 | Tag 가이드의 관련 error code 링크에 `(deprecated → {newCode})` 표기 |
| **Removed** | 행 삭제 또는 `삭제` 섹션으로 분리. 마지막 backend release 노트 링크 첨부 | `YYYY-MM-DD-error-codes-{code}-removed.md` 작성 | 모든 Tag 가이드의 관련 링크에서 제거 |

#### 4.4.3 카탈로그 행의 필수 필드

`catalogs/error-codes.md`의 각 행은 다음 컬럼을 모두 가져야 한다.

```text
| 코드 | HTTP status | 의미 | 발생 조건 | 재시도 가능 | 사용자 액션 | 운영자 확인 포인트 | 관련 Tag | 관련 API | 폐기 여부 | 대체 코드 | 추가일 | 변경일 |
```

스킬은 새 행을 추가할 때 위 컬럼이 모두 채워졌는지 검사하고, 비어 있으면 검증 실패로 보고한다.

#### 4.4.4 일관성 규칙

- 어떤 Tag 가이드든 `EXXXX` 형식의 코드를 본문에 인용했다면, 그 코드는 카탈로그에 존재해야 한다.
- 카탈로그의 `관련 Tag` 컬럼에 적힌 Tag는 실제 `tag-guides/`에 존재해야 한다.
- `Deprecated` 표시된 코드는 반드시 `대체 코드` 또는 `EOL 일자` 중 하나가 채워져야 한다.

위 세 규칙은 `/bff-api-docs validate`가 자동 검증한다 (§5.3).

#### 4.4.5 카탈로그 → Tag 가이드 역참조 자동 보조

카탈로그 행의 `관련 Tag`/`관련 API` 컬럼을 신뢰의 원천으로 두면, Tag 가이드의 _관련 error code_ 섹션을 사람이 매번 동기화할 필요가 없다.
`/bff-api-docs sync-error-refs`는 카탈로그를 읽어 각 Tag 가이드의 _관련 error code_ 섹션 표를 재생성한다 (사람이 작성한 본문 설명은 보존, 표 영역만 교체).

### 4.5 Tag 가이드 상태 전이 (W5)

`Draft → Reviewing → Accepted → Implemented → Released → (Deprecated)`

상태 전이 시 다음을 함께 갱신한다.

- `> 상태:` 메타 라인
- `> 마지막 수정일:` 오늘 날짜
- 변경/논의 이력 표에 한 줄 추가 (날짜 / 상태 / 변경 유형 / 요약 / 관련 논의)
- `Released`로 전이할 때 `> 관련 PR:`이 채워져 있어야 함 (스킬이 강제)

`/bff-api-docs update-status {file} {state}`가 위를 한 번에 수행한다.

## 5. 검증 정책 (`/bff-api-docs validate`)

검증은 5개 카테고리로 구분된다. 카테고리별로 실패 처리(Fail / Warn)를 명시한다.

### 5.1 메타데이터 검증 (Fail)

- 모든 문서에 `> 상태:` 가 있고 enum 범위 안인지
- tag-guides/* 가 `Confluence`, `API Tag`, `담당`, `마지막 수정일`을 가지는지
- discussions/* 가 `Confluence Title`, `대상 Tag`, `변경 유형`을 가지는지
- `Released` 상태의 tag-guide는 `관련 PR` URL이 채워져 있는지

### 5.2 Tag 가이드 ↔ Swagger 인라인 정합성 (Warn)

repo에는 Tag 단위 swagger 원본이 없으므로, 정합성은 **Tag 가이드 내부의 자기-일관성**만 검사한다.

- 인라인 YAML이 valid YAML이며 `paths`, `tags` 키가 존재
- `paths.*.{method}.tags`가 가이드 frontmatter의 `API Tag`와 일치
- 가이드 본문 _API 목록_ 표의 (Method, Path) 쌍이 인라인 YAML의 그것과 1:1 일치
- 가이드 본문에 등장한 모든 schema 참조 (`$ref: '#/components/schemas/Foo'`)가 인라인 YAML의 `components.schemas`에 존재

업스트림 swagger 스냅샷이 추가로 등록된 경우(§7) 그 차집합을 _drift candidate_로 Warn 보고한다.

### 5.3 카탈로그 일관성 (Fail)

- Tag 가이드 본문에서 `EXXXX` 형식 코드 인용 → 카탈로그에 존재해야 함
- 카탈로그의 `관련 Tag` 값 → `tag-guides/`에 존재해야 함
- 카탈로그의 `관련 API` 의 (Method, Path) → 해당 Tag 가이드의 인라인 YAML에 존재해야 함
- `Deprecated` 행 → `대체 코드` 또는 `EOL 일자` 중 하나 채워져야 함

### 5.4 Discussion 규칙 (Fail)

- 파일명이 `YYYY-MM-DD-{tag}-{topic}.md` 패턴인지
- `대상 Tag` 가 `tag-guides/`에 실제로 존재하는지 (또는 `error-codes`, `multiple` 같은 예약어)
- `Implemented` 또는 `Released` 상태면 `관련 PR` 채워져 있어야 함

### 5.5 인덱스 동기화 (Warn)

- README의 Tag 인덱스 표가 `tag-guides/` 디렉터리의 실제 파일과 일치하는지
- discussions/README의 인덱스 표가 `discussions/` 디렉터리의 실제 파일과 일치하는지

자동 보정은 별도 명령 (`/bff-api-docs index`)으로 수행한다. validate는 보고만 한다.

## 6. 자동화 명령 (`/bff-api-docs`)

| 명령 | 동작 |
| --- | --- |
| `/bff-api-docs validate` | §5의 모든 검증 수행, Fail/Warn 분리 출력 |
| `/bff-api-docs new-tag-guide {slug}` | 표준 골격으로 tag-guides/{slug}.md 생성 |
| `/bff-api-docs new-discussion {tag} {topic}` | 오늘 날짜로 discussion 파일 생성 + frontmatter 채움 |
| `/bff-api-docs update-status {file} {state}` | 상태/마지막 수정일/이력 행 갱신 |
| `/bff-api-docs error-code add\|change\|deprecate {code}` | catalogs/error-codes.md 행 편집 + discussion 골격 생성 |
| `/bff-api-docs sync-error-refs` | 카탈로그를 읽어 Tag 가이드의 _관련 error code_ 표 재생성 |
| `/bff-api-docs index` | README 및 discussions/README의 인덱스 표 재생성 |

스킬은 동작 결과를 항상 dry-run 친화적으로 보여준다 (변경될 파일 목록 + diff 미리보기). `--apply`가 명시될 때만 실제 파일을 수정한다.

## 7. 업스트림 Swagger 스냅샷 (선택)

backend가 BFF Swagger 원본을 외부에 게시한다면, 그 스냅샷을 `docs/bff-api/.upstream/swagger.yaml` 같은 _숨겨진_ 경로에 주기적으로 동기화하고, validate가 Tag 가이드 인라인 YAML과 비교해 drift를 Warn으로 보고하도록 확장할 수 있다.

이 경로는 운영 단계에서 도입한다. 도입 시점:

- backend가 swagger 산출물을 안정적인 URL로 공개
- CI 또는 cron으로 스냅샷을 받아 commit하는 흐름이 합의됨

도입 전에는 §5.2의 자기-일관성 검사만으로도 일정 수준의 안전망을 제공한다.

## 8. CI 훅 (선택, Phase 2)

`docs/bff-api/**` 변경이 포함된 PR에서 GitHub Action으로 `/bff-api-docs validate`의 비-LLM 부분(메타데이터, 카탈로그 일관성, 인덱스 동기화)을 실행한다. Fail은 PR 차단, Warn은 코멘트.

이 훅은 스킬이 안정화된 후에 도입한다.

## 9. 책임 매트릭스

| 활동 | 주 담당 | 백업 |
| --- | --- | --- |
| 신규 Tag 가이드 작성 | 해당 Tag 책임 FE | 해당 영역 BE |
| API 계약 변경 반영 | 변경을 일으킨 BE | FE 도메인 담당 |
| 에러 코드 카탈로그 갱신 | 변경을 일으킨 BE | 운영팀 (가이드 부분) |
| Discussion 작성 | 변경 제안자 | - |
| 분기 1회 stale 정리 | FE 도메인 담당 | - |

## 10. 비권장 패턴 (재확인)

`strategy.md`의 비권장 패턴을 그대로 유지하며, 추가로 다음을 명시한다.

- Tag 가이드에 에러 코드 의미를 직접 풀어쓰는 것 (카탈로그를 우회)
- discussion 상태와 Tag 가이드 상태가 어긋난 채로 방치 (`Released`인 가이드인데 discussion이 `Draft`)
- 카탈로그 행에 `관련 Tag`만 적고 `관련 API`를 비워두는 것 (역참조 자동 보조 §4.4.5가 무력화됨)
- `/bff-api-docs validate` Fail 상태로 PR 머지

## 11. 변경 이력

| 날짜 | 변경 |
| --- | --- |
| 2026-04-28 | 최초 작성 (B안 + ErrorCode 워크플로우 W4 포함) |
