# Admin · 스캔 탭 리디자인 (Target Source 운영 상세)

> 작성 2026-08-02 · 근거 화면 `/pass/admin/pipelines/ops/target-sources/1642?tab=scan` (AWS)
> 적용 컴포넌트: `ScanTab`(컨테이너) / `scanShared` / `RecentScanCard` / `ScanHistoryCard` /
> `ScanDetailModal` / `ScanCredentialCard` / `ModalShell`(공용) / `opsStyles`(cardTitle·cardDesc·skeleton) /
> `PlButton`(outline 신설) / `icons`(shield)
> 목 계층: `lib/bff/mock/scan.ts`(scan_version·demoCountMap) / `lib/mock-scan.ts`(version 영속화·보관 10개 집행) / `lib/types.ts`(ScanHistory.version)
> 진행 방식: README "How these sessions run" 라이브 리뷰 루프 + 자체 평가(P1~P3, ui-ux-pro-max) + codex 2모델 최종 게이트

운영자 질문 순서(돌고 있나 / 언제·성공했나 / 왜 실패했나 / 자격 유효한가 / 뭘 발견했나 / 과거 패턴)를
스캔 권한 + 최근 스캔 카드 한 행, 그 아래 이력 테이블로 배치했다. 이 문서는 확정된 결정과
다음 화면에 들고 갈 교훈만 남긴다 (before → after → 무엇이 고쳐졌나).

---

## 1. 발견 리소스 — 인라인 태그 → 스탯 타일 그리드

| Before | After | 고쳐진 것 |
|---|---|---|
| `NETWORK_INTERFACE 68,822 +137` 칩 나열 | 2행 스탯 타일(라벨 12/500 mono 위, 숫자 16/500 아래) 3열 그리드 | 칩 안 숫자는 시작 위치가 제각각이라 규모 비교 불가 — 그리드가 숫자 세로줄을 만든다 |
| 증감 표기 없음/뒤섞임 | 숫자 옆 12px `+N`(ok)/`−N`(err), 사라진 타입은 점선 보더 + faint count 0 | 늘어난 것·사라진 것이 한 눈에, −N도 정직하게 |
| 카드·모달 같은 표현 | 카드=요약(타일), 모달=정밀(우정렬 tabular 테이블 + sticky 헤더) | 같은 데이터의 두 밀도 — 역할 분화 |

**교훈: 수량 데이터를 카테고리 칩 이디엄에 담지 않는다.** 칩은 소속·분류용 문법이고,
비교가 목적인 숫자는 정렬(타일 그리드 or 우정렬 테이블)이 먼저다.

## 2. 가변 콘텐츠가 카드 높이를 끌고 가지 않게

- 타일 그리드 뷰포트 `h-[196px]`(3행 + 다음 행 살짝 보임) + `overflow-y-auto` — 타입 수(프로바이더·버전별 상이)와 무관하게 카드 높이 고정. "살짝 보이는 다음 행"이 스크롤 어포던스다.
- 스캔 권한 카드의 응답 원문 박스는 `flex-1` — 짝 카드가 더 길 때 남는 높이를 회색 면이 흡수해 박스 아래 흰 여백이 휑하게 남지 않는다.
- admin-feedback-round1 ①(카탈로그 모달 높이 고정)과 같은 원칙의 카드 버전: **컨테이너 크기는 콘텐츠 수가 아니라 레이아웃이 정한다.**

## 3. 스켈레톤은 최종 레이아웃의 자리를 그린다

- 최근 스캔: 헤더 줄 + 문장 줄 + 타일 9개(h-52) 자리. 이력: 행 높이(h-10) × PAGE_SIZE.
- `opsStyles.skeleton`은 task 상세 `detailStyles.skeleton` 문법 복사(`animate-pulse rounded-[10px] bg-gray-100`) — 새 문법 발명 금지.
- 로딩→실물 전환 시 점프가 없어야 스켈레톤이 의미가 있다 (자리 크기가 실물과 같아야 함).

## 4. 상태 표현의 정직성

- 진행 바는 SCANNING에서만 — 끝난 스캔의 0%/100% 진행바는 정보가 아니라 착시.
- 오류 없음 = 빈 셀 — `—`조차 시선을 끈다(운영 피드백).
- 총계 문장은 한 문장으로: "직전 스캔보다 **187개** 늘어난 총 **107,873**개를 발견했어요."
  조각 나열(`총 N개 · +N`)보다 읽힌다. 총계만 브랜드색 20px, 증감은 ok/err.
- UNVERIFIED(미검증)는 오류가 아니다 — off 톤, 오류 박스는 FAIL/INVALID 또는 서버가 원인을 보냈을 때만.

## 5. 식별자(#N)는 표시 파생이 아니라 데이터

