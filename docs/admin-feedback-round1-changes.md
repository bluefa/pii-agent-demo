# 어드민 운영 피드백 1차 — 프론트 변경 명세

> 브랜치: `fix/admin-feedback-round1` (구현 커밋 f2da6daa)
> 대상 피드백: ①카탈로그 스크롤/모달 가변 높이 ②작업 예정 시간 초 단위 ④패널·Task 아이콘 상태 불일치
> ⑤PENDING→RUNNING 미전이 착시 (③타임존은 수정 불필요 — Asia/Seoul 고정 설계가 의도대로 동작)
>
> 각 항목의 **변경** 블록은 실제 적용 코드의 before → after다 — 이 문서만 보고 재적용 가능하다.
> 검증: `npm test`(1292 passed) + pre-commit(lint/type-check/build) 통과.

## ① Custom 빌더 카탈로그 — 모달 높이 고정 + 내부 스크롤

**증상.** Custom 작업 구성 모달이 Task 카탈로그 항목 수에 따라 세로로 늘어난다.

**원인.** `.r24-build`(빌더 캔버스)가 `min-height:400px`뿐이라, 우측 도킹 카탈로그 패널의
행 스택 고유 높이가 flex 컨테이너를 키웠다. `.r24-cat-body`의 `overflow-y:auto`는 높이가
제약될 때만 효과가 있는데 제약이 없었다.

**변경.** `app/admin/pipelines/_detail/CustomBuildStep.tsx`의 `BUILD_CSS` 첫 규칙 1곳:

```diff
-.r24-build{display:flex;align-items:stretch;min-height:400px;overflow:hidden}
+.r24-build{display:flex;align-items:stretch;height:420px;overflow:hidden}
```

파일 상단 주석에 고정 사유를 기록한다(향후 min-height로 되돌리는 회귀 방지):

```
The canvas height is FIXED (420px, not min-height): the docked catalog's
intrinsic row stack must never size the flex container, or the modal grows
with the catalog entry count (operator feedback — the dialog must not
resize by task count; the catalog scrolls internally via .r24-cat-body).
```

## ② 작업 예정 시간 — 초 단위 노출

**증상.** 작업 현황(PENDING)의 "시작 예정" 시각이 분 단위(`HH:mm`)까지만 보인다.
start-delay가 ~15초라 분 표기로는 "지금"과 구분되지 않는다.

**변경 1.** `lib/pipeline/format.ts` — `SEOUL_DATETIME` 옵션에 `second: '2-digit'` 추가.
기존 `fmtDateTime` 본문을 공통 헬퍼로 추출하고 초 포함 변형을 신설한다:

```ts
function seoulDateTime(iso: string | null | undefined, withSeconds: boolean): string {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  const parts = SEOUL_DATETIME.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  const hour = pick('hour') === '24' ? '00' : pick('hour');
  const base = `${pick('year')}-${pick('month')}-${pick('day')} ${hour}:${pick('minute')}`;
  return withSeconds ? `${base}:${pick('second')}` : base;
}

export function fmtDateTime(iso: string | null | undefined): string {
  return seoulDateTime(iso, false);
}

/** fmtDateTime + seconds ('YYYY-MM-DD HH:mm:ss') — 스케줄 시각 전용(start-delay가 초 단위). */
export function fmtDateTimeSec(iso: string | null | undefined): string {
  return seoulDateTime(iso, true);
}
```

기존 `fmtDateTime`(이력·구간 표기)의 출력은 불변 — 초가 의미 있는 곳은 스케줄 시각뿐이다.

**변경 2.** `app/admin/pipelines/_detail/statusModel.ts` — PENDING 분기만 교체:

```diff
-    return { label: '시작 대기', name: `${fmtDateTime(nextDueAt)} 시작 예정`, retry: null };
+    // 초 단위까지 노출 — start-delay가 ~15초라 분 단위로는 "지금"과 구분되지 않는다(운영 피드백).
+    return { label: '시작 대기', name: `${fmtDateTimeSec(nextDueAt)} 시작 예정`, retry: null };
```

(import도 `fmtDateTime` → `fmtDateTimeSec`.)

**테스트.** `lib/pipeline/format.test.ts`에 3건(초 표기 / 자정 `24`→`00` 정규화 + 초 꼬리 유지 /
null·invalid → `-`), `statusModel.test.ts`에 1건:

```ts
it('PENDING schedule time carries seconds (start-delay is second-scale)', () => {
  const info = currentTaskInfo('PENDING', '2026-06-30T05:02:17Z', [], opName);
  expect(info.name).toBe('2026-06-30 14:02:17 시작 예정');
});
```

## ④ 패널 값과 Task 아이콘 상태 불일치 — 재시도 상태의 3면 정합

**증상.** 노드 아이콘은 실행 중(스피너)으로 보이는데 패널(드로어)에는 실패가 보인다.

