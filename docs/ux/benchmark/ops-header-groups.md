# Target Source 운영 상세 헤더 — 정보 계층 (시안 C)

- **날짜** 2026-08-26
- **대상 화면** `/pass/admin/pipelines/ops/target-sources/{id}` 마스트헤드
- **아티팩트** https://claude.ai/code/artifact/5481b30b-6420-4c85-a7e1-e832a8f2f33b
- **선행** [`ops-target-frontmeta.md`](./ops-target-frontmeta.md) (PR #791, 머지 `3a0ac1e1`)

## 문제

오너 지적 (2026-08-26):

1. 「정보가 조금 정리가 안 된 느낌」 / 「정보 계층이 잘 드러나는 것 같지가 않아서」
2. 「ScanRole, TerraformRole 부분은 차라리 계정 정보로 묶이면 좋겠어요」
3. 「수정 가능한 내역들도 너무 많음」
4. 「차라리 TargetSource 정보 수정과 같은 메뉴를 제공하는 건 어떨까」

브라우저 실측(1440×900, AWS #1008 · GCP #1002 · IDC #1020)으로 확인한 원인:

| # | 등급 | 문제 | 근거 |
|---|------|------|------|
| P1 | 수치 위반 | **역할 다섯이 크기 둘을 나눠 씀** — 경로 현재 위치 14/600 #101828, 블록 이름 14/600 #344054, kv 라벨 12/600 #475467, 동작·링크 12/600 #2563EB, kv 값 12/500 #101828. 이웃한 두 쌍이 **색 하나**로만 갈림 | design-guide §3 「역할당 크기 1개」·「인접 계층은 레버 2개 이상」 |
| P2 | 수치 위반 | **마스트헤드 컨트롤 8개가 전부** `12px/600/rgb(37,99,235)`. 구분은 밑줄 1px. 그중 글자까지 같은 「수정」이 4개 | 같은 조항 |
| P3 | 수치 위반 | **셀 7개가 네 종류를 균일 간격으로** 늘어놓음 — 신원(계정·Scan Role·TF Role)이 1·5·6번에 흩어지고 사이를 설정 둘이 가름. 간격은 전부 `gap-x-[18px] gap-y-3` | design-guide §3 「거리 자체가 정보 구조」·「뭉탱이 금지」 |
| P4 | UX 원칙 | **편집 밀도가 4배 널뜀** — AWS 7셀/「수정」4, GCP 6셀/1, IDC 3셀/1 | 일관성 |

## 레퍼런스 (13개 전부 2026-08-26 직접 확인)

묶음 쪽과 편집 쪽 두 갈래가 갈린다.

| # | 레퍼런스 | 빌린 것 |
|---|----------|---------|
| 1 | [Cloudscape — Key-value pairs](https://cloudscape.design/components/key-value-pairs/) | **group 레이아웃의 묶음 제목** — 「유사한 kv 묶음 위에 제목을 두어 그 관계를 알게 하라」. 열은 1~4. |
| 2 | [Cloudscape — Details page](https://cloudscape.design/patterns/resource-management/details/details-page/) | **편집은 페이지/컨테이너 머리 버튼** — 「Header or global buttons: 리소스 전체에 영향을 주는 액션(Edit, Delete)」 |
| 3 | [GCP — Cloud SQL 인스턴스 Overview](https://docs.cloud.google.com/sql/docs/mysql/instance-info) | **절 이름 + 그 절의 편집 진입** — Connect / Service account / Configuration … 각각 「Edit configuration」·「Edit maintenance preferences」 |
| 4 | [PatternFly — Inline edit](https://www.patternfly.org/components/inline-edit/design-guidelines/) | **필드 수가 임계** — 하나면 인라인, 「편집 요소가 많은 넓은 영역」이면 섹션 전체를 edit 링크 하나가 연다 |
| 5 | [Atlassian — Inline edit](https://developer.atlassian.com/platform/forge/ui-kit/components/inline-edit/) | 「폼의 일부가 아닌 필드에 쓴다. 폼 안에는 쓰지 않는다」 — **묶인 필드는 폼이 진다** |
| 6 | [Cloudscape — Details 패턴 인덱스](https://cloudscape.design/patterns/resource-management/details/) | 탭 변형(태스크가 여럿일 때) — 시안 D 의 근거이자 기각 근거 |
| 7 | [Azure Portal — 리소스 페이지 해부](https://learn.microsoft.com/en-us/azure/azure-portal/azure-portal-overview) | Working pane(상세) / Service menu(그 리소스 명령, 기본 접힘) / Command bar — **조회 면과 변경 진입이 다른 표면** |
| 8 | [Stripe — 고객 상세 개편](https://support.stripe.com/questions/updates-to-the-customer-detail-page) | 정적/동적 축 분리, 자주 쓰는 액션은 페이지 헤더로 |
| 9 | [NN/g — Progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | 분할 기준은 **빈도** — 「자주 필요한 것은 전부 앞에」, 「1차 목록에 너무 많으면 초점이 사라진다」 |
| 10 | [NN/g — Chunking](https://www.nngroup.com/articles/chunking/) | **묶음 크기 3~6**, 제목이 스캔을 만든다 |
| 11 | [PatternFly — Description list](https://www.patternfly.org/components/description-list/design-guidelines/) | 라벨 위 배치의 다열 규칙, 「아이콘·링크를 늘리기보다」 |
| 12 | [Cloudscape — Split view](https://cloudscape.design/patterns/resource-management/view/split-view/) | **반증** — 「split view 는 상세 페이지를 절대 대체하지 않는다」. 236px 메타 레일을 되살리지 않을 근거 |
| 13 | [Linear — UI 리디자인](https://linear.app/now/how-we-redesigned-the-linear-ui) | 역할이 늘면 **색이 아니라 페이스·대비**를 나눈다 |

## 채택: 시안 C — 묶음 제목 + 묶음별 수정

비교표(아티팩트 §05)에서 C 만 지적 넷을 전부 건드리면서 새 표면(탭·페이지)을 만들지 않았다.
A(묶음만)는 지적 3·4 를 못 하고, B(「정보 수정」 하나)는 지적 2 를 못 하며, D(설정을 탭으로)는
커버는 넓지만 탭 9개와 라우팅을 사고, E(hover 노출)는 밀도만 낮추고 구조는 그대로다.

### 구조

| 묶음 | 셀 | 묶음 머리 동작 |
|------|-----|----------------|
| **계정 정보** | AWS 계정 · Scan Role · TF Role / GCP 프로젝트 · Scan SA · Terraform SA / Azure 구독 · 테넌트 · Scan App / IDC 환경 | **「Role 수정」** (AWS 만 — 고칠 수 있는 주체가 있는 유일한 프로바이더) |
| **대상 설정** | 리전 · 설치모드(AWS) · 실데이터 | **「설정 수정」** |
| **관련 페이지** | Jira Ticket · 서비스 담당자가 보는 화면 | 없음 |

- **리전은 「대상 설정」에 둔다.** 계정의 파티션이긴 하지만 이 화면에서는 읽기 전용 배치값이고,
  「계정 정보」를 **주체만** 지게 하면 네 프로바이더 중 셋이 정확히 3행에 선다(아래 실측).
- **묶음 이름은 오너의 낱말 그대로** — 「계정 정보로 묶이면」. 프로바이더별로 이름을 갈지 않아
  `계정 › 계정` 같은 중복도 생기지 않는다.
- 「관련 페이지」는 kv 짝을 벗는다 — 이동은 사실이 아니라, 라벨 위·값 아래 구조를 입히면
  「관련 페이지 = Jira Ticket」처럼 읽힌다. 묶음 이름이 곧 라벨이다.

### 수치 — 하나도 새로 만들지 않았다

| 값 | 출처 |
|----|------|
| 묶음 제목 12px/700 tracking .06em `--pl-gray-600` | 같은 화면 「상세 정보」 접힘의 `fmFoldLabel` |
| 묶음 간격 24px (`gap-x-6`) | 같은 접힘의 `fmFold` |
| 열 폭 460 / 220 / 220 | 접힘의 220·460 을 다시 나눈 것. 460 은 GCP Service Account 전문(≈365px 실측)이 한 줄에 드는 폭 |
| 묶음 머리 동작 12px/600 | 같은 블록 머리의 「상세 정보」 큐 (`fmLink`) |
| 셀 라벨·값·태그 | `fmKey` · `fmValue` · `metaTag` · `metaTagQuiet` 그대로 |
| 묶음 헤어라인 `--pl-border` | 블록 머리(`fmHead`)의 `--pl-border-strong` 한 단 아래 — 겹친 두 선의 순서를 design-guard 가 잡는다 |

### 편집 진입

「수정」 4개 → **「Role 수정」 · 「설정 수정」 2개**. 글자가 서로 달라 문맥 없이도 갈린다(P2).

- **`TargetSettingsModal` 신규** — 설치모드 + 실데이터 한 폼. `InstallModeModal` · `RawDataModal`
  삭제(둘 다 이 화면 전용이었다). 옛 `RawDataModal` 주석이 스스로 「같은 헤더의 설치 모드 modal 과
  같은 radio-card 한 쌍」이라 적어 두었던 그 중복이 여기서 없어진다.
- **`RoleEditModal` 이 `kinds` 를 받는다** — 헤더 묶음 머리는 주체 전부를, 스캔 탭의 자격 증명
  카드는 **판정이 떨어진 하나**만 연다(거기서 둘을 같이 열면 화면이 지목한 원인이 흐려진다).
- **바뀐 것만 PUT 한다.** 두 값/두 Role 은 엔드포인트가 달라 한 번에 저장할 수 없다. 안 건드린
  값까지 쓰면 실패 시 무엇이 되돌아갔는지 말할 수 없고, Role 은 검증 판정까지 이유 없이 초기화된다.
  앞엣것이 저장되고 뒤엣것이 실패하면 화면이 그 사실부터 말한다.

## 실측 (1440 캔버스)

| | 이전 (#791) | 이후 |
|---|---|---|
| 마스트헤드 컨트롤 | **8개** (전부 12/600 #2563EB, 「수정」 ×4) | **6개** (「수정」 ×0, 「Role 수정」·「설정 수정」 각 1) |
| 활자 센서스 | 12/600 ×20 · 12/500 ×6 · 12/400 ×3 · 14/600 ×3 · 14/500 ×7 | 12/600 ×17 · **12/700 ×3(묶음 제목)** · 12/500 ×6 · 12/400 ×3 · 14/600 ×3 · 14/500 ×7 |
| 마스트헤드 높이 | AWS 287 · GCP 287 · IDC 183 | AWS **314** · GCP **314** · IDC 218 |
| 탭 y | — | AWS 337 · GCP 337 (동일) |
| 그리드 트랙 | `repeat(4, minmax(0,240px))` | `460px 220px 220px` |

- 묶음 제목이 12/700 한 단을 새로 세우면서 **라벨(12/600)·동작(12/600 파랑)·제목(12/700)** 이
  갈렸다. 높이는 묶음 머리 한 줄만큼 **+27px**.
- 프로바이더 넷 중 **셋(AWS·GCP·Azure)이 계정 3행 · 설정 3행 · 관련 2행으로 정확히 3행**에 서고,
  스켈레톤이 그 모양을 그대로 비워 두므로 도착해도 탭이 안 뛴다.

## 남긴 것 · 열린 것

- **IDC 는 2행(218px)** 이라 스켈레톤(3행)보다 96px 짧다 — 도착하면 탭이 그만큼 올라온다.
  프로바이더는 응답이 와야 알 수 있어 스켈레톤이 미리 맞출 수 없다. 2행으로 낮추면 클라우드
  셋이 대신 뛰므로, **다수가 안 뛰는 쪽**을 골랐다(#791 에서는 넷 중 둘이 52px 뛰었다).
- **접힘의 「식별자」 그룹과 스트립의 「계정 정보」가 같은 값을 진다** — 의도된 중복이다(스트립은
  훑는 자리, 접힘은 **전문 + 복사**). 다만 이제 두 묶음의 이름이 달라 같은 것을 두 이름으로
  부른다. 접힘 쪽 이름 정리는 다음 라운드.
- **#792 의 저채도 파란 이름표**는 여전히 회색 칩이다([`ops-target-frontmeta.md`](./ops-target-frontmeta.md)
  의 열린 항목 그대로). 이번 라운드에서 손대지 않았다.
- **스트립의 말줄임**(`fmValueText`) 유지 — Cloudscape kv 는 「말줄임 금지」지만, 접힘이 전문과
  복사를 지므로 분업이 성립한다. 되돌리려면 접힘의 「식별자」부터 다시 본다.
- `RoleEditModal` 의 조립 ARN 미리보기가 `--pl-text-faint` → `--pl-text-weak` 로 내려왔다.
  흰 면에서 2.58:1 로 AA 아래였고(design 훅이 잡았다), 이 폼이 실제로 보낼 값이라 대조하는 글자다.
