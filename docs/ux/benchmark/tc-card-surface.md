# Step 5 연결 테스트 카드 — 표면(상자 중첩) 정리

- 날짜: 2026-08-21
- 대상: `ConnectionTestCard.tsx`(클라우드) · `IdcStep5ConnectionTest.tsx`(IDC) · `TcRejectionNotice.tsx`(공용)
- 리서치 아티팩트: https://claude.ai/code/artifact/5f4c3370-3cb9-4d58-9274-81f2bac144be

## 문제 (증거 등급)

| # | 진단 | 등급 |
|---|------|------|
| P1 | 카드 안 테두리 박스 최대 3개 동거(반려 경고 · 요약 스트립 · Credential 경고) — 조작 대상은 스트립 하나 | UX 원칙 (RULE 11: 테두리 표면은 화면당 1개) |
| P2 | 다른 계급의 사실(반려=라이프사이클 사건 vs Credential=표의 결측)이 같은 amber 박스 문법 — 우선순위 소멸 | UX 원칙 |
| P3 | 한 카드 안에 이상 알림 문법 두 벌 — 에러 3종은 맨 줄, 경고 2종은 박스. 시각 등급과 실제 등급이 어긋남 | UX 원칙 |
| P4 | body `space-y-4` 균일 여백이 소속을 지움 — 경고가 스트립의 꼬리인지 표의 예고인지 거리가 말하지 않음 | 수치 위반 (여백 가이드: 층위가 다르면 거리도 다르게, 섹션 간 ≥ 내부 2배) |
| P5 | 스트립 자체도 틴트+테두리 상자 | 제안 (이번 회차 미해결로 남김) |

## 채택 — 시안 A "맨 줄 강등"

경고 2종을 배경·테두리 없는 한 줄(아이콘 + 볼드 문장 + 링크)로 내리고, 여백으로 소속을 가른다:

- `TcRejectionNotice`: amber 박스 → 맨 줄. 아이콘 + 볼드 + warning 잉크가 박스가 지던 심각도 채널을 대신한다. 문장·시각·사유 구조는 그대로.
- Credential 미설정 경고(클라우드·IDC 동일 마크업): amber 박스 → 맨 줄. "미설정만 보기" 필터 링크 유지.
- 카드 body: 균일 `space-y-4` → 그룹 2개. 판정 그룹(반려 줄·요약 스트립·조회 실패 줄) 내부 8px, 표 그룹(Credential 줄·표 스택) 내부 8px, 그룹 사이 24px.

비교표 근거: 다섯 시안 중 유일하게 **비용 S + 기존 화면 일관성 ●**로 P1~P4를 채운다 — 에러 줄 문법과 warning 잉크 선례만 재사용, 새 부품 없음, IDC·admin 파급 없음. P5(스트립도 상자)는 시안 B(머지박스 스택 — 반려·판정·경고를 한 상자의 헤어라인 행으로)가 2차 후보로 남는다; 시안 A의 "행 + 여백" 문법이 그 사전 작업이 된다.

## 실제 차용한 레퍼런스

| 레퍼런스 | 빌린 요소 | URL |
|----------|----------|-----|
| Atlassian SectionMessage/InlineMessage | 박스/맨 줄 결정축 = 스코프. 지점 맥락 메시지는 상자 없이 아이콘+텍스트 | https://atlassian.design/components/inline-message/usage |
| AWS Cloudscape Split view | "Omit the containers … to reduce visual noise" — 경계 안의 사실은 상자 없이 | https://cloudscape.design/patterns/resource-management/view/split-view/ |
| Material Design Banners | "Only one banner should be shown at a time" — amber 박스 2개 동거의 직접 반례 | https://m2.material.io/components/banners |
| Shopify Polaris Banner | 배너는 아껴서, 요약 1 + 현장 인라인 표기의 분업 | https://github.com/Shopify/polaris/blob/main/polaris.shopify.com/content/components/feedback-indicators/banner.mdx |
| NN/g Cards | 같은 무게 상자 N개 = 랭킹 소멸 — 확인 작업 화면엔 행 문법 | https://www.nngroup.com/articles/cards-component/ |
| IBM Carbon Notification | 경고는 관련 항목 곁에(표 그룹 소속 배치의 근거) | https://carbondesignsystem.com/components/notification/usage/ |

전체 카탈로그(13곳, 전부 이 세션에서 fetch 검증)와 시안 B~E 비교는 아티팩트 참조.

## 구현 노트

- warning 잉크는 `statusColors.warning.textDark` 유지 — 박스(orange-50 바닥)에서 흰 카드 바닥으로 옮겨 가며 대비는 오히려 오른다.
- 경고를 색만으로 말하지 않는다(WCAG 1.4.1) — StatusWarningIcon 마크 유지.
- 스트립(`connProgress.base`)의 자체 `mb-3.5`는 인접 마진 상쇄로 그룹 여백과 충돌하지 않아 그대로 둔다.
