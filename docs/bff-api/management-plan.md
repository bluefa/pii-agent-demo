# BFF API 문서 관리 운영 계획

> Confluence: 5.2.3.5.5.10 (운영 계획 — strategy.md의 짝 문서)
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
| 사본의 정합성 보장 방법 | Phase 1 — `/bff-api-docs validate`의 자기-일관성 lint(§5.2). Phase 2 — 업스트림 swagger 스냅샷 비교(§7), 도입 조건 충족 시 |
| 진행 중인 변경 논의 위치 | `docs/bff-api/discussions/YYYY-MM-DD-{tag}-{topic}.md` |
| 에러 코드 카탈로그 | `docs/bff-api/catalogs/error-codes.md` (단일 카탈로그) |
| Confluence 매핑 | 각 문서 본문 상단의 `> Confluence:` 라인으로 보존 (파일명에는 번호를 두지 않음) |
| 문서 언어 | 한국어 (CLAUDE.md 영어 전용 경로에 포함되지 않음) |

### 1.1 (B)안을 채택한 이유

repo 안에 Tag 단위로 정렬된 swagger 원본이 없기 때문에 (`docs/swagger/*.yaml`은 화면/영역 단위) Tag별 사본이 그 자체로 운영 기준이 된다.
사본의 stale 여부를 검증할 수 없으면 사본은 위험한 자산이 되므로, 사본을 유지하되 **검증 절차를 명시적으로 끼워 넣는다**.

### 1.2 상태(`상태`) enum의 적용 범위

문서 종류에 따라 사용하는 상태 enum이 다르다. 검증은 종류별로 적용한다.

| 문서 종류 | 사용 가능한 `상태` 값 |
| --- | --- |
| 운영 산출물 (`tag-guides/*`, `discussions/*`, `catalogs/*`) | `Draft` / `Reviewing` / `Accepted` / `Implemented` / `Released` / `Deprecated` / `Rejected` |
| 거버넌스 문서 (`README.md`, `strategy.md`, `management-plan.md`) | `Draft` / `Proposed` / `Approved` / `Superseded` |

`/bff-api-docs validate`의 §5.1은 위 종류별 enum 안에서만 검증한다.

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

모든 문서는 H1 바로 아래에 `> Key: Value` 라인을 둔다. 키는 문서의 본문 언어를 따른다 — 한국어 문서는 한국어 키, 영어 문서(README들)는 영어 키.

### 3.1 운영 산출물 (Korean — `tag-guides/*`, `discussions/*`, `catalogs/*`)

