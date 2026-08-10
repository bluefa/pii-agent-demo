# Target Source 운영 — 헤더·탭·폭 벤치마크 결정 기록

- **일자**: 2026-08-10
- **대상 화면**: `/pass/admin/pipelines/ops/target-sources/{id}` 헤더 + 탭 레일
  (`OpsHeader` · `OpsTargetView` 탭 스트립 · `app/admin/pipelines/layout.tsx` 폭 분기)
- **아티팩트**: https://claude.ai/code/artifact/e7309c52-627b-4f09-9d35-53b9303375c3
  (진단 P1~P8 · 레퍼런스 · 축 A/T/W/J 시안)
- **선행**: `pipeline-detail-header.md`(형제 화면 PR #667) · `target-source-header.md`(PR #627)

## 오너 지시 (2026-08-09 ~ 08-10)

1. 헤더 디자인과 탭 디자인이 마음에 안 든다
2. 고정된 사이즈로 렌더링돼 완성도가 떨어진다 — **헤더도 탭도 오른쪽 끝까지** 이어졌으면 한다
3. **왜 서비스 이름이 타이틀인지 모르겠다**
4. 색 조합이 이상하다
5. Jira Ticket 관리 부분은 더 신경쓸 것 — **서비스 관리 페이지로 이동까지 같이** 보여야 한다
6. 채택: **A 방식**

## 문제 진단 (근거 등급)

| # | 문제 | 근거 | 등급 |
|---|------|------|------|
| P1 | h1이 서비스 이름 — 이 페이지의 주어(`Target Source #1010`)는 회색 칩으로 강등, "AWS"가 h1·코드 칩·클라우드 행에 3번 | Cloudscape details 규칙 위반. 같은 문제를 이 저장소가 두 번 뒤집었다(PR #627 P2, PR #667 공리 3) | 레퍼런스 + 자체 판례 |
| P2 | panel 없는 contained 탭 — 밴드 `#F2F4F7` / 활성 탭 `#FFFFFF` / 본문 바닥 `#F9FAFB` + 24px 간격 | 활성 탭의 흰 면이 이어질 panel이 없다. Carbon의 *line tabs* 정의가 이 화면 본문 구조를 그대로 서술 | 레퍼런스(Carbon·NN/g) |
| P3 | 여섯 면이 전부 1.0~1.1:1 (카드↔바닥 1.03:1), 가장 어두운 탭 밴드가 밝은 면 사이에 낀다 | 층이 아니라 띠로 읽힌다 | 수치 |
| P4 | `main max-w-[1440px]`인데 헤더는 `-mx-8` full-bleed → 2133px에서 477px 사공간 + 수직 seam | `layout.tsx`가 `isSplit`에서 같은 증상을 이미 진단·수정해 뒀다. 형제 상세와 `ops/services`는 둘 다 fluid | 자체 판례 |
| P5 | 협업 채널이 아무 데도 anchor하지 않는 45° 꼬리 popover, 1440 경계에 고정 | 넓은 화면에서 화면 한가운데 뜬다 | UX 원칙 |
| P6 | 헤더가 50자 mono ARN을 진다 | Cloudscape는 이것을 details 요약 컨테이너에 배정 | 레퍼런스 |
| P7 | 형제 `/admin/pipelines/{id}`가 같은 대상 #1010을 완전히 다른 헤더 문법으로 그린다 — 두 화면은 서로 링크한다 | | 자체 판례 |
| P8 | 헤더 티켓과 `관리` 목적지가 **다른 데이터 출처** | 헤더=`collaboration-channel`(swagger 부재, 목이 스스로 `assumed §4`라 주석) / 서비스 운영=`GET /install/v1/services/{code}/jira-tickets`(실계약). 화면 증거: 헤더 `INFRA-2211` vs 같은 서비스 Jira 타일 5개 전부 "연결된 티켓 없음" | 계약 |

## 채택안 — A1 · T1 · W1 · J1

### A1 — 형제 문법 이식 (P1·P7)

h1은 **`Target Source 운영` 고정 라벨**. 주어는 그 아래 3층 정체성 스택이 진다.

| 층 | 내용 | 출처 |
|---|---|---|
| 로고 | `ProviderLogo variant="bare"` 64px | 형제(공리 6) |
| 1 | `AWS` + `#1010` + 현재 단계 `StepPill` | `improvedStyles.header.prov/id` |
| 2 | `서비스 이름` 라벨 + 값 / `코드` 라벨 + 칩 | `improvedStyles.header.nameRow` |
| 3 | 계정 · 리전 · 설치모드(클릭) | AWS만 |
| 4 | Scan/TF Role ARN 행 (등록·수정) | 기존 `roleRow` |

정체성 수치는 **전부 `improvedStyles.header`에서 import**한다 — 새로 만든 값이 없고,
서로 링크하는 두 화면이 같은 대상을 같은 문법으로 그린다.

**A1 원안과 다른 두 가지**

- 3층의 `AWS 설치` 결합 태그는 넣지 않았다. 형제에서는 *실행의 종류*를 뜻하는데 이 화면에는
  대응하는 개념이 없고, 1층이 이미 `AWS`라 P1이 지적한 중복이 되살아난다.
- Role ARN 행은 **헤더에 남겼다**. A1 원안은 P6을 A3(요약 카드 분리)으로 넘기는데 A3는
  채택되지 않았다 — 등록·수정 경로를 시안 결정 없이 없앨 수는 없다. **P6은 미해소**.

### T1 — line tabs (P2·P3)

탭 밴드(`--pl-gray-100`)를 삭제한다. 탭 레일이 masthead의 마지막 줄이 되어 같은 흰 면을 쓰고,
헤더의 `border-b`를 떼어 **레일의 선 하나가 둘을 함께 닫는다**. 활성 표시는 굵기 + 파랑 +
언더라인 3중(NN/g 최소 2개 충족). 면이 하나 사라지므로 P3도 한 겹 준다.

밴드를 **낮추는** 방향(T3)은 고르지 않았다 — `target-source-header.md`의 "워시는 램프 한 칸을
잡아먹는다"가 그대로 재현되기 때문이다. 없애는 쪽은 그 함정을 피한다.

### W1 — fluid (P4)

`layout.tsx`의 fluid 분기에 `ops/target-sources`를 추가(`isOpsTarget`). 헤더·탭이 뷰포트
오른쪽 끝까지 이어지고 seam이 사라진다 (실측 2133px에서 `main` 216→2133).

**남은 것**: 표가 있는 탭은 넓은 화면에서 열이 늘어진다(인프라 작업 탭의 2:1 그리드가 가장 눈에
띈다). 표 컨테이너 자체 `max-w`가 짝인데 이번 범위 밖이다.

### J1 — 협업 채널 3층 블록 (P5, 오너 지시 5)

말풍선(꼬리·그림자·`absolute`)을 버리고 **흐름 안에 도킹된 216px 고정폭 블록**으로. 왼쪽 정체성
스택과 좌우로 대칭이다.

```
협업 채널              ← 1층 라벨
◆ INFRA-2211 ↗        ← 2층 티켓 (외부, Jira)
─────────────
서비스 aws 운영에서 관리 ↗  ← 3층 관리 위치 (내부)
```

- 목적지를 `관리` 두 글자가 아니라 **이름으로** 부른다 — 누르기 전에 어디로 가는지 안다.
- 블록에 파랑을 쓰지 않는다. 어포던스는 언더라인이 나르고(`opsStyles.countLink` 규칙), 색을
  가진 것은 Jira 마크뿐이다.
- 2층 세 상태(링크 · `연결된 티켓 없음` · 스켈레톤)를 `leading-[20px]`로 묶어 **채널이 도착해도
  헤더 높이가 변하지 않는다**. 조회 중에는 "없음"이라고 단정하지 않는다(`channelLoaded`).
- 서비스 코드가 없으면 갈 운영 화면도 없다 → 3층이 `ChannelModal`을 여는 버튼으로 바뀐다
  (기존 폴백 유지).

## 미해소 / 결정 대기

- **P8 — 헤더가 어느 티켓을 읽는가.** 이번 구현은 출처를 **바꾸지 않았다**(`collaboration-channel`
  유지, `ChannelModal` 유지). 블록은 `channel` prop 하나만 보므로 결정이 나면 배선만 갈아끼우면 된다.
  1. **실계약 이전** — `GET /services/{code}/jira-tickets`에서 이 대상의 CloudProvider 행을 골라
     `issueKey`·`browseUrl` 사용. 그러면 3층 문구가 **사실**이 된다. `collaboration-channel` GET/PUT과
     `ChannelModal`은 사라진다.
     - 선행 확인: 티켓 단위가 (서비스 × provider)인지 (대상)인지. 서비스 화면 타일은 provider
       단위인데 `JiraTicketResponse`에는 `targetSourceId`가 있다.
  2. **현행 유지** — 그렇다면 3층 문구가 "관리"가 아니라 **다른 티켓임을 드러내야** 한다.
  3. 둘 다 표시.
- **P6** — Role ARN의 거처(헤더 / 요약 카드 / 인프라 작업 탭). A3 미채택으로 보류.
- 현재 단계 pill이 헤더와 `ProcessCard`에 이중으로 있다 — 강등 여부 미결.
- fluid 전환에 따른 탭별 표 `max-w`.

## 구현

- 브랜치 `feat/ops-target-header` (`feat/ops-infra-tab` 위 스택)
- `OpsHeader.tsx` 재구성 + `improvedStyles.header` import, `opsStyles` 헤더/탭/채널 토큰 교체
- `layout.tsx` `isOpsTarget` fluid 분기
- `OpsTargetView` 가 `channelLoaded` 를 내려보낸다
- 검증: `tsc` 0 · `lint` 0 error · `vitest` 1749 passed · 실화면 AWS(1010)/GCP(1002·1017) 전 탭
