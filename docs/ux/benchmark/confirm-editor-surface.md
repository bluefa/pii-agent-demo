# 확정 정보 편집기 표면·타입 — 벤치마크 결정 기록

- **날짜**: 2026-08-17
- **대상 화면**: 확정 정보 편집기 모달
  (`app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/ConfirmEditorModal.tsx`)
- **진단 기준**: `feat/confirm-workbench @ cce7f9fe` 라이브 DOM 실측 (Chrome 1512×982, mock)
- **아티팩트**: https://claude.ai/code/artifact/8bdcc343-8917-4422-af4c-3e2ca612d9e1
  (진단 11건 · 레퍼런스 13종 · 시안 5종 전문. claude.ai 에 있어 저장소 이력 밖이라 이 문서를 남긴다)
- **선행 라운드**: `83e79fd7` 응답을 오른쪽으로 → `55c59ddc` API 클라이언트 배치 →
  `cce7f9fe` 표면 A+C(다크 응답면 + 계약 선언 응답표). 이 라운드는 그 위의 **타입과 표면**이다.

## 1. 문제 진단

근본 원인은 **로그 뷰어의 문법을 편집 폼에 빌려온 것**이다. 앞 라운드가 다크 응답면을
`JobViewer` 로그 패널에서 정당하게 가져왔는데, 같이 따라온 `12px`까지 그대로 썼다.
로그는 읽기 전용 스트림이고 이 모달은 편집 폼이라 크기를 공유할 근거가 아니었다.

| # | 문제 | 근거(실측) | 등급 |
|---|------|-----------|------|
| D1 | 12px 모노컬처 — 7개 역할이 크기 하나를 나눠 씀 | `text-[12px]` 27/31 = 87% · DOM 텍스트 노드 54/57 | 수치 위반 |
| D2 | 계층 역전 — 가장 큰 본문이 상태 문장(14), 데이터는 12 | `verdict: text-[14px]` ↔ `paramValue/codeText: text-[12px]` | 수치 위반 |
| D3 | 다크 면이 모달 코너를 먹어 바닥이 좌:흰 / 우:#1D2939 반쪽 | modal `{h:745, radius:12px}` ↔ darkPane `{h:619, t:159, radius:0}` | UX 원칙 |
| D4 | 선언 응답표 아래 480×192 = 92,160px² 검은 공백 | 마지막 행 bottom 586 ↔ pane bottom 778 | UX 원칙 |
| D5 | 메서드 배지가 색을 갖고도 안 보임 | `--pl-ok-bg #ECFDF3` on `--pl-gray-50 #F9FAFB` = **1.02:1** · 폭 가변 | 수치 위반 |
| D6 | 간격이 세트 밖 — 2·3·6·10·14·18px 이 14곳, 한 자리는 0px | `Parameters`↔열머리 6px · 설명문↔표머리 **0px** · `Server response`↔설명문 11px | 수치 위반 |
| D7 | 행간 160% | `leading-[1.6]` × 2 · 코드 `12px/20px` = 167% | 수치 위반 |
| D8 | 제목 18px — 두 권위 어느 쪽도 아님 | style-guide §1 = **16**(다이얼로그 전용) ↔ `ConfirmStepModal` = 20/700 | 수치 위반 |
| D9 | 실행 전 상태를 두 번 말하고 설명문이 표보다 무거움 | declNote `{h:62, lh:19.2}` → 아래 표 머리와 gap **0px** | UX 원칙 |
| D10 | 액션이 두 곳 — 머리 `[삭제][취소]`(32/14) vs URL 줄 `[저장]`(28/12) | `button.md` ↔ `button.sm` (`lib/theme.ts`) | UX 원칙 |
| D11 | 시각 무게가 정보 우선순위와 반대 | 편집하는 쪽은 왼쪽인데 시선은 오른쪽 검은 덩어리로 | 제안 |

### 반증 레퍼런스가 결론을 뒤집은 지점