| Before | After | 고쳐진 것 |
|---|---|---|
| `scan_version`을 이력 배열 역순 인덱스로 파생 | `ScanHistory.version` 저장(타깃별 단조증가), max 기반 카운터 | 트림·페이지네이션과 무관하게 #N 유지 — max가 항상 최신 행에 있어 오래된 행이 지워져도 카운터가 이어진다 |
| "최근 10개 버전까지만 보관" 카피만 선언 | `addScanHistory`가 10개 초과분 실제 splice | **화면이 선언한 정책은 목도 집행해야 화면이 정직하다** |

주의: in-memory 목에 version 도입 이전 행이 남아 있으면 `#-`로 보인다 — dev 서버 재시작(스토어 리셋)으로 해소. seed는 빈 배열이라 fresh store는 문제없음.

## 6. 컨테이너/뷰 분할 (codex 게이트에서 확정)

- ScanTab 644줄 갓컴포넌트(AP-B1 임계 300줄) → 184줄 컨테이너 + `scanShared`(pill·포매터·TimeField)
  / `RecentScanCard` / `ScanHistoryCard` / `ScanDetailModal`. 전부 300줄 미만.
- 컨테이너가 데이터 흐름(폴링·페이징·diff 파생)만 소유, 카드는 순수 뷰 — props 경계가 곧 문서가 된다.
- 직전 성공 대비 diff는 **1페이지 스냅샷(`firstPageRows`)에서 파생** — `rows`에서 파생하면
  사용자가 이력을 2페이지로 넘기는 순간 최근 스캔 카드의 증감이 바뀌는 버그. **UI 상태(페이지네이션)가
  흔들어선 안 되는 파생값은 스냅샷에서 계산한다.**
- 모달 상태는 `useModal<ScanJob>()` (AGENTS.md 계약) — `useState<T | null>` 재발명 금지.

## 7. 키보드 접근성

- 행 클릭이 유일한 진입로면 행에 직접: `tabIndex={0}` + Enter/Space 활성화 + `focus-visible` 아웃라인 + `aria-haspopup="dialog"`.
- ModalShell: 열릴 때 첫 버튼 포커스, **버튼이 없으면 다이얼로그 자체**(`tabIndex={-1}`) 포커스.
  포커스 가능한 요소가 없을 때 Tab이 오버레이 뒤로 새지 않게 트랩이 preventDefault.
  (이 모달은 닫기 버튼이 없다 — Esc·바깥 클릭으로 충분하다는 운영 피드백의 후속 조치.)
- 검증 중 발견한 함정: 페이지네이션 클릭 직후 행이 리로드되는 동안 포커스가 진입점 버튼으로
  점프한다 — 키보드 검증은 로딩 완료 후에.

## 8. codex 최종 게이트 — 8건 triage 기록

2모델(gpt-5.6-terra/sol) 동일 프롬프트, 엄격한 쪽을 게이트로. **채택 6 / 근거 있는 스킵 2.**

채택: ① diff 범위 신규 한국어 주석 영어화 ② useModal 채택 ③ ScanTab 4분할
④ ModalShell 포커스 폴백 ⑤ 보관 10개 목에서 실제 집행(+버전 영속화) ⑦ prevSuccess 페이지 독립(스냅샷).

스킵(재플래그 방지용 근거):
- ⑥ **demoCountMap이 step 1 사용자 화면 리소스 수와 불일치** — 수용된 데모 아티팩트.
  운영 규모(타입 ~12종, 단일 타입 ~7만)의 타일·증감·총계 렌더링 검증이 목적이라 실 mock
  리소스 수 대신 scan_version 기반 결정적 수치를 합성한다(운영자 명시 요청). 코드 주석에 caveat 명시.
- ⑧ **opsStyles cardTitle 20px가 목업(16px)과 다름** — 라이브 리뷰에서 운영자가 화면을 보고
  확정한 수치. **목업이 stale일 때는 목업이 아니라 확정된 화면이 진실이다** (토큰 주석에 사유 기록).

## 9. 다음 화면에 들고 갈 것 (요약)

1. 숫자 비교가 목적이면 칩 대신 타일/우정렬 — 정렬이 먼저다.
2. 카드·모달 높이는 콘텐츠 수가 아니라 레이아웃이 정한다(내부 스크롤 + 다음 행 피크).
3. 스켈레톤은 최종 레이아웃과 같은 자리 크기로.
4. 화면이 선언한 정책(보관 N개)은 목도 집행한다. 식별자는 파생 말고 저장.
5. UI 조작(페이지네이션)에 흔들리면 안 되는 파생값은 스냅샷에서.
6. 외부 리뷰 스킵은 근거와 함께 기록해야 다음 라운드에 재플래그되지 않는다.
