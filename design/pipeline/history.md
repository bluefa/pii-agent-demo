# LIN-20 작업 히스토리 — Admin HTML 디자인 현대화

> 이슈: [LIN-20] Admin HTML 디자인 현대화 — 4페이지 리디자인 + 사용성 개선
> 대상: `design/pipeline/admin-pipeline.html` (단일 파일 vanilla-JS 프로토타입)
> 브랜치: `chulyonga/lin-20-b1-admin-html-디자인-현대화-4페이지-리디자인-사용성`
> 상세 변경 내역은 [admin-pipeline-changelog.md](admin-pipeline-changelog.md) Round 4 참조.

## 2026-07-03 — 진단 + 방향 결정

기존(Toss-소프트 스타일) 프로토타입을 브라우저에서 4페이지 전수 확인하고 진단:

- **프로토타입 티의 주범**: 이모지/유니코드 글리프 아이콘, 미로딩 폰트 선언(Geist/Pretendard),
  내부 구현 용어(`count(...)` formula, 파생/근사/미제공 배지)의 전면 노출, 저대비 텍스트
- **페이지별**: 대시보드 미제공 카드가 시선 강탈, 서비스 검색 빈 공간 60%,
  파이프라인 상세의 우측 카드 불균형 + Task 클릭 시 상세가 스크롤 밖(무반응감)

결정사항 (오너 승인):

| 결정 | 선택 |
|---|---|
| 디자인 방향 | ② **모던 어드민(밀도형)** — 작은 radius, 1px 보더, 상태색 시스템 유지·정제 |
| 다크모드 | 이번 범위 밖. 단, 토큰을 CSS 변수로 유지해 `:root` 오버라이드만으로 확장 가능한 구조 |
| Figma | 사용 안 함. 단일 HTML 특성상 "코드 수정 → 브라우저 스크린샷 → 피드백" 루프가 더 빠름 |
| 작업 방식 | 컴포넌트 단위 분할, 단계마다 스크린샷 검증 |

## 2026-07-03 — Round 4: 모던 어드민 리디자인 (commit `d5cb213f`)

- 파운데이션: Toss 토큰 → 중립 gray + 시맨틱 변수, 이모지 → 인라인 SVG 스프라이트 16종,
  시스템 폰트 스택 확정, 내부 용어 → title 툴팁 격하
- 컴포넌트: 탑네비/사이드바/StatCard/테이블/pill(pulse)/ProviderTag(중립 텍스트+브랜드 dot)/
  ProgressBar(done 색)/TaskNode(원형 상태 칩+선택 ring)/버튼 disabled 명확화/모달/토스트
- UX: Task 선택 시 상세 scrollIntoView, 서비스 페이지 빈 공간 해소, tnode 메타 구분자 버그 수정
- 검증: 4페이지 + preview/cancel 모달 + 생성(A10)·취소(A6) 플로우 브라우저 전수 확인,
  §4.5 규칙(ProgressBar N/M, kind 게이팅, 버튼 매트릭스) 동작 유지, 콘솔 에러 0, 외부 의존성 0

## 진행 중 — 파이프라인 상세(#/pipeline/:id) 정보 구조 재설계

오너 피드백 (Round 4 이후):

1. "파이프라인 정보 / 실행 메타" 두 카드에 정보가 섞여 있어 뭘 봐야 할지 모르겠음
2. TargetSource 정보(CSP 분류 + CSP별 metadata)가 너무 안 보임 —
   App의 `CloudTargetSource`에는 AWS(accountId·linkedAccount·region·TF권한),
   Azure(tenantId·subscriptionId), GCP(projectId) metadata가 실재함
3. h1 "파이프라인 #128"(식별자)이 최상단 강조인 게 의문 — **상태를 보러 들어온 페이지**

→ 정보 인벤토리 + 강조 계층 제안: [admin-pipeline-detail-ia.md](admin-pipeline-detail-ia.md)

후속 결정 (오너):

- v1 문서형 배치(hero 카드 → 컨텍스트 밴드 → 흐름 → 하단 상세) 기각 —
  "Task 흐름과 현재 상태/CTA가 강조되어야" 피드백
- **n8n 실행 화면 참조로 v2 확정**: 슬림 상태 바(상태+진행+CTA 상주) + Task 흐름 본문 +
  Task 상세 우측 사이드 패널 + 하단 접힘 각주(CSP kv, ADR-021) — IA 문서 §3 v2 반영

## 2026-07-03 — Round 5 구현 완료 (타이포 스펙 + 상세 v2)

스펙 확정 후 admin-pipeline.html에 구현 — changelog Round 5 참조.
#128(RUNNING)·#124(FAILED 자동 선택+error_code 칩)·전 페이지 타이포 브라우저 검증, 콘솔 에러 0.

## 타이포그래피 스펙 (Round 5 선행 작업)

폰트·층위별 크기·층위 간 거리·자간이 미정이라는 오너 지적 → 조사 후 스펙 문서 작성:
[admin-pipeline-typography.md](admin-pipeline-typography.md)

- 근거: App 실측 — Geist(next/font, 라틴 전용) + 한글 폴백(Apple SD Gothic Neo/Pretendard),
  전역 자간 -0.018em, `00-tokens.md`의 ds-* 스케일 / 한글 자간 관행(큰 사이즈 음수,
  11px 이하 0~양수) / 어드민 13px 본문 관행
- 선언: 9개 타입 롤(26/18/14/13/12/11/10.5 + mono 12.5, kv key 전용 t-key 12), IA 층위(L1~L5) 매핑,
  3단 거리 체계(4~6/8~12/24, 섹션 제목 위 24·아래 10 비대칭), tabular-nums 규칙
- Round 4에서 제거했던 Geist 스택 선언은 **App 정렬 관점에서 복원 예정** (외부 의존성 0 유지 —
  로컬 미설치 시 시스템 고딕 폴백)

### Codex 크로스 리뷰 (gpt-5.5 xhigh, 6라운드 → MERGE-READY)

- R1: P1×3+P2×1 — FAILED 자동 선택의 상태 규칙 미정의 / 사이드 패널 폭·오버플로 규칙 미정의 /
  "D1 1:1 변환" 주장 과장(컴팩트 스케일 명시+매핑 표 필요) / 한글 11px 레이블 과공격(t-key 분리)
- R2~R5: 수정 검증 + 잔존 충돌 소탕 — IA v2와 **components.md(권위 계약)의 v1 잔재**
  (하단 상세/인패널 표현, 15px/-0.018em 타이포 선언, §4.4 스케치·컴포넌트 표,
  PipelineMetaPanel 명칭·A4 API 맵) 순차 개정
- R6: 3문서(components/detail-ia/typography)가 단일 구현 계약임을 확인 — **MERGE-READY yes**
- 교훈: IA 변경은 스케치·표·파생식 제목·API 맵까지 **권위 문서 전체를 함께 개정**해야 함
  (부분 개정은 경합 계약을 남김)
