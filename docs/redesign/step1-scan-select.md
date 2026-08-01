# Step 1 · 연동 대상 선택 + 스캔 화면 리디자인

> 작성 2026-08-01 · 근거 화면 `/pass/target-sources/1006` (AWS Step 1) · `/1005` (Azure, 설치 선택/불가 행)
> 적용 컴포넌트: `CandidateResourceSection` / `CandidateResourceTable` / `CandidateResourceRow` /
> `ScanHeroState` / `ScanStrip` / `ScanHistoryModal` / `scan-permission` /
> `IdcExclusionPopover` / `IdcExclusionReasonModal` / `IdcSubmitModal` / `TableEmptyState`
> 공유 파일: `ConfirmStepModal`(확장) · `Tooltip`(InfoTooltip label·iconSize) · `lib/theme.ts`(tossShadow.md/lg, idcStyles.popover)
> 진행 방식: docs/redesign/README.md "How these sessions run" 과 동일한 라이브 리뷰 루프

Step 2·3에서 확립한 표 문법(툴바·Header/Footer 윤곽·Pagination)과 모달 문법(ConfirmStepModal)을
Step 1로 이식하고, Step 1 고유 요소(스캔 수명주기·설치 구분·제외 사유)를 재설계했다.

---

## 1. 스캔 수명주기 — 히어로 / 스트립 / 이력 / 권한

| 상태 | Before | After |
|---|---|---|
| 스캔 이력 없음 + 목록 없음 | 빈 표 위 버튼 하나 | **온보딩 히어로** (아이콘 + 안내 + 권한 프리플라이트 + primary 스캔 시작) |
| 목록 있음 | 스캔 컨트롤이 표와 뒤섞임 | **상태 스트립** 독립 밴드 (● 마지막 스캔 상대시간 · 소요 · N개 발견 · 신규 N + 이력/권한 확인/다시 스캔) |
| 스캔 이력 | 없음 | **스캔 이력 모달** (페이지네이션) |
| 권한 | 확인 수단 없음 | **권한 프리플라이트** — 결과는 세션 로컬, 확인 시점 상시 병기 (오래된 확인을 보증처럼 표시하지 않음) |

- NO_SCAN 센티널 잡(목 BFF 합성)을 "마지막 스캔 실패"로 오표기하던 것을 상태 집합으로 걸러 정직하게 "기록 없음" 처리.
- list 상태의 primary CTA는 하단 승인 요청 하나. 스캔은 secondary로 물러난다 (한 화면 한 primary).

## 2. 테이블 — Step 2 문법 이식 + 설치 구분 열

| | Before | After |
|---|---|---|
| 툴바 | 없음 (전량 노출) | Step 2 툴바 이식 — 검색(placeholder "Resource ID 또는 Resource Name 검색") + DB Type/Region 필터 |
| 윤곽 | 표 자체 테두리 | Step 2 Header/Footer 두 세그먼트 문법 + Pagination 마감 바 |
| 열 | 스캔 상태 열 | **설치 구분 열** (설치 대상/설치 선택/설치 불가) — 스캔 상태 열 삭제, 신규 N은 스트립 메타로 |
| 승인 CTA 비활성 | 이유 불명 | **호버 툴팁으로 비활성 사유** (미선택 / 제외 사유 미입력 N건 + 대상 목록) |
| 필터 빈 상태 | 작은 회색 문구 | 캡션 16px·gray-700, 아이콘 서클 56px |

- 검색·필터·페이지 변경 시 행 앵커 UI(확장 패널·팝오버)를 함께 닫아 죽은 앵커를 남기지 않는다.
- CTA 카운트는 전체 목록 기준 유지 — 필터는 뷰 관심사.

## 3. 설치 구분 — (?) 툴팁과 rename

