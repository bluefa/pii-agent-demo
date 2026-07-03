# 파이프라인 상세(#/pipeline/:id) — 정보 구조(IA) 분석과 강조 계층 제안

> LIN-20 Round 5 논의 문서. 현재 화면의 정보를 전수 나열하고,
> "운영자가 이 페이지에 온 이유" 기준으로 강조 계층을 다시 세운다.

## 1. 현재 페이지의 정보 인벤토리

| # | 영역 | 정보 | 출처 | 성격 |
|---|---|---|---|---|
| 1 | Breadcrumb | 서비스 검색 › svc-alpha › ts-aws-001 › 파이프라인 #128 | nav 상태 | 탐색 맥락 |
| 2 | h1 | "파이프라인 #128" | pipeline.id | **식별자** (breadcrumb과 중복) |
| 3 | 카드 "파이프라인 정보" | ID/타입 (#128 · INSTALL) | pipeline | 식별자 |
| 4 | 〃 | target (ts-aws-001 + provider dot + 외부 배지) | pipeline.target | 대상 요약 (id뿐) |
| 5 | 〃 | 상태 pill (RUNNING) | pipeline.status | **핵심 상태** |
| 6 | 〃 | 생성 / 마지막 활동 시각 | pipeline | 시간 맥락 |
| 7 | 〃 | 현재/최종 task (seq 3 / seq 4) | tasks 파생 §4.5(b) | **핵심 진행 위치** |
| 8 | 〃 | 실패/한계 (0 / 1) | 현재 task 파생 | 진행 리스크 |
| 9 | 〃 | [파이프라인 취소] 버튼 | §4.5(c) | 액션 |
| 10 | 카드 "실행 메타 ADR-021" | 미제공 필드 4개 설명 + collapsible | 없음(설명문) | **부재에 대한 각주** |
| 11 | Task 흐름 | 노드별 seq·kind·operation·상태·fail·시각 | tasks | **본문 주인공** |
| 12 | Task 상세(클릭) | operation·timeout/polling·fail/maxFail·attempts/check | task | 드릴다운 |

**빠져 있는 정보** (오너 피드백 + App `lib/types.ts`의 `CloudTargetSource` 기준):

| CSP | 실재하는 metadata |
|---|---|
| 공통 | name, description, serviceName(serviceCode), processStatus, dbType, piiAgentInstalled |
| AWS | awsAccountId, awsLinkedAccountId, awsRegionType(global/china), isTerraformExecutionGranted |
| Azure | tenantId, subscriptionId |
| GCP | gcpProjectId |
| IDC | (리소스 레벨 idcConfig — 상세는 target 페이지 몫) |

현재 프로토타입 mock은 `account` 한 필드로 뭉뚱그려져 있어 CSP별 metadata를 렌더할 수 없다.

## 2. 운영자는 왜 이 페이지에 오는가 — 질문 우선순위

1. **"지금 어떤 상태야?"** — 상태, 진행률 N/M, 지금 어느 task
2. **"문제 있어? 어디서?"** — FAILED task, error_code, attempts 응답
3. **"뭘 대상으로 한 작업이지?"** — 어느 서비스의 어느 CSP 계정/구독/프로젝트인가
4. **"언제 시작했고 얼마나 걸리고 있지?"** — createdAt, lastActivityAt
5. (드묾) **"멈춰야 하나?"** — 취소 액션

현재 화면의 문제를 이 축으로 보면:

- 질문 1의 답(상태·진행·현재 task)이 **카드 안 kv 행 7줄 중 3줄에 분산** — 최상단 강조는
  식별자(h1 "#128")가 차지
- 질문 2의 답은 Task 흐름에 있지만 FAILED여도 자동으로 짚어주지 않음
- 질문 3의 답이 target id 한 줄뿐 — CSP metadata 없음
- 질문 5의 답(취소 버튼)이 정보 카드 안에 섞여 있음
- **질문 어디에도 해당 없는** "실행 메타(미제공 설명)" 카드가 화면 우측 절반을 차지

## 3. 제안: 강조 계층 (Level 1 → 5)

| Level | 정보 | 표현 |
|---|---|---|
| **L1** | 상태 + 진행 N/M + 현재 task | **Hero 헤더** — 페이지에서 가장 큰 시각 요소 |
| **L2** | 실패 지점 (있을 때만) | FAILED task 자동 선택 + error_code hero에 노출 |
| **L3** | 대상 컨텍스트 (서비스·CSP·metadata) | 상태 바 식별 칩 + 하단 접힘 kv, target 페이지 링크 |
| **L4** | 시간 (생성·마지막 활동), 타입, id | hero의 meta 행 (작게) |
| **L5** | ADR-021 미제공 설명 | 페이지 하단 collapsible 한 줄 (각주) |

### 레이아웃 스케치 (v2 — n8n 참조, 오너 승인)

> v1(문서형 세로 스택: hero 카드 → 컨텍스트 밴드 → 흐름 → 하단 상세)은
> "Task 흐름이 아래로 밀리고 상태/CTA가 카드 속에 갇힌다"는 오너 피드백으로 폐기.
> n8n 실행 화면의 원칙을 차용: **① 그래프가 본문의 주인공, ② 상태·CTA는 얇은 상주 바,
> ③ 드릴다운은 아래로 쌓지 않고 옆에 띄움.**
> (n8n과 달리 우리는 읽기 전용 모니터+선형 2~4 task라 캔버스 전면화까지는 불요.)

```
서비스 검색 › svc-alpha › ts-aws-001 › #128                     ← 식별자는 여기로 충분
┌─ 슬림 상태 바 (카드 해체, 한 줄½) ──────────────────────────────┐
│ ● RUNNING  ▓▓▓░░ 2/4 · 현재 seq 3 BDC Common TF 실행  [취소]   │ ← L1 + CTA
│ INSTALL #128 · ●AWS ts-aws-001 외부 · svc-alpha · 06-30 14:02~ │ ← L3 칩 + L4 meta
├──────────────────────────────────┬─────────────────────────────┤
│                                  │ Task 상세 (사이드 패널)      │
│  Task 흐름 = 본문                 │ seq 3 · BDC Common TF 실행  │
│  [✓seq1]→[✓seq2]→[▶seq3]→[○seq4] │ IN_PROGRESS · attempts…     │
│  (노드 확대, FAILED면 자동 선택)   │ (노드 클릭으로 갱신)          │
└──────────────────────────────────┴─────────────────────────────┘
▸ 대상 상세 metadata (CSP별 kv, 접힘) · [대상 상세 →]             ← L3 상세
▸ ADR-021 실행 필드 미제공 각주 (접힘)                            ← L5
```

- CSP metadata: 상태 바에는 식별 칩(●AWS · ts-aws-001 · svc-alpha)까지만,
  전체 kv는 하단 접힘 + target 페이지 링크.

**선택 상태 규칙** (컴포넌트 계약 변경 — codex P1 반영):

- `viewPipeline` 진입 시 `app.selectedTaskId === null`이면 **초기 선택을 파생**한다:
  `p.status === 'FAILED'`이면 `currentTask(p)`(§4.5(b) — FAILED task를 짚음)의 seq로 초기화,
  그 외에는 null 유지.
- 사이드 패널 빈 상태(선택 없음): "노드를 클릭하면 상세 표시" 안내 유지 (`#taskdetail` id 계약 유지).
- 노드 클릭 동작(선택 토글·상세 갱신)은 기존과 동일 — scrollIntoView는 사이드 패널 구조에선 불필요해져 제거.

**폭/오버플로 규칙** (codex P1 반영):

- 본문 grid: `grid-template-columns: minmax(0,1fr) 340px`, gap 12px. `min-width:1080px` 유지.
- 사이드 패널 340px 고정. ~~sticky~~ → **grid `align-items:stretch`로 흐름 카드와 같은 높이**
  ([admin-pipeline-design-system.md](admin-pipeline-design-system.md) §1-3 나란한 카드 정렬 규칙, Phase 4 개정) —
  긴 attempts 테이블은 패널 내부 스크롤.
- Task 흐름 컬럼: 기존 `overflow-x:auto` 유지 + 노드 폭 200→**172px 컴팩트** —
  1280px 뷰포트(사이드바 216 + 콘텐츠 패딩 64 제외 시 flow 컬럼 ≈ 648px)에서
  3노드(172×3+28×2=572px)까지 무스크롤, 4노드부터 가로 스크롤 허용.
- attempts의 raw response 긴 문자열: 패널 폭 기준 ellipsis + `title` 전문 유지(기존 규칙 승계).

- **h1 제거**: "파이프라인 #128"은 breadcrumb + 상태 바 meta 행으로 내려감.
  가장 큰 시각 요소는 상태 pill(대형) + ProgressBar.
- **FAILED 파이프라인이면**: 상태 바에 `error_code` 요약을 함께 노출하고,
  Task 흐름에서 FAILED 노드를 초기 선택(§4.5(b) currentTask가 이미 FAILED를 짚음).
- **CSP metadata 상세**(제외 리소스, NIC, connection test 이력 등)는 target 페이지 몫 —
  이 페이지는 상태 바 칩 + 하단 접힘 kv + 링크만.
- **취소 버튼**: 상태 바 우측 상주(액션은 헤더에서 사는 게 어드민 관례).
  비활성 사유 문구는 유지.

### Mock 데이터 영향 (구조 변경 최소 원칙)

- `TARGET_SOURCES`의 각 항목에 CSP별 metadata 필드 추가 (App `CloudTargetSource` 필드명 그대로:
  `awsAccountId`, `tenantId`, `subscriptionId`, `gcpProjectId` 등) — D1 API 연결 시 매핑 비용 최소화
- 라우팅·파생 함수·§4.5 규칙 무변경. 렌더 함수(viewPipeline)와 CSS만 재배치
- 같은 계층 원칙이 페이지 3(#/target/:id)에도 적용 가능 — CSP metadata의 "본진"은 target 페이지,
  거기는 후속 라운드에서

## 4. 결정 로그

| 질문 | 결정 |
|---|---|
| 전체 배치 | **v2 (n8n 참조)** — 슬림 상태 바 + Task 흐름 본문 + 사이드 패널 상세 (오너 승인) |
| 상태 강조 수위 | 대형 pill + FAILED일 때만 상태색 힌트 (절충안) |
| Task 상세 위치 | 우측 사이드 패널 (하단 스택 폐기) |
| CSP metadata 노출 수위 | 상태 바 칩 요약 + 하단 접힘 kv + target 페이지 링크 |
| IDC 등 metadata 없는 CSP | 접힘 kv에 계정 필드만, 나머지는 "target 페이지에서 확인" 문구 |
| 타이포그래피 | [admin-pipeline-typography.md](admin-pipeline-typography.md) 스펙 따름 |