| 키 | 적용 대상 | 비고 |
| --- | --- | --- |
| `Confluence` | 모든 산출물 | 매핑되는 Confluence 페이지 번호 |
| `상태` | 모든 산출물 | §1.2의 운영 산출물 enum |
| `API Tag` | tag-guides/* | Tag 표시 이름 (Swagger의 `tags[].name`) |
| `담당` | tag-guides/*, discussions/* | 책임 팀/사람 (TBD 허용) |
| `작성일`, `마지막 수정일` | 모든 산출물 | YYYY-MM-DD |
| `대상 Tag` | discussions/* | tag-guide 슬러그 (콤마 구분, 예약어 `error-codes`/`multiple` 허용) |
| `변경 유형` | discussions/* | Added / Changed / Deprecated / Removed / Fixed |
| `변경 방향` | discussions/* | BE-first / FE-first / Joint (§4.5) |
| `관련 PR` | tag-guides/*, discussions/* | URL (`Implemented`/`Released`에서 필수) |
| `Confluence Title` | discussions/* | `[yy.mm.dd] ... 관련 논의` 원형 |

### 3.2 거버넌스 문서 (English — `README.md`, `strategy.md`, `management-plan.md`)

| Key | Notes |
| --- | --- |
| `Confluence` | Confluence page number |
| `Status` | §1.2 governance enum (`Draft` / `Proposed` / `Approved` / `Superseded`) |
| `Created`, `Last updated` | YYYY-MM-DD |

스킬은 종류별 키 집합과 enum 범위만 검증한다 (한 문서가 두 키 집합을 섞어 쓰면 Fail).

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
| **Deprecated** | `폐기 예정 여부` 셀을 `예 — 대체: NEW_CODE` 또는 `예 — EOL: YYYY-MM-DD` 로 갱신 (§4.4.3) | `YYYY-MM-DD-error-codes-{code}-deprecated.md` 작성 | Tag 가이드의 관련 error code 링크에 `(deprecated → {newCode})` 표기 |
| **Removed** | 행 삭제 또는 `삭제` 섹션으로 분리. 마지막 backend release 노트 링크 첨부 | `YYYY-MM-DD-error-codes-{code}-removed.md` 작성 | 모든 Tag 가이드의 관련 링크에서 제거 |

#### 4.4.3 카탈로그 행의 필수 필드

`catalogs/error-codes.md`의 각 행은 현재 카탈로그와 동일한 컬럼 집합을 가진다.

```text
| 코드 | HTTP status | 의미 | 발생 조건 | 재시도 가능 여부 | 사용자 액션 | 운영자 확인 포인트 | 관련 API Tag | 관련 API | 폐기 예정 여부 | 추가일 / 변경일 |
```

규칙:

- `코드`는 대문자 식별자 형태(정규식 `[A-Z][A-Z0-9_]+`, 예: `VALIDATION_FAILED`).
- `추가일 / 변경일` 은 한 셀이며 `YYYY-MM-DD` 또는 `YYYY-MM-DD / YYYY-MM-DD` (추가일 / 변경일) 형식.
- `폐기 예정 여부` 셀은 `아니오` 또는 `예` 중 하나로 시작한다. `예`인 경우 같은 셀에 `대체: NEW_CODE` 또는 `EOL: YYYY-MM-DD` 중 최소 하나를 함께 표기한다 (예: `예 — 대체: VALIDATION_FAILED`).
- `관련 API` 셀은 `METHOD path` 라인을 줄바꿈으로 여러 개 둘 수 있다.

스킬은 새 행을 추가할 때 위 컬럼이 모두 채워졌는지, `코드` 형식과 `폐기 예정 여부` 표기 규칙을 만족하는지 검사한다.

#### 4.4.4 일관성 규칙

- Tag 가이드 본문에서 백틱으로 둘러싸인 대문자 식별자(`` `[A-Z][A-Z0-9_]+` ``)가 _error-code 추정 후보_로 검출되면, 그 식별자가 카탈로그에 존재하거나 명시적 allow-list(`docs/bff-api/.error-code-allowlist`)에 등록되어 있어야 한다 — 일반 enum 값과의 충돌은 allow-list로 회피한다.
- 카탈로그의 `관련 API Tag` 컬럼에 적힌 Tag는 실제 `tag-guides/`의 어느 파일에 존재해야 한다.
- 카탈로그의 `관련 API`의 `METHOD path` 쌍은 해당 Tag 가이드의 인라인 YAML `paths`에 존재해야 한다.
- `폐기 예정 여부 = 예` 행은 같은 셀에 `대체:` 또는 `EOL:` 중 최소 하나를 가져야 한다.

위 규칙들은 `/bff-api-docs validate`가 자동 검증한다 (§5.3).

#### 4.4.5 카탈로그 → Tag 가이드 역참조 자동 보조

카탈로그 행의 `관련 API Tag`/`관련 API` 컬럼을 신뢰의 원천으로 두면, Tag 가이드의 _관련 error code_ 섹션을 사람이 매번 동기화할 필요가 없다.
`/bff-api-docs sync-error-refs`는 카탈로그를 읽어 각 Tag 가이드 안의 **머신 소유 블록**만을 재생성한다.

머신 소유 블록 규약:

- 각 Tag 가이드의 _관련 error code_ 섹션 안에 다음 sentinel을 배치한다.
  ```markdown
  <!-- BFF-API-DOCS:BEGIN error-code-table (managed by /bff-api-docs sync-error-refs) -->
  | 코드 | 의미 | 발생 API |
  | --- | --- | --- |
  ...
  <!-- BFF-API-DOCS:END error-code-table -->
  ```
- sync-error-refs는 BEGIN/END 사이의 본문만 교체한다. sentinel 바깥의 인간 작성 prose는 절대 건드리지 않는다.
- 사람이 BEGIN/END 사이를 직접 편집한 흔적이 있으면 (e.g., 표 외 텍스트가 발견되면) 스킬은 변경을 적용하지 않고 검증 실패로 보고한다.
- 모든 변경은 기본 dry-run이며 `--apply` 없이는 파일을 수정하지 않는다.

기존에 sentinel이 없는 Tag 가이드 (예: 현재의 `admin-guides.md`)에 대한 마이그레이션:

- `/bff-api-docs sync-error-refs --init {file}`이 해당 가이드의 `## ... 관련 error code` 섹션 아래 (없으면 섹션 자체를 생성한 뒤) 빈 sentinel 블록 한 쌍을 삽입한다.
- `--init` 없이 sync-error-refs가 실행되면 sentinel이 없는 가이드는 _건드리지 않고_ "no managed block found, run --init first" 로만 보고한다.
- `--init`도 dry-run이 기본이며 `--apply`가 있어야 실제 삽입한다.

### 4.5 BE-first / FE-first / Joint 변경 방향과 공유 코드 (W6)

API 변경은 backend가 먼저 배포하는 경우(BE-first)와 frontend가 먼저 사용 코드를 머지하는 경우(FE-first)의 흐름이 다르다.
discussion 문서의 `Direction:` 메타 필드로 이를 명시하고, Tag 가이드의 인라인 Swagger 상태와 정합성을 강제한다.

| Direction | Tag 가이드 인라인 Swagger 상태 | discussion 상태 진행 |
| --- | --- | --- |
| **BE-first** | 배포 직후 `Released`로 갱신. Tag 가이드 표는 BE 배포 전에는 `Reviewing`/`Accepted` 단계로 둔다. | `Reviewing → Accepted → Implemented(BE PR merge) → Released(BE 배포 후)` |
| **FE-first** | FE가 사용을 시작하기 전까지 인라인 Swagger 상태는 `Accepted`(FE의 코드 계약). BE 배포 후에만 `Released`. | `Reviewing → Accepted → Implemented(FE PR merge) → Released(BE 배포 후)` |
| **Joint** | BE/FE 동시 머지. discussion에 양쪽 PR을 모두 연결. | `Reviewing → Accepted → Implemented(양쪽 머지) → Released` |

#### 4.5.1 변경 롤백·취소

`Implemented` 단계에서 변경이 롤백되면 discussion 상태를 `Rejected`로 되돌리고 Tag 가이드의 인라인 Swagger를 이전 `Released` 상태로 되돌린다. 변경 이력 표에는 `Reverted` 행을 추가한다.

#### 4.5.2 한 변경이 여러 Tag에 영향을 줄 때 (shared code)

shared error code 추가나 공통 envelope 변경처럼 한 변경이 여러 Tag에 영향을 주는 경우:

- discussion 파일명은 `YYYY-MM-DD-multiple-{topic}.md` 또는 `YYYY-MM-DD-error-codes-{topic}.md`를 사용한다.
- discussion의 `Tags:` 메타에 영향받는 Tag 목록을 모두 적는다 (콤마 구분).
- 영향받는 모든 Tag 가이드의 변경 이력 표에 동일 discussion을 링크한다 — 본문은 복제하지 않는다.
- 5개 이상의 Tag에 영향을 주는 변경은 PR description에서 별도 강조하고, 머지 전 영향받는 Tag 담당 모두의 ack를 받는다.

### 4.6 Tag 가이드 상태 전이 (W5)

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

각 문서는 §3.1(운영) 또는 §3.2(거버넌스) 중 한 쪽 키 집합을 사용해야 한다 — 두 집합을 한 문서에서 혼용하면 Fail.

운영 산출물:

- `> 상태:` 가 있고 §1.2 운영 enum 범위 안
- `tag-guides/*` 는 `Confluence`, `API Tag`, `담당`, `마지막 수정일`을 가짐
- `discussions/*` 는 `Confluence Title`, `대상 Tag`, `변경 유형`, `변경 방향`을 가짐
- `상태`가 `Released`인 tag-guide와 `상태`가 `Implemented`/`Released`인 discussion은 `관련 PR` URL을 가짐

거버넌스 문서 (`README.md` 들, `strategy.md`, `management-plan.md`):

- `Status` 가 §1.2 거버넌스 enum 범위 안
- `Confluence`, `Created`, `Last updated`를 가짐

### 5.2 Tag 가이드 인라인 Swagger 자기-일관성 (Warn)

이 검사는 **drift 검증이 아니다 — 임시 lint다.** Phase 1에서는 Tag 단위 swagger 원본이 repo 안에 없으므로, "인라인 YAML이 그 자체로 모순되지 않는가" 만 검사한다. drift는 Phase 2 업스트림 스냅샷 도입 시점에서 §5.6으로 추가된다.

- 인라인 YAML이 valid YAML이며 `paths`, `tags` 키가 존재
- `paths.*.{method}.tags`가 가이드 메타의 `API Tag`와 일치
- 가이드 본문 _API 목록_ 표의 (Method, Path) 쌍이 인라인 YAML의 그것과 1:1 일치
- 가이드 본문에 등장한 모든 schema 참조 (`$ref: '#/components/schemas/Foo'`)가 인라인 YAML의 `components.schemas`에 존재
- **components 가지치기**: `components.schemas`에 정의되었지만 같은 인라인 YAML 안에서 한 번도 참조되지 않는 schema가 있으면 Warn 보고. Tag 가이드는 _Tag-scoped sample_이므로 외부 schema 잔재는 사본을 망친다.
- 추가 보조 lint: `docs/swagger/*.yaml`(현재 화면/영역 단위로 정렬되어 있음) 안에 동일 (Method, Path) 쌍이 존재하는지 — 존재하지 않는 경로가 있으면 Warn (BE 미배포 또는 FE 가공 path일 수 있음, Fail 처리하지 않음).

### 5.3 카탈로그 일관성 (Fail)

- Tag 가이드 본문에서 백틱 안의 대문자 식별자(`` `[A-Z][A-Z0-9_]+` ``)가 _error-code 후보_로 검출되면, 그 식별자는 (a) 카탈로그에 존재하거나 (b) `docs/bff-api/.error-code-allowlist` (한 줄에 하나의 식별자, `#` 주석 허용)에 등록되어 있어야 한다.
- 카탈로그의 `관련 API Tag` 컬럼 값 → `tag-guides/`의 어느 파일에든 존재해야 함
- 카탈로그의 `관련 API` 의 `METHOD path` 쌍 → 해당 Tag 가이드의 인라인 YAML `paths`에 존재해야 함
- `폐기 예정 여부 = 예` 행 → 같은 셀에 `대체:` 또는 `EOL:` 중 하나가 표기되어 있어야 함
- 카탈로그 행의 `코드` 형식이 `[A-Z][A-Z0-9_]+`인지

### 5.4 Discussion 규칙 (Fail)

- 파일명이 `YYYY-MM-DD-{tag}-{topic}.md` 패턴인지
- `Tags:` 의 각 슬러그가 `tag-guides/`에 실제로 존재하는지 (또는 예약어 `error-codes`, `multiple`)
- `Implemented` 또는 `Released` 상태면 `Related PR` 채워져 있어야 함
- `Direction:` 값이 `BE-first` / `FE-first` / `Joint` 중 하나인지

### 5.5 인덱스 동기화 (Warn)

- README의 Tag 인덱스 표가 `tag-guides/` 디렉터리의 실제 파일과 일치하는지
- discussions/README의 인덱스 표가 `discussions/` 디렉터리의 실제 파일과 일치하는지

자동 보정은 별도 명령 (`/bff-api-docs index`)으로 수행한다. validate는 보고만 한다.

### 5.6 업스트림 Swagger drift (Phase 2 도입 후)

§7의 업스트림 스냅샷이 도입되면 추가된다. Phase 1에서는 비활성. 도입 후 검사:

- 인라인 YAML의 (Method, Path) 집합과 업스트림 스냅샷 동일 Tag 집합 비교 — 차집합을 Warn으로 보고
- 동일 (Method, Path)에서 request/response schema deep diff — 차이 발견 시 Warn (자동 patch 없음)

## 6. 자동화 명령 (`/bff-api-docs`)

| 명령 | 동작 |
| --- | --- |
| `/bff-api-docs validate` | §5의 모든 검사 수행. Fail/Warn 분리 출력. **보고만 하고 파일은 수정하지 않는다.** |
| `/bff-api-docs new-tag-guide {slug}` | 표준 골격으로 tag-guides/{slug}.md 생성 (sentinel 블록 포함) |
| `/bff-api-docs new-discussion {tag} {topic}` | 오늘 날짜로 discussion 파일 생성 + 메타 필드 채움 + 인덱스 추가 |
| `/bff-api-docs update-status {file} {state}` | 상태/마지막 수정일/이력 행 갱신 |
| `/bff-api-docs error-code {add\|change\|guidance\|deprecate\|remove} {CODE}` | catalogs/error-codes.md 행 편집 + 필요한 경우 discussion 골격 생성 |
| `/bff-api-docs sync-error-refs` | 카탈로그를 읽어 Tag 가이드의 sentinel 블록 안 표만 재생성 (§4.4.5) |
| `/bff-api-docs extract-tag {slug} <swagger-source>` | 외부 swagger 입력에서 해당 Tag의 path 및 *referenced* schema만 추출해 인라인 YAML로 갱신 |
| `/bff-api-docs index` | README 및 discussions/README의 인덱스 표 재생성 (validate가 보고하는 §5.5 mismatch를 실제로 보정) |

모든 쓰기 명령은 기본 dry-run이다. 변경될 파일 목록과 diff 미리보기를 출력하고, `--apply`가 명시될 때만 실제 파일을 수정한다. `validate` 와 `extract-tag --check` 는 항상 read-only다.

## 7. 업스트림 Swagger 스냅샷 (Phase 2)

backend가 BFF Swagger 원본을 외부에 게시하면, 그 스냅샷을 `docs/bff-api/.upstream/swagger.yaml`로 주기 동기화하고 validate에 §5.6 drift 검증을 추가한다. 도입 시점:

- backend가 swagger 산출물을 안정적인 URL 또는 아티팩트로 공개한다
- CI 또는 cron이 스냅샷을 받아 commit하는 흐름이 합의된다

§5.6 (drift, Phase 2 도입 후) 골자:

- 인라인 YAML의 (Method, Path) 집합과 업스트림 스냅샷의 동일 Tag 집합 비교 → 차집합 Warn
- 동일 (Method, Path)의 request/response schema deep diff → 차이 발견 시 Warn (자동 patch는 하지 않음)

Phase 1 (현재)에서는 §5.2의 자기-일관성 검사 + §5.3의 카탈로그 일관성으로 안전망을 둔다. 자기-일관성 검사가 drift 검증을 대체하지는 않는다는 점을 운영 시 인지한다.

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
| 2026-04-28 | Codex review 1차 반영: README.md 영어화, 상태 enum 종류 분리(§1.2), drift 정책 Phase 1/2 명시, 카탈로그 컬럼 실제 형식과 일치, sentinel 블록 도입(§4.4.5), components 가지치기 검사 추가(§5.2), BE/FE 변경 방향과 shared-code 워크플로우(§4.5) 추가 |
| 2026-04-28 | Codex review 2차 반영: discussion 템플릿을 별도 TEMPLATE.md로 분리(README.md 영어 전용 규칙 완전 충족), §3을 운영(§3.1)/거버넌스(§3.2) 메타 키로 분리, sync-error-refs `--init` 마이그레이션 모드 추가, §5.6 업스트림 drift 섹션 골격 추가, 폐기 셀 표기 한국어로 일치(`예`/`아니오`) |
