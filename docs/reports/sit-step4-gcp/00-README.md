# SIT Step 4 (GCP) — Wave Task Index

`/wave-task <key>` 입력으로 바로 사용할 수 있는 Step 4 (Agent 설치) — **GCP 분기** 구현 specs.

> **전제**:
> - PR #419 (`docs/reports/design-migration-plan-step2to7.md`) 머지 완료
> - PR #420 (`docs/bff-api/tag-guides/approval-requests.md`) 머지 완료
> - **Azure 분기는 별도 plan** (`sit-step4-azure/`) — 본 plan 은 GCP 한정. AWS/IDC/SDU 는 시안 부재로 제외.
> - **Step 4 진입 자체에는 Step 2/3 의 W1a~e 머지 불필요**. Step 4 화면은 `InstallingStep` (`ProcessStatus.INSTALLING = 4`) 슬롯이며 Step 2/3 컴포넌트와 독립.

---

## 0. 범위 (Scope)

본 plan 은 **Step 4 GCP 분기 (`INSTALLING` = ProcessStatus 4) 화면 한정**.

**포함**:
- 시안 `design/app/SIT Prototype v2.html` 의 `data-stepc="4"` GCP 섹션
  - **Pipeline 카드 영역** (line 1726–1753): Subnet 생성 / 서비스 측 / BDC 측 — 3-card horizontal
  - **공용 DB List 영역** (line 1755–1789): `서비스 리소스 상태` 컬럼 (GCP 분기)
  - **Task Detail Modal** (line 2328–2360): 카드 클릭 시 리소스별 진행 상태
- 카드 status: `done` / `running` / `failed` 분기 (시안 line 867–870)
- ProcessStatus 4 → 5 자동 전이 (state-driven, 명시적 라우팅 없음)

**제외**:
- Azure 분기 (`sit-step4-azure/` 별도 plan)
- AWS / IDC / SDU 분기 (시안 부재)
- Step 1/2/3/5/6/7 (별도 wave)
- BFF 명세 변경 — 본 plan 은 **현재 BFF 명세로 모두 매핑 가능**한 범위 내에서 작성

---

## 1. 사용자 답변 (확정 사항)

| Q | 결정 | 영향 wave |
|---|---|---|
| Q4G-1 BFF 매핑 | "왠만하면 현재 BFF API 로 다 mapping 됨" — 신규 endpoint 불필요 | 전체 |
| Q4G-2 "서비스 리소스 상태" 컬럼 (공용 DB List) | per-resource **`installationStatus`** (`COMPLETED` / `IN_PROGRESS` / `FAIL`) 로 분기 | W1b |
| Q4G-3 "Subnet 생성 진행" 카드 의 진행 표시 | **`SKIP` 이 아닌 resource 들의 개수** 표시 (= `getGcpStepSummary().activeCount`) | W1a |

→ 결과적으로 **신규 BFF endpoint / 신규 BFF schema 변경 0건**. 모든 데이터는 기존 `GET /gcp/target-sources/{id}/installation-status` 응답 (`GcpInstallationStatusResponse`) + `confirmed-integration` 응답 으로 충당.

---

## 2. BFF API 매핑 (현재 명세 그대로 사용)

| UI 요소 | BFF source | 매핑 |
|---|---|---|
| Pipeline 카드 1 — `Subnet 생성 진행` | `GcpResourceStatus.serviceSideSubnetCreation` aggregate | `getGcpStepSummary(resources, 'serviceSideSubnetCreation')` (이미 `lib/constants/gcp.ts` 에 존재) |
| Pipeline 카드 2 — `서비스 측 리소스 설치 진행` | `GcpResourceStatus.serviceSideTerraformApply` aggregate | `getGcpStepSummary(resources, 'serviceSideTerraformApply')` |
| Pipeline 카드 3 — `BDC 측 리소스 설치 진행` | `GcpResourceStatus.bdcSideTerraformApply` aggregate | `getGcpStepSummary(resources, 'bdcSideTerraformApply')` |
| Card status (`done` / `running` / `failed`) | `GcpStepAggregateStatus` | COMPLETED → `done` / IN_PROGRESS → `running` / FAIL → `failed` / PENDING → 별도 처리 (하단 §6.2 참조) |
| Card status pill 카운트 (Q4G-3) | `activeCount` (skip 제외) + `completedCount` | `(completedCount / activeCount) 진행중` 또는 `완료` |
| Task Detail Modal — 리소스 행 | `GcpResourceStatus[]` 의 해당 step field | resource 별 step status |
| 공용 DB List — `DB Type` / `Region` / `DB Name` | `confirmed-integration` 응답 (`ConfirmedIntegrationDataProvider`) | resourceId 로 join |
| 공용 DB List — `Resource ID` | `GcpResourceStatus.resourceId` | 직접 |
| 공용 DB List — `서비스 리소스 상태` (Q4G-2) | `GcpResourceStatus.installationStatus` | COMPLETED → `완료` (green) / IN_PROGRESS → `진행중` (orange) / FAIL → `실패` (red) |

