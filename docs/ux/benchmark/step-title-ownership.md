# 단계 이름의 소유권 — 세 번의 1단계

- **일자**: 2026-08-24
- **대상**: `/pass/target-sources/{id}` 설치 화면의 스텝 카드 머리 + 「설치 진행」 plate + 가이드 패널 머리
- **구현 PR**: #777
- **아티팩트**: https://claude.ai/code/artifact/7884b31b-a3ad-4fcd-af66-76ebc626883f
- **선행 라운드**: [표면 위계(링과 이음매)](step-card-frame.md) · PR #774

## 문제

오너 지적: *"제목이 가변적인 게 조금 보기 싫어. 그리고 N단계라는 부분이 2번 반복되고 있어서 이게 적절한지도 조금 의문이야."*

`origin/main @ 424806d4`, 뷰포트 1920×958, `getBoundingClientRect()` 실측.

| # | 문제 | 근거 등급 | 실측 |
|---|---|---|---|
| P1 | 같은 문자열 「연동 대상 DB 선택」이 한 화면에 **제목급으로 3회** | 수치 | y244 12px/600(plate) · y381 22px/800(카드 h2) · y261 14px/700(가이드 h4) |
| P2 | 파란 알약 두 개가 **구별 불가능한 쌍둥이** | 수치 | 둘 다 `#0050D6` on `#E8F1FF`, radius 6, 12px. 굵기 600/700, 세로 패딩 3/2만 다름. 간격 115px |
| P3 | 카드 제목 폭이 단계마다 **100 → 229px** (2.3배) | 수치 | 「연결 테스트」 100 · 「완료 여부 관리자 승인 대기」 229 (22px/800 Pretendard) |
| P4 | 중복인데 **일치하지도 않는다** | 수치 · WCAG 3.2.4 | 7단계 레일 「완료」 vs 카드 「PII 모니터링 모듈 연동」 · 6단계 「관리자 승인 대기」 vs 「완료 여부 관리자 승인 대기」 · IDC 1단계 「선택」 vs 「입력」 |
| P5 | 헤더 세로에서 **중복이 새 정보의 2.2배** | 수치 | 헤더 137px 중 알약 22 + 간격 6 + 제목 26 = 54가 중복, 안내 문장 25가 새 정보 |
| P6 | 이 22px는 **페이지 전체에서 단 하나** | 수치 | 활자 램프 22 → 16 → 14 → 12. `<h1>`은 12px 브레드크럼 |
| P7 | 옆 블록은 고정 라벨 + 가변 값인데 카드만 **라벨 자체가 가변** | UX 원칙 | 「설치 대상」·「설치 진행」 = `projectHeaderStyles.blockLabel`, 둘 다 고정 문자열 |

오너가 말한 「가변적」의 실체는 P3+P6이다 — 가변성 자체가 아니라, **가변 문자열이 페이지 유일의 최대 활자**인데 같은 말이 다른 데 두 번 더 있어 매번 "새 정보인가"를 판정해야 한다는 것. 「2번」은 실제로 3번이었다.

## 채택한 안 — 시안 E (인라인 알약 앵커)

레퍼런스 13개를 놓고 5개 안을 비교했다. 비교표의 결론:

- **E** — P1~P5 전부 덮고 **2줄**, 파란 단계 알약 문법 유지, 고정폭 42px 앵커 확보
- C(번호를 제목 안으로) — 같은 커버리지지만 카드 머리에서 파랑을 잃고 레일 알약과의 형제 관계가 끊긴다
- B(소유권 분할만) — E의 부분집합. 제목 폭 스윙(P3)이 안 풀린다
- A(알약만 제거) — 오너 지적의 직역이지만 앵커가 사라져 P3이 **악화**
- D(제목 강등·문장 승격) — 문자 그대로의 답이나 **반증**: 페이지 최대 활자가 18px가 되고 제목이 하나도 안 남는다. 선행 라운드의 「카드에 힘을」과 정면 충돌

번호를 1회까지 줄이지 않은 이유는 레퍼런스 13(반증 레퍼런스)이다 — 위치 신호는 겹칠수록 강해진다. 남는 둘은 **진행률**(레일)과 **이름표**(카드)로 하는 일이 다르고, 이름 셋은 정확히 같은 일을 했다.

## 실제로 쓴 레퍼런스

