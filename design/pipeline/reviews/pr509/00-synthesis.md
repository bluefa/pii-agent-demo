# PR #509 리뷰 종합 — ADR 수정 우선순위

7개 평가(Claude opus×4 + Sonnet×1, codex gpt-5.5 ×2) 종합. 개별 근거는 형제 파일 참조.

## 수렴 신호 (독립 리뷰어 다수가 같은 결론 = 고신뢰)

1. **별도 Server 전환이 ADR을 광범위 무효화** — Sonnet·codex·O1·O2·codex-arch 전원. 제목·Context #1·Decision·Consequences의 "BFF" 전부 stale. 특히 Considered Options의 Option B("별도 오케스트레이터 보류")와 line 92("별도 워커 분리 거부")가 **채택된 방향을 반박**. "리더 선출 필요 = 가장 비싼 한 줄" Negative는 **삭제**(claim=SKIP LOCKED이 죽임).
2. **slotCap·API cap = 과대강조된 안정성 노브** — O2·codex-arch 둘 다 thesis 확정. 증거: Revision History가 slotCap을 06-13/06-14/06-21 반복 수정(한 개정은 "slotCap 모순 해소"만을 위해 존재)한 반면 load-bearing 결정은 한 번 쓰고 안 건드림.
3. **V1을 단일 서버로 가면 claim 기구의 절반이 불필요** — codex-arch D7 + O2. lease(claimed_by/until)·ownership-CAS·2-tx split·SKIP LOCKED은 **active-active(멀티 pod) 요구가 있을 때만** 값을 함. 단일 서버면 in-memory in-flight set + 1 tx로 충분(크래시 복구는 DB durable + idempotent 재dispatch가 이미 보장).

## THE 결정 (나머지를 게이팅)

**V1 배포 형태: 단일 전용 서버 vs active-active 멀티 pod.**
- **단일 서버** → lease 3컬럼·ownership-CAS·2-tx·SKIP LOCKED·(leader)·slot-gate **전부 삭제**. DB=pipeline+task(status,next_due_at)만, 서버가 due 스캔→bounded executor→동기 호출→1 tx 전이. claim-pull 제안서보다도 단순.
- **active-active** → claim 기구 유지(그 복잡성의 대가를 치를 가치가 있을 때만).

→ 사용자의 단순화 드라이브 + 별도서버 결정 정황상 **단일 서버**가 유력하나, 이건 사용자 소관.

## ADR 수정 우선순위 (P0 → P4)

### P0 — 사실 정정 (결정된 fact, 즉시)
- **별도 Server 재작성**: 제목·Context #1·Decision·Consequences의 BFF→전용 파이프라인 Server. Considered Options 재정렬(Option B 보류→채택, line 92 "별도 워커 거부" 삭제/반전). "리더 선출 필요" Negative 삭제.

### P1 — 고임팩트 구조 (수렴 강함; #1은 사용자 결정 게이팅)
- **(게이팅) V1 단일서버 vs active-active 결정** → claim/lease/CAS/2-tx 존치 여부 결정.
- **caps를 "Safety mechanisms / tuning"으로 강등**: slotCap·API-concurrency·runningPipelineCap·slotRetry·lease/backoff 수치를 Decision에서 빼고 별도 절로. Decision엔 불변식만(no hard QPS·idempotent dispatch·every call has timeout·lease>maxCallTimeout+margin). 진짜 우선순위로 재정렬.
- **slot-gate(slotCap+tf_slot_counter+slotRetry) V1에서 defer**: 워커수+IM 고정풀+멱등이 이미 커버(ADR 자신의 deferred Option F). §4.3 한 문단으로 축소. (codex가 잡은 slotCap overshoot 수식 blocker도 자동 해소.)

### P2 — 내용 정합 / 대체재
- **FR-3 감사추적 대체 명시**: ledger 삭제분 → 전용 Server logs/metrics + `last_requested_at` 컬럼(attempted-vs-not). FR-3 blocker 해소.
- **2개 ADR로 분리(one-decision-per-ADR)**: ADR-016=오케스트레이션 결정 / 신규 ADR=Claim-Pull(or 단일서버) 실행 모델.

### P3 — 가독성 / 포맷
- 히스토리 → "Background & Rationale" 절로 이동; `(결정 N)` 태그 삭제; stale Status 배너 해소/격리.
- 축약어 확장(IM→InfraManager 등) + glossary; `D-Tx` 라벨 제거.
- run-on Decision → ~20 소절 + TL;DR; FR-/NFR- 평이화(before/after 제공됨).
- reversibility note 추가; 제목이 결정을 말하게; Status 정확도.

### P4 — 제안서 기계적 수정 (문서오류 레이어)
- `N`→`W`(워커)/`P`(pod); `=`→`≤`; "ownership CAS" 용어; tf_slot_counter singleton SQL; 제안서 line 4 stale refs; ADR line 64 "orchestrator §1.2" dangling; `ErrorCode.CHECK_ERROR`→`CALL_ERROR`.

## DTO 평가 (참고 — 좋은 소식)
"DTO 과다 = 과복잡" 가설은 **minimal에선 거짓**. 12타입(2 entity+5 enum+3 record+1 exc+1 config), ~0 redundant. 과거 maximal의 ledger/attempt/outbox가 원인이었고 이미 삭제됨. Claim-Pull은 DTO-중립. 별도 Server만 +2~4 API DTO 추가 — 가드레일: controller 경계에만, persistence entity 미러링 금지, service-layer mapper 금지.