Hoppscotch 실측 결과 **그쪽도 12px/10px 모노컬처**였다(텍스트 노드 105개 중 12px 지배).
그래서 "12px 이 틀렸다"는 결론은 성립하지 않는다. 차이는 하나다 — Hoppscotch 는
**전면 다크(#181818) + 창 전체를 차지하는 도구**라 계층을 크기가 아니라 표면 층이 만든다.
12px 은 **전면 다크 도구의 문법**이고, 이 모달은 라이트 어드민 안에 뜨는 960px 다이얼로그다.

## 2. 실제로 차용한 레퍼런스

아티팩트에는 13종이 있고, 그중 코드가 실제로 값을 가져온 것은 아래 7종이다.

| 레퍼런스 | URL | 차용한 요소 | 확인 |
|---|---|---|---|
| Carbon — Type sets | https://carbondesignsystem.com/elements/typography/type-sets/ | `heading-compact-01` 14/18/600 → 섹션 제목 · `label-01` 12/16 → 라벨 · **`code-02` 14/20 → 코드** | DOM 실측 |
| Cloudscape — Typography | https://cloudscape.design/foundation/visual-foundation/typography/ | `body medium` 14/20 → 데이터 · `body small` 12/16 = "description, constraint text" → 메타 | 문서 |
| Swagger UI (Petstore) | https://petstore.swagger.io/ | `Parameters` 14/700 · 응답 코드 셀 14/400 · **메서드 배지 폭 고정** | DOM 실측 |
| GitHub REST Docs | https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28 | 상태 코드표 = 표머리 14/600 + 셀 14/400 | DOM 실측 |
| Vercel Geist | https://vercel.com/geist/typography | 제목 램프 하한이 `text-heading-14` — 12는 제목이 아니다 | DOM 실측 |
| Insomnia | https://docs.insomnia.rest/insomnia/get-started | 표면을 안 바꾸고 **솔리드 status 알약**으로 요청/응답을 가른다 | 기억 기반 |
| 이 레포 — Raw 렌즈 | `…/tabs/confirm/panes.tsx` `paneStyles.raw` | `--pl-gray-50` 라이트 코드 면 선례 — 시안 B 가 발명이 아님을 보증 | 코드 |

차용하지 않은 것: Stripe(인셋 카드 = 시안 A 전용) · Hoppscotch/GraphiQL(전면 다크 = 시안 C 기각) ·
Postman/Cloudscape Modal footer(D9 는 문장 삭제로, D10 은 보류) · JobViewer(다크 폐기).

## 3. 채택안 — 공통 전제 + 시안 B (오너 선택)

비교표에서는 **A(인셋 다크 카드)** 를 추천했으나 오너가 **B(라이트 2등급 — 다크 폐기)** 를 선택했다.
B 의 근거는 아티팩트 표에도 있다: D3·D4·D11 을 A 와 같은 S 비용으로 닫으면서 다크 토큰
의존이 아예 없어진다.

### 3-1. 공통 전제 — 크기 세 단

| 역할 | 전 | 후 | 값의 출처 |
|---|---|---|---|
| 다이얼로그 제목 | 18/700 | **16/700** | admin-pipeline-style-guide §1(16 = 다이얼로그 전용, 2026-07-05 오너) |
| 섹션 제목 | 12/700 | **14/600** | Carbon `heading-compact-01` · Geist 램프 하한 · Swagger `Parameters` |
| 데이터(파라미터명·응답 코드·description) | 12 | **14** | Cloudscape `body medium` · GitHub · Swagger 응답 코드 셀 |
| 라벨·메타(판정 문장 포함) | 12/14 혼재 | **12** | Carbon `label-01` — 판정 문장이 14 → 12 로 내려온다 |
| 코드(편집기·응답 본문·gutter) | 12/20 (167%) | **14/20 (143%)** | Carbon `code-02` — **leading 20px 은 그대로, 크기만 올린다** |
| 버튼 | `md`(32/14) + `sm`(28/12) | **`md` 한 단** | `lib/theme.ts` · design-guide §4 "버튼=셀렉트=인풋 동일 높이" |
| 메서드 배지 | `--pl-ok-bg` 틴트 · 가변폭 | **솔리드 · `w-16`(64px)** | POST `--pl-ok-text` · DELETE `--pl-err-text`, 흰 글자 |
| 간격 | 2·3·6·10·14·18 (14곳) | **{4,8,12,16,24}** | style-guide §2 |

크기 분포: `text-[12px]` 27 → **14** · `text-[14px]` 2 → **12** · 16px **2**. 세 단이 균형을 갖는다.

### 3-2. 시안 B — 응답면을 `--pl-gray-50` 으로

표면 세 등급은 유지하되 출력 등급을 다크에서 내린다:
**설정(`--pl-gray-50`) → 입력(흰) → 출력(`--pl-gray-50`)**. 출력이 설정과 같은 등급인 것은
의도다 — 둘 다 만질 수 없는 면이고 만질 수 있는 것은 가운데 흰 편집기 하나다.

- 설정과 출력이 분할선에서 맞닿으므로 응답 칸이 `border-l` 을 진다.
- 응답 머리는 한 단 위 면(`--pl-gray-100`) + `--pl-gray-300` 밑줄. **면만으로는 부족하다** —
  `#F2F4F7` on `#F9FAFB` 는 1.05:1 이라 밑줄이 실제 구분을 낸다.
- **신택스 색을 쓰지 않는다.** 밝은 응답면에 색을 얹으면 두 칸이 서로 닮아져 좌우 대조의
  기준이 사라진다(직전 라운드 시안 B 반려 사유). 계조는 두 단 — 키 `--pl-text-medium` /
  나머지 `--pl-text-strong`. `colorize` 가 3색 → 1클래스로 줄었다.
- 판정은 **솔리드 status 알약**이 혼자 진다(Insomnia). 옅은 틴트면 D5 가 알약에서 재발한다.

### 3-3. 오너 추가 지시 — Parameters 두 열

- **`targetSourceId` 행 제거**: path 에 박혀 바꿀 수 없고 ②의 URL 과 머리의 칩이 이미 두 번 말한다.
- **`In · Type` 열 제거**: `path`/`query` 는 URL 이 보여 주고(경로에 박혔는지 `?` 뒤인지),
  `boolean` 은 값 자리의 체크박스가 그 자체로 말한다 — 세 번째 열이 하는 일이 없었다.
- 남는 파라미터는 `applyNLBSecurityGroup` 하나이고 계약이 AWS POST 에만 두므로,
  **다른 provider·삭제 모드에서는 Parameters 구역째 없다**(`hasParams`). 빈 표는
  "여기서 뭘 정하는가"에 답하지 않는다.

## 4. 실측 검증 (mock, 1512×982)

| 프레임 | 결과 |
|---|---|
| AWS #1018 등록 | Parameters 2열(Name/Value)·`applyNLBSecurityGroup` 한 행 · 응답면 `--pl-gray-50` |
| POST 배지 | 면 `#027A48`·흰 글자 **5.41:1** · 면↔바 **5.18:1** · **폭 64px** (전 1.02:1) |
| 등록 | `201 Created · 707 ms` 솔리드 초록 알약 |
| 본문 `["not-an-object"]` | `400 Bad Request · 20 ms` 솔리드 빨강 **6.57:1** + ProblemDetails 두 계조 |
| 삭제 모드 | `DELETE` 솔리드 빨강 · 폭 64px 로 경로 x 불변 · Parameters 구역 없음 · `[인프라 철거로 이동]`(APPLIED) |
| IDC #1022 | **Parameters 구역 없음** · `Request body` 가 첫 줄이라 위 여백 없음 · `추천 5건` |
| 88줄 문서 `scrollTop 400` | textarea 400 = gutter 400 · 양쪽 `14px/20px` · top 256 동일 |
| 모달 전 텍스트 대비 스윕 | 52개 검사, 실패는 **disabled 버튼 1종**뿐(선존 `PlButton`, WCAG 1.4.3 예외) |

게이트: `tsc` 0 · `eslint` 0 errors(선존 warning 37, 무관 파일) · `vitest` **230 files / 2017 tests**.

## 5. 남긴 것 · 기각한 것

### 이번에 닫지 않은 진단

- **D4 는 부분만 닫혔다.** 응답 칸 아래 공백은 여전히 있다(실측 365px @ 972vh) — 다만
  검정이 아니라 `--pl-gray-50` 이라 무게가 크게 줄었다. 완전 해소는 시안 A(인셋 카드가
  내용 높이만 갖는 것)의 메커니즘이라 B 에는 없다. 아티팩트 비교표가 B 의 D4 를 ●로
  적은 것은 과대 평가였다 — **◐가 맞다.**
- **D10(액션 두 곳)은 열어 뒀다.** URL↔Send 인접성은 API 클라이언트 6종이 예외 없이
  지키는 규칙이라 가볍게 버릴 수 없고, "실행은 위 · 종료는 아래"가 실제로 걸리는지는
  화면을 보고 판단하는 편이 싸다(시안 D).

### ⛔ 기각 — 전제가 바뀌지 않는 한 재제안 금지

- **시안 C 전면 다크** — 다크 토큰 셋 신설 + `design-exempt` 도배 + 어드민 유일 다크 모달.
  전제 변화 조건: 어드민 전체 다크 테마 도입.
- **요청/응답 상하 분할** — `83e79fd7` 이 "응답을 아래가 아니라 오른쪽에"로 결정한 방향.
- **바이트 크기 표기** — 화면이 든 본문은 재직렬화된 것이라 와이어 크기가 아니다.
- **Swagger 의 `#49CC90` 그대로 쓰기** — 흰 글자가 **2.03:1** 로 AA 미달. 규칙(솔리드 +
  고정폭)만 빌리고 값은 우리 토큰에서 고른다.
- **좌우 JSON 줄 정렬** — 왼쪽 설정 블록이 더 높아 줄이 안 맞는다. 맞추려면 오른쪽 위에
  그만큼 패딩을 넣어야 하고, 그건 방금 없앤 공백을 다시 만드는 일이다.

### ⚠️ 이 안이 안고 가는 비용

**두 pane 의 표면 대비가 1.05:1** 이다(흰 `#FFFFFF` ↔ `--pl-gray-50 #F9FAFB`, 브라우저 실측).
이건 첫 벤치마크의 D2("두 pane 이 5% 명도차")와 같은 수치이며, 이번에는 **우연이 아니라
선택**이다. 요청/응답 구분은 표면이 아니라 세 채널이 진다: `border-l` · 응답 머리 밴드
(`--pl-gray-100` + `--pl-gray-300` 밑줄) · **솔리드 status 알약**. 그래서 알약을 옅은 틴트로
바꾸면 구분 채널이 하나 줄어든다 — 알약의 솔리드는 장식이 아니라 구조다.