**중요한 join**: 공용 DB List 는 GCP installation-status 응답 + confirmed-integration 응답 두 source 의 join. `CloudInstallingStep` 이 이미 `ConfirmedIntegrationDataProvider` 로 후자를 제공하므로 W1b 가 두 데이터를 결합하여 렌더.

---

## 3. 의존성 그래프

```
[전제 — Step 2/3 wave 와 무관]
- 기존 GcpInstallationInline / GcpStepSummaryRow / GcpResourceStatusTable 가 동작 중
- 기존 useInstallationStatus hook + getGcpInstallationStatus / checkGcpInstallation helper 사용

[Step 4 GCP 본 plan]
S4G-W1a (Pipeline 카드 — top section)
        │
        ▼
S4G-W1b (DB List 테이블 + Task Detail Modal — bottom section)
        │
        ▼
S4G-W1c (Design polish — 픽셀 정합)
```

병렬 가능:
- W1a 와 W1b 는 다른 컴포넌트 (Pipeline vs DB Table)를 만지지만, 둘 다 `GcpInstallationInline.tsx` 에서 import 되므로 **순차 진행 권장** (W1a → W1b). 동일 파일 conflict 회피.

---

## 4. 실행 순서

```
1. S4G-W1a — Pipeline cards rewrite  (단독)
2. (S4G-W1a 머지 후) S4G-W1b — DB List + Task Detail Modal
3. (S4G-W1b 머지 후) S4G-W1c — Design polish
```

---

## 5. 모델 효율 가이드

| Wave | 권장 모델 | 사유 |
|---|---|---|
| **S4G-W1a** Pipeline cards | Sonnet 4.6 | 기존 `GcpStepSummaryRow` 의 시각 rewrite + connector chevron + status pill 카운트 — 데이터 로직은 `getGcpStepSummary` 재사용 |
| **S4G-W1b** DB List + Task Detail Modal | **Opus 4.7 MAX** | 두 source (installation-status + confirmed-integration) join + 신규 modal + per-resource state mapping + 탭 카운트 |
| **S4G-W1c** Design polish | Sonnet 4.6 | token 매핑 + 픽셀 정합 |

→ Sonnet 2 + Opus 1.

---

## 6. PR 분리 원칙

- W1a: ~280 LOC (Pipeline component + status mapping helper + tests)
- W1b: ~380 LOC (DB Table component + Task Detail Modal + join helper + tests)
- W1c: ~100 LOC (token 정리)

---

## 7. Spec 파일 목록

| 키 | 파일 |
|---|---|
| `S4G-W1a` | [`S4G-W1a-pipeline-cards.md`](./S4G-W1a-pipeline-cards.md) |
| `S4G-W1b` | [`S4G-W1b-db-table-and-modal.md`](./S4G-W1b-db-table-and-modal.md) |
| `S4G-W1c` | [`S4G-W1c-design-polish.md`](./S4G-W1c-design-polish.md) |

---

## 8. 공통 참조

- 본 문서: `docs/reports/design-migration-plan-step2to7.md` (Step 4 GCP 섹션)
- 시안: `design/app/SIT Prototype v2.html`
  - Step 4 본문: line 1680–1789
  - GCP 분기 pipeline: line 1726–1753
  - 공용 DB List: line 1755–1789
  - Pipeline CSS (`.install-tasks` / `.install-task`): line 817–874
  - Task Detail Modal: line 2328–2360
  - Modal 탭 CSS (`.task-tabs` / `.task-tab`): line 879–906
- BFF 명세 (변경 없음): `docs/swagger/gcp.yaml` (전체 254 라인)
- 기존 GCP 타입: `app/api/_lib/v1-types.ts` line 142–179
- 기존 GCP 상수/헬퍼: `lib/constants/gcp.ts`
- 기존 GCP 컴포넌트 (재구성 대상):
  - `app/components/features/process-status/gcp/GcpInstallationInline.tsx`
  - `app/components/features/process-status/gcp/GcpStepSummaryRow.tsx` (W1a 가 대체)
  - `app/components/features/process-status/gcp/GcpStepSummaryCard.tsx`
  - `app/components/features/process-status/gcp/GcpResourceStatusTable.tsx` (W1b 가 대체)
- 현재 Step 4 컴포넌트: `app/integration/target-sources/[targetSourceId]/_components/layout/CloudInstallingStep.tsx` (`ConfirmedIntegrationDataProvider` 등 wiring 이 이미 있음 — 재사용)
- 현재 GCP page wrapper: `app/integration/target-sources/[targetSourceId]/_components/gcp/GcpInstallationStatus.tsx`
- BFF client (ADR-011): `lib/bff/types.ts` / `lib/bff/http.ts` / `lib/bff/mock-adapter.ts` / `lib/bff/mock/gcp.ts`
- ⛔ 규칙: `CLAUDE.md`

