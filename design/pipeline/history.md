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