- 헤더 (?) 아이콘(17px, `InfoTooltip iconSize` prop 신설) → **화이트 박스(value variant) 3계층 툴팁**:
  제목 캡션(14px semibold #191F28) + 전제문(12px) → 헤어라인 → 용어(14px bold) + 설명(12px) 수직 스택.
  다크 배경·"용어 — 설명" 대시 인라인 패턴은 기각.
- **'설치 불필요' → '설치 선택' rename** (라벨·툴팁·승인 모달 전부): VM·EC2처럼 DB 외 용도가 많아
  필수 연동 대상은 아니지만, DB 서버를 운영하면 연동 대상이 맞다 — "불필요"가 도메인 의미를 왜곡했다.
- 설치 대상 태그 파란색 강조는 검토 후 기각: 파랑은 선택 축의 언어라 오독을 만들고, 다수값 강조는 벽지가 된다.

## 4. 승인 요청 모달 — 통일 문법 + 타일 램프

- 승인 요청 모달을 ConfirmStepModal 통일 문법으로 재구성, 설명문은 "총 N건 중 M건 연동, K건 제외" M-of-N 행동 문구.
- 통계 타일: 흰 카드 + toss 섀도(`tossShadow.md/lg` 신설) + 약한 스트로크, 숫자 40px, 라벨 semibold,
  Step 2 필터 타일과 동일 문법 (Step 2·3 타일도 같은 커밋 계열에서 흰 카드+브랜드 선택 엣지로 정렬).

## 5. 제외 사유 — 팝오버 · 직접 입력 모달

| | Before | After |
|---|---|---|
| 팝오버 타이틀 | 13px | 14px semibold |
| 프리셋(임시 DB 등) | 리스트형 옵션 | **태그 피커 칩** — 흰 카드 + gray-200 스트로크 + lg 섀도 + 6px 라운드, hover 브랜드 프리뷰, 선택 시 브랜드 보더+틴트 |
| 직접 입력 진입 | 칩과 동일한 stroke 버튼 | **언더라인 텍스트 버튼** (+ hover 브랜드 틴트 필) — 값(칩) vs 행동(텍스트 버튼) 어포던스 분리 |
| 직접 입력 모달 | 자체 크롬 (X 버튼·footer 구분선·다른 버튼 크기) | **ConfirmStepModal 통일** — 480px, h-40 버튼 쌍, X 없음, 구분선 없음 |
| 글자 수 | 0/3000자 | **1000자** (계약 3000의 부분집합) + 카운터 재설계 (tabular, 한도 도달 시 error 색) |
| 설명문 | "이 DB를 … 입력해주세요. 관리자 승인 시 함께 전달돼요." 2문장 | "리소스 제외 사유는 **관리자 승인 시 함께 전달**돼요." 1문장 — DB→리소스, 핵심만 파란 강조 |

## 6. ConfirmStepModal 확장 — 모달 기준 스펙 선언

- `confirmDisabled` · `initialFocus` prop 추가, Tab 트랩을 다이얼로그 전체 포커서블로 일반화 —
  폼형 모달(사유 입력)이 이관 가능해졌다. 기존 소비자 4곳 동작 불변.
- 접근성 보강: 포커스 복원, focus-visible 링, isPending 스피너.
- 모달이 화면마다 제각각(X 유무·구분선·버튼 크기)인 문제를 확인 — ConfirmStepModal이 기준 스펙이고,
  `Modal(chrome=toss)` 소비자는 화면을 손볼 때마다 이 스펙으로 이관한다.

## 7. 문구

- 헤더 안내문: 3호흡 → **2호흡** ("스캔으로 조회하고 선택 / 제외에는 사유, 승인으로 확정"),
  사용자가 직접 하는 행동 두 가지(선택·사유)만 파란 강조, `break-keep`으로 음절 고아 방지.
- "연동할 DB" → "연동할 리소스" — 스캔·선택·제외의 대상은 일관되게 리소스.
- 검색 placeholder "DB Name" → "Resource Name" (Step 1·2·3 공통 툴바라 한 곳 수정).