| # | 출처 | URL | 가져온 것 |
|---|---|---|---|
| 1 | GOV.UK Design System — Headings with captions | https://design-system.service.gov.uk/styles/headings/ | 단계 표시는 제목과 한 덩어리인 캡션이지 떨어진 배지가 아니다 |
| 2 | DfE · Register of training providers — how we use heading captions | https://becoming-a-teacher.design-history.education.gov.uk/register-of-training-providers/how-we-use-heading-captions/ | *"adds no extra value and makes the caption harder to scan"* — 문맥이 분명하면 뺀다는 판단을 먼저 내린 기록 |
| 3 | HMRC Design Patterns — Page heading | https://design.tax.service.gov.uk/hmrc-design-patterns/page-heading/ | *"captions nested within the `<h1>` can be repetitive"* — 중복은 스크린리더에서도 문제다 |
| 4 | AWS Cloudscape — Multipage create (wizard) | https://cloudscape.design/patterns/resource-management/create/multi-page-create/ | 같은 이름을 여러 곳에 둘 거면 한 글자도 달라선 안 된다 (P4의 근거) |
| 5 | GitHub Primer — PageHeader | https://primer.style/product/components/page-header/ | *"subtitle variant … when a primary title already exists elsewhere on the page"* — 강등은 공식 변형이다 |
| 6 | IBM Carbon — Progress indicator, usage | https://carbondesignsystem.com/components/progress-indicator/usage/ | 라벨은 1~2단어, **번호는 레일이 붙인다** |
| 7 | WCAG 2.2 SC 3.2.4 Consistent Identification | https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html | 같은 것에 다른 이름 = 기준 위반. P4는 취향 문제가 아니다 |
| 8 | NN/g — 10 Usability Heuristics #8 | https://www.nngroup.com/articles/ten-usability-heuristics/ | *"Every extra unit … diminishes their relative visibility"* — 세 번째 복사본이 첫 번째를 약하게 만든다 |
| 9 | NN/g — Wizards | https://www.nngroup.com/articles/wizards/ | 위치 표시의 임무는 「전체 중 어디」. 이름은 카드의 몫 |
| 10 | Salesforce Lightning — Page headers | https://www.lightningdesignsystem.com/components/page-headers | `name-meta`(고정) 위, `name-title`(가변) 아래 — 착지점은 고정 라벨 |
| 11 | Ant Design — Steps | https://ant.design/components/steps | `title`/`subTitle`/`content` — 스텝 컴포넌트가 이미 이름을 소유한다는 게 컴포넌트 계약 |
| 12 | GOV.UK — Step by step navigation | https://design-system.service.gov.uk/patterns/step-by-step-navigation/ | 번호는 패턴이 붙이는 것. 각 섹션이 스스로 달지 않는다 |
| 13 | NN/g — Navigation: You Are Here (**반증**) | https://www.nngroup.com/articles/navigation-you-are-here/ | *"Navigation signaling is reinforced by breadcrumbs and headings"* — 위치 신호는 겹칠수록 강해진다. 번호를 2회로 남긴 근거 |

## 구현 중 알게 된 것

- **열세 번째 헤드가 있었다.** `ConnectionVerifiedStep`(클라우드 6단계)이 `cardStyles.stepTag`를 import 하지 않고 클래스 문자열을 손으로 베껴 두고 있었다. 렌더 결과가 같아서 토큰을 grep 하는 어떤 것에도 — 첫 커밋이 추가한 census 에도 — 보이지 않았고, 브라우저로 1801을 열어 보고서야 잡혔다. census 를 **렌더된 알약**으로도 세도록 고쳤다.
- **가이드 `<h4>`의 전제는 이미 소멸해 있었다.** 주석이 근거로 든 "패널 헤더는 「가이드」만 말한다"는 `GuidePanel`이 「N단계 가이드」를 찍기 시작한 시점(오너 지시 2026-08-23)에 거짓이 됐다. 클라우드 1단계만 `<h4>`가 단계 이름이었고, 나머지 열 개는 전부 상황을 설명하는 문장이라 애초에 이 슬롯이 예외였다.
- **제목 크기를 하드코딩한 테스트 4개**가 `text-[22px]`를 물고 있었고 이름은 아직 「v15 26px」였다. 리터럴이 이미 한 라운드 밀려 있었다는 뜻이라, 토큰을 보게 바꿨다.

## 남은 것

- **P6 근본** — 활자 램프가 20 다음 16으로 빈다. 페이지에 20px 위 등급이 없다는 것은 카드 머리가 아니라 **페이지 헤더 정체성 블록**의 문제다(서비스 이름·Account ID가 전부 14~16px).
- **P4의 문안** — 「전체 단계」를 펼치면 도로에는 여전히 「완료」가 있다. 7단계의 진짜 이름이 「완료」인지 「PII 모니터링 모듈 연동」인지는 문안 결정이다. IDC 1단계 「입력」/「선택」도 같은 건.
- **`ConnectionVerifiedStep`의 상태 배지**도 `cardStyles.stepBadge` 값을 손으로 베껴 두고 있다. 이번 변경이 만든 것이 아니라 건드리지 않았다.