---

## 9. 디자인 원칙 (⛔ 흐트림 금지)

### 9.1. 카피는 시안에서 직접 추출

| UI 위치 | 시안 카피 (line) | 변경 금지 |
|---|---|---|
| Pipeline 카드 1 title | `Subnet 생성 진행` (1731) | ✅ |
| Pipeline 카드 1 sub | `Project 내 모니터링용 Subnet (10.30.0.0/22) 생성` (1732) | ✅ |
| Pipeline 카드 2 title | `서비스 측 리소스 설치 진행` (1739) | ✅ |
| Pipeline 카드 2 sub | `VPC Peering / Firewall / Service Account 권한 위임 구성` (1740) | ✅ |
| Pipeline 카드 3 title | `BDC 측 리소스 설치 진행` (1747) | ✅ |
| Pipeline 카드 3 sub | `PII Agent GCE 인스턴스 + Service Account + IAM Role 자동 배포` (1748) | ✅ |
| 카드 status pill 라벨 | `완료` / `진행중` / `실패` (CSS line 867–870, 시안 line 1734/1742/1750) | ✅ |
| 공용 DB List 헤더 (GCP) | `서비스 리소스 상태` (1765) | ✅ |
| 공용 DB List 값 | `완료` (tag green) / `진행중` (tag orange) (1774, 1781) | + `실패` (tag red, FAIL 케이스 추가) |
| Task Detail Modal title | `서비스 측 리소스 설치 진행` (2332, 카드 title 과 동기화) | ✅ |
| Task Detail Modal sub | `리소스별 설치 진행 현황을 확인할 수 있어요.` (2333) | ✅ |
| Task Detail Modal 탭 | `전체 / 완료 / 진행중` (2337–2339) | + 실패 탭 검토 (사용자 결정 시 추가) |
| Task Detail Modal 헤더 | `Resource ID / DB Type / Region / 진행 완료 여부` (2345–2348) | ✅ |
| Task Detail Modal 확인 | `확인` (2358) | ✅ |

### 9.2. 시각 토큰 매핑

| 시안 | CSS 변수 / Hex | theme.ts 토큰 (제안) |
|---|---|---|
| Pipeline 카드 외곽 | `border var(--border-default)` + `radius 10px (left/right)` | `borderColors.default` + `rounded-l-[10px]` / `rounded-r-[10px]` |
| Pipeline connector chevron | inline SVG / pseudo-element | 본 wave 에서 `<svg>` 컴포넌트로 분리 |
| `.install-task .num` | `bg var(--bg-muted)` / `color var(--fg-3)` | `bgColors.muted` / `textColors.tertiary` |
| `.install-task.done .num` | `bg var(--color-success)` / `#fff` | `bg-emerald-500 text-white` (또는 `statusColors.success`) |
| `.install-task.running .num` | `bg var(--color-primary)` / `#fff` + halo `0 0 0 4px rgba(0,100,255,0.15)` | `bg-blue-600 text-white shadow-[0_0_0_4px_rgba(0,100,255,0.15)]` |
| `.install-task.done .status-pill` | `#D1FAE5` / `#065F46` | `tagStyles.green` (현재 theme 에 존재) |
| `.install-task.running .status-pill` | `var(--color-primary-light)` / `var(--color-primary)` | `tagStyles.blue` (현재 theme 에 존재) |
| `.install-task.failed .status-pill` | `#FEE2E2` / `#991B1B` | `tagStyles.red` (현재 theme 에 존재) |
| 공용 DB List `tag green` (완료) | `#ECFDF5` / `#065F46` | `tagStyles.green` |
| 공용 DB List `tag orange` (진행중) | `#FFEDD5` / `#9A3412` | `tagStyles.orange` |
| Task tabs | `bg var(--bg-muted)` + active `bg #fff shadow-[0_1px_2px_rgba(0,0,0,0.06)]` | 신규 `tabStyles.segmented` (W1c 가 추가) |
| Modal 외곽 | `app/components/ui/Modal.tsx` 재사용 (또는 inline 으로 width 880px 적용) | width 는 시안 `.logical-modal { 880px }` |

→ **신규 토큰 1건 (`tabStyles.segmented`, W1c 가 추가)**. `tagStyles` 색상 키는 모두 현재 theme 에 존재. semantic alias (success/info/error/warning) 도입은 W1c 의 추가 정리 작업.

⚠️ **Modal 컴포넌트**: `app/components/ui/Modal.tsx` 가 존재 (S2-W1d 의 `ConfirmStepModal` 과 별개). Step 4 GCP 는 Step 2 wave 와 독립이므로 `Modal.tsx` 를 reference. width 미지원 시 inline modal 또는 prop 확장.