**원인.** 백엔드(`TaskStateMachine.retryOrFail`)는 재시도 가능 실패 후 task를 **READY로
되돌리고 `polling_interval`(기본 10분) 대기** 후 재실행한다. 이 "재시도 중" 상태가 화면마다
다르게 그려졌다:

- 작업 현황 노드: 재실행 중이면 스피너(RUNNING처럼), 대기 중이면 앰버 READY — 실패 문맥 없음
- 드로어: attempt 이력에 FAILED 행(빨강) → "실행 중인데 실패?"로 읽힘
- 타깃 페이지 RunTaskCard: READY를 `PENDING` 라벨로 collapse — 아직 시작도 안 한 것처럼 보임

**수정 방침.** 세 표면이 같은 이야기를 하게 한다: "직전 시도는 실패했고, 지금 재시도 대기/실행 중".

**변경 1 — 노드 메타에 재시도 문맥.**
`app/admin/pipelines/[pipelineId]/_components/PipelineDetailView.tsx`의 `resolveMeta`에
FAILED 분기 다음, 기본 분기 앞에 삽입 (`useCallback` deps `[descMap]` → `[descMap, detail]`):

```ts
if (t.fail_count > 0 && (t.status === 'IN_PROGRESS' || t.status === 'READY')) {
  const max =
    t.sequence === detail?.current_task_sequence ? detail?.current_max_fail_count : null;
  const budget = `${t.fail_count}/${max ?? '?'}`;
  return t.status === 'READY'
    ? `직전 시도 실패 — 재시도 대기 중 (${budget})`
    : `직전 시도 실패 — 재시도 실행 중 (${budget})`;
}
```

(분모 `current_max_fail_count`는 detail이 **현재 task에 대해서만** 주므로, 다른 task면 `?`.)

**변경 2 — READY 라벨 교정 + retry 표기 조건 해제.**
`app/admin/pipelines/_detail/r24Task.tsx`:

```diff
   PENDING: { key: 'pending', label: 'PENDING' },
-  READY: { key: 'pending', label: 'PENDING' },
+  READY: { key: 'pending', label: 'READY' },
```

드로어의 `PipelineStatusBadge`는 이미 같은 task를 READY로 표기하므로 이 한 줄로 두 표면이 일치한다.
`RunTaskCard`의 retry 표기는 running 한정 가드를 제거(READY 재시도 대기에도 노출):

```diff
-          {view.key === 'running' && retry ? (
+          {retry ? (
```

**변경 3 — retry 카운터를 "현재 task"에.**
`app/admin/pipelines/targets/[targetSourceId]/_components/CurrentPipelineCard.tsx`:

```diff
+  const retrySeq = detail.current_task_sequence;
   ...
-                  retry={task.status === 'IN_PROGRESS' ? retry : null}
+                  retry={task.sequence === retrySeq ? retry : null}
```

(현재 task = ADR-016의 최저 순번 READY/IN_PROGRESS — 재시도 대기 READY 포함. 카운터 문자열
`시도 f+1 / m` 계산은 기존 그대로.)

## ⑤ PENDING → RUNNING 미전이 — 백엔드 결함 아님 (UI 착시), ④ 수정으로 해소

**조사 결과(백엔드).** claim 경로는 건전하다 — **코드 변경 없음**:

- claim 술어가 `status IN (RUNNING, PENDING) AND next_due_at <= now AND lease free`
  (`PipelineRepository.lockClaimableDuePipelines`), `PENDING→RUNNING` 전이는 claim 트랜잭션에서
  lease와 원자적으로 수행(`PipelineClaimer.claimOneDue`).
- 스케줄러 idle sleep은 `max-idle-sleep`(5s) 상한 + nearest-due 캡(`capToNearestDue`)으로 묶여,
  파이프라인 PENDING은 **startDelay(15s) + ≤5s + jitter 안에 반드시 claim**된다.

**착시의 원인.** ④의 READY→`PENDING` 라벨 collapse. 재시도 대기(READY, 최대 10분)가 타깃
페이지에서 `PENDING` 필로 보여 "PENDING에서 안 넘어간다"로 읽혔다. ④ 변경 2(READY 라벨 교정)
+ 변경 1(재시도 문맥 표기)이 이 착시를 제거한다.

**남는 실제 가능성(코드 결함 아님, 재현 시 확인 순서).**

1. 해당 파이프라인 행의 `next_due_at` — 미래면 아직 due가 아님(정상 대기)
2. `claimed_until` — 미래면 다른 워커가 점유 중
3. 활성 claim 수 ≥ `running-pipeline-cap`(기본 100) — soft-cap 포화(데모 규모에선 비현실적)
4. 스케줄러 스레드 생존 여부(`pipeline-scheduler` 데몬) — 파드 로그의 sweep 주기 확인
