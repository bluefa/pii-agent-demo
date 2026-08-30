# 논리 DB 관리 모달 — 저장 결과를 모달 안에서 말한다

- **날짜**: 2026-08-30
- **대상 화면**: TargetSource 상세 5단계 · 연결 테스트 카드 → `논리 DB 관리` 모달 (`LogicalDbModal`)
- **아티팩트**: [벤치마크(5안 비교)](https://claude.ai/code/artifact/2ae960cd-b928-47bb-a557-1935759d3d74) · [최종 스펙](https://claude.ai/code/artifact/b70f9214-bfc7-4fae-9036-480486cc24a1)

## 문제

| # | 문제 | 근거 등급 | 출처 |
|---|---|---|---|
| 1 | 성공하면 `toast.success()` → `logicalModal.close()` 순서라, 결과 문장이 뜨는 순간 사용자가 보던 상자가 이미 없다. 토스트는 우상단, 모달은 화면 가운데 | 수치 위반 | `ConnectionTestCard.tsx:485-490` · `IdcStep5ConnectionTest.tsx:286-294` |
| 2 | 그 토스트가 **2,000ms** 산다. 그런데 그 문장이 이 저장의 유일한 의미를 들고 있었다 — "연결 테스트를 다시 실행해야 반영됩니다" | 수치 위반 | `lib/constants/timings.ts:10` (실패는 ×1.5 = 3,000ms) |
| 3 | 실패는 `close()`를 안 부르므로 모달이 열린 채 남는데, **모달 안에 배너도 사유도 재시도도 없다.** 토스트 한 줄이 전부이고 모든 원인이 같은 문장 | 수치 위반 | `ConnectionTestCard.tsx:492-494` |
| 4 | `saving` 플래그가 Loader에만 있고 모달로 안 내려간다. 저장 버튼은 눌린 뒤에도 활성 | 수치 위반 | `LogicalDbModalLoader.tsx:50` · `logical-db-types.ts:52-69` |
| 5 | 푸터가 저장 **전**엔 `저장 전 변경 3건 — …`으로 정확히 말해 놓고, 눌린 순간 그 원장이 상자와 함께 사라진다 | UX 원칙 | `LogicalDbModal.tsx:297-318` |

토스트가 모달에 가려지지는 **않는다** — 둘 다 `z-50`이지만 `ToastProvider`가 `{children}` 뒤에 `ToastContainer`를 그린다. 확인했고, 결함이 아니다.

## 레퍼런스 (전부 이 세션에서 직접 열어 인용)

| 출처 | URL | 빌린 것 |
|---|---|---|
| AWS Cloudscape — Modal | https://cloudscape.design/components/modal/?tabId=usage | "Use a flash message to confirm the result of committing modal data." — 모달은 묻는 표면이지 보고하는 표면이 아니라는 **반대** 입장 |
| AWS Cloudscape — Delete patterns | https://cloudscape.design/patterns/resource-management/delete/ | 심각성이 사는 건 **확인의 마찰**이지 결과 화면의 크기가 아니다 → 되묻기 시안을 기각한 근거 |
| IBM Carbon — Notification | https://carbondesignsystem.com/components/notification/usage/ | "Place inline notifications at the bottom of forms, just above the submission and cancel buttons." + 인라인은 자동으로 안 사라진다 |
| Shopify Polaris — Modal | https://shopify.dev/docs/api/app-home/web-components/overlays/modal | "For destructive actions, explain the consequences in the modal body." → 다음 행동 문장이 본문에 남을 자리 |
| NN/g — Confirmation Dialogs | https://www.nngroup.com/articles/confirmation-dialog/ | "Do not use confirmation dialogs for routine actions." + 실패를 토스트로 말하지 마라 |

Atlassian Design System 은 클라이언트 렌더링이라 본문을 못 받았다. **인용문을 지어내지 않고 세트에서 뺐다.**

## ⚠️ 채택안은 레퍼런스 합의를 의도적으로 벗어난다

다섯 곳의 합의는 두 줄이었다.
1. **성공** = 버튼이 진행 중을 보이고, 모달이 닫히고, 전역 토스트가 알린다. **전면 성공 프레임을 지지하는 곳은 없었다.**
2. **실패** = 모달 안, 푸터 버튼 바로 위, 지속형. 여기는 이견이 없었다.

리서치 단계의 추천은 그래서 **시안 05**(성공만 프레임, 실패는 밴드)였다. **오너가 뒤집었다** — 성공도 실패도 모달 안 프레임으로, 토스트는 삭제. 그 판단의 근거는 기록해 둘 값어치가 있다:

- 레퍼런스들의 "닫고 토스트"는 **결과가 뒤 화면에 보인다**는 전제 위에 있다. 여기서는 제외 정책의 효과가 **다음 연결 테스트 전까지 아무 데도 안 보인다.**
- 그 "안 보이는 결과"를 설명하는 문장이 지금 2초 살고 사라진다.
- 앱이 이미 같은 예외를 만들어 뒀다 — `ConfirmStepModal.explicitDismiss`의 주석이 "화면에 남는 호출자"를 위한 것이라고 말하고, 운영 콘솔(`ServiceDetailView.tsx:1053`)이 그 소비자다.

**이 판례를 뒤집으려면 위 세 전제 중 하나가 무너져야 한다** — 특히 첫 번째(결과가 뒤 화면에 즉시 보이게 되면) 레퍼런스 합의 쪽이 다시 맞다.

## 무엇을 빌리고 무엇을 안 빌렸나

- **빌렸다**: `ConfirmStepModal`의 `lg` 결과 프레임 눈금(타일 80 · 글리프 40/38 · 제목 24 · 설명 16 · 사유 14), 체크 draw 애니메이션, 코드로 사유를 고르는 규칙(ADR-008 / ADR-013 §D2), 그리고 `useConfirmSubmit`이 문서화한 **`phase`(그릴 프레임)와 `pending`(요청 중)을 한 값에 넣지 않는다**는 규율.
- **안 빌렸다**: `useConfirmSubmit` 자체 — `pendingStatus` + `/process-status` 되읽기에 얹힌 **단계 전이 기계**인데, 논리 DB 저장은 `process_status`를 안 움직인다. `ConfirmStepModal` 상자도 — 천장이 `lg = 760px`이고 이 모달은 `size="wide"` = 920px `chrome="bare"`다. **이 모달이 제 프레임을 갖는다.**
- 문구 표도 따로 든다(`logical-db-failures.ts`). 같은 에러 코드라도 "승인을 요청한다"의 실패와 "제외 목록을 바꾼다"의 실패는 사용자가 다음에 할 일이 다르다.

## ⛔ 상자는 움직이지 않는다 (오너의 명시 제약)

편집 카드는 **한 높이가 아니다**. `저장 전 변경` 배너가 첫 변경과 함께 나타나고 그게 **53px**이다(707 → 760 실측). 열릴 때 한 번만 재면 707을 박고, 결과 순간에 정확히 그만큼 줄어든다 — 제약이 막으려던 바로 그 현상.

그래서 측정은 **모든 편집 렌더**에서 ref로 들어가고, 노드에 쓰는 것은 **결과가 설 때 한 번**이다. 편집 상태에서 쓰면 `offsetHeight`가 방금 쓴 핀을 되읽어 래칫이 걸린다.

원장 목록은 프레임이 남긴 여백을 **흡수**한다. 프레임은 측정된 floor 를 `minHeight` 와
`maxHeight` 로 **둘 다** 받으므로 카드가 자랄 수 없고, 프레임의 자식 중 `shrink-0` 이 아닌 것은
원장 하나뿐이라 줄어드는 것은 언제나 목록이다.

**천장은 프레임 하나만 쥔다.** 목록에는 제 높이 상한이 없다 — 고정값을 하나 더 두면 방이 얼마나
남았는지와 무관한 숫자가 되고(Resource ID 가 두 줄로 접히면 floor 가 움직인다), 둘 중 어느 쪽이
이겼는지 코드를 읽어야 알게 된다. 목록이 가진 것은 **바닥**이다: `min-h-[74px]` = 두 줄(37px 실측 × 2).
`flex-1` 을 목록에만 두고 원장 자체에는 두지 않은 이유는 따로다: `flex: 1 1 0%` 는 줄어들 뿐 아니라
**자라기도** 해서, 1건짜리 원장이 텅 빈 높은 상자가 된다.

`min-h-0` 은 장식이 아니다. flex 항목의 기본 바닥은 제 내용이라, 프레임과 원장 **양쪽**에 이것이
없으면 스크롤 상자가 제 내용 밑으로 못 줄어들고 캡이 아무 일도 하지 않는다.

**탈출 해치는 프레임이 스스로 판정한다.** 두 줄짜리 원장마저 안 들어가는 방이면 천장 쪽이 양보한다
(`scrollHeight > clientHeight`) — 읽을 수 없는 원장은 움직인 상자보다 나쁘다. 목록을 재서 숫자와
비교하지 않는 이유는 그 숫자를 두 번 적지 않기 위해서다: 바닥은 그것을 강제하는 토큰에 한 번만 적힌다.
앞선 구현은 `clientHeight < 74` 로 판정했는데, 1건짜리 원장은 눌려서가 아니라 **행이 하나라서** 37px 이다 —
가장 흔한 경우에 상자의 이동 자유를 되돌려주고 있었다(실측으로 잡았다: 1건 케이스가 `maxH: ""`).

**기각한 대안**: 원장 캡을 ~124px 또는 240px 상수로 고정(헤더 높이에 따라 floor 가 달라지는데 상수가 못 따라간다) ·
프레임 전체를 스크롤(`닫기` 가 접힘 아래로 내려간다) · +62px 성장 수용(오너 제약 위반).

## 검증

브라우저 실측(dev :3001, targetSourceId 1010, RDS Cluster). `getBoundingClientRect()` on `[role="dialog"]`:

| 저장된 변경 | 편집 | 성공 | 실패 |
|---|---|---|---|
| 1 | 920 × 760 | 920 × 760 | 920 × 760 |
| 3 | 920 × 760 | 920 × 760 | 920 × 760 |
| 6 | 920 × 760 | 920 × 760 | 920 × 760 |
| 12 | 920 × 760 | 920 × 760 | 920 × 760 |

이 표는 목록이 아직 `max-h-[240px]` 을 함께 지고 있을 때 잰 것이다. **천장을 걷어낸 최종 코드로 다시
쟀고 같았다** — 3건: 편집 758.56 → 결과 758.99(카드 핀이 정수 759px 이라 서브픽셀 0.44), 폭 동일,
프레임 `min` = `max` = 570.618, 목록 111px(행 37 × 3, 스크롤 없음). 5건(캡 이전에 820.8 이던 그 경우):
카드 920 × 759, 목록 client 125 / 내용 185 = **3.38행** 표시 + 스크롤. 두 경우 모두 `닫기` 가 카드 안.

프레임은 모든 경우에 `minHeight` = `maxHeight`(약 571). 목록은 3건까지 스크롤하지 않고 5건부터
스크롤하며, 보이는 행은 **3.3~3.4행** — 세 행과, 목록이 이어진다고 말하는 조각 행 하나. `닫기` 는
모든 경우에 카드 경계 안. 편집 카드는 변경이 없을 때 **707**, 첫 변경으로 `저장 전 변경` 배너가 서면 **760**
(Δ 53) 이라, 열릴 때 한 번만 재는 핀은 정확히 그만큼 상자를 줄였을 것이다.

Esc·바깥 클릭이 프레임을 안 닫음 / 실패 중 `다시 저장하기` 가 표로 안 돌아감 / 재시도 성공 시 전환 /
**토스트 0건** / `닫기` 후 뒤 카드 갱신 / `제외 1건이 정책에 반영됐어요.` — `복원 0건` 절이 빠짐.

뮤테이션으로 고정한 트립와이어 4건: `saving` 을 저장 disable 에서 빼기 · 실패 코드를 `UNKNOWN` 으로
고정(테스트 2개) · `canRetry` 가 표를 무시하게 하기 · `closeOnEscape` 를 항상 켜기.

**jsdom 은 이 클래스의 결함을 못 잡는다** — `offsetHeight`/`getBoundingClientRect` 가 0이라
높이 핀 결함이 23/23 통과 상태에서도 살아 있었고, 캡과 탈출 해치도 실측으로만 검증된다.
교차 리뷰가 코드만 읽고 같은 핀 결함을 짚었다(P1 1건, 그 외 전부 정상 판정).