### 9.3. Spacing / Radius / Shadow

| 요소 | 시안 값 | 클래스 |
|---|---|---|
| Pipeline 카드 padding | 22px 18px 20px | `pt-[22px] px-[18px] pb-5` (또는 inline arbitrary) |
| 카드 gap | 0 (`grid-template-columns: repeat(3, 1fr)`) | `grid grid-cols-3 gap-0` |
| 카드 외곽 first | `rounded-[10px_0_0_10px]` | `rounded-l-[10px]` |
| 카드 외곽 last | `rounded-[0_10px_10px_0]` + border-right 추가 | `rounded-r-[10px]` + `border-r` |
| `.num` 크기 | 30×30 | `w-[30px] h-[30px]` |
| `.title` | 15px / 700 | `text-[15px] font-bold` |
| `.sub` | 12px / `var(--fg-3)` | `text-xs text-gray-500` |
| `.status-pill` | 11px / 600, padding 4px 12px, rounded-full | `text-[11px] font-semibold px-3 py-1 rounded-full` |
| Modal width | 일반 modal 보다 넓음 (`logical-modal` 클래스) | 시안 line 2330 — 별도 modal width 확인 |

### 9.4. Status mapping

```
GcpStepAggregateStatus  →  Pipeline card class  →  status-pill 라벨
─────────────────────────────────────────────────────────────────
COMPLETED               →  done                 →  완료
IN_PROGRESS             →  running              →  진행중 (M/N 형식, M=completedCount, N=activeCount)
FAIL                    →  failed               →  실패
PENDING (activeCount=0) →  done (시각상 안전한 default) →  해당없음
```

⛔ Q4G-3 답변: "Subnet 진행 상태는 skip 이 아닌 resource 들의 개수를 보여주면 됨". → status pill 안에 `진행중 (3/5)` 형태로 노출. 단순 "진행중" 만 표기하지 말 것.

### 9.5. Per-resource installation status 매핑 (공용 DB List)

```
GcpInstallationStatusValue  →  공용 DB List '서비스 리소스 상태' 셀
────────────────────────────────────────────────────────────────
COMPLETED                   →  <Tag variant="success">완료</Tag>
IN_PROGRESS                 →  <Tag variant="warning">진행중</Tag>
FAIL                        →  <Tag variant="error">실패</Tag>
```

⛔ Q4G-2 답변: 분기는 **per-resource `installationStatus`** 기준 (3-card aggregate 가 아님).

---

## 10. 공통 PR body template

```markdown
## Summary
- Spec: `docs/reports/sit-step4-gcp/<file>.md` @ <SHA>
- Wave: <key>
- 의존: <merged waves>
- 디자인 reference: `design/app/SIT Prototype v2.html` line 1680–1789 (Step 4 본문) + 2328–2360 (Task Detail Modal)

## Changed files (net LOC)
<git diff --stat>

## Verification
- [ ] tsc exit 0
- [ ] npm run lint — 0 new warnings
- [ ] npm run test — relevant tests pass
- [ ] **시안 픽셀 정합** — 스크린샷 첨부 (Pipeline / DB Table / Task Detail Modal 3장)
- [ ] **카피 1:1** — line 1726–1789 + 2328–2360 한국어 문자열 변경 없음
- [ ] **Provider 분기 검증** — Azure / AWS 페이지에는 본 wave 의 변경이 영향 없음

## Deviations from spec
<없으면 "None">

## Deferred to later waves
<없으면 "None">
```

---

## 11. ⛔ 절대 규칙 (Cross-wave)

1. **시안 카피 변경 금지** — 9.1 표의 모든 한국어 문자열 character-for-character 보존.
2. **BFF 명세 변경 금지** — 본 plan 의 GCP 분기는 현재 BFF 만으로 모두 매핑 가능 (Q4G-1).
3. **Q4G-2 / Q4G-3 결정 보존** — "서비스 리소스 상태" 는 per-resource installationStatus, "Subnet" 카운트는 skip 제외 active 수.
4. **Provider 분기 영향 격리** — Azure / AWS 컴포넌트 수정 금지. 본 plan 은 GCP 한정.
5. **Raw hex 금지** — `theme.ts` 토큰만.
6. **`@/` 절대 경로 only**.
7. **`any` 금지**.
8. **ADR-011** (typed BFF client 분산 계층) 준수 — 본 plan 은 BFF 변경 없으므로 기존 `getGcpInstallationStatus` / `checkGcpInstallation` helper 재사용.
9. **시연 흔적 금지** — 시안의 `data-prov-view` toggle / `setStep()` / `openTaskDetailModal('...', 'gcp')` 같은 prototype-only 코드는 운영 빌드에 포함 금지.
