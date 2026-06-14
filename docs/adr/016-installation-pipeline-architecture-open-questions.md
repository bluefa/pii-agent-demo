# ADR-016 — Open Questions (미해결 질문)

> [ADR-016 설치/삭제 파이프라인 오케스트레이션 아키텍처](./016-installation-pipeline-architecture.md)의
> **미해결 질문 트래커**. 본 ADR 본문(Part IV)에서 분리한 작업 노트다 — 결정이 나면 본 ADR의
> Part III **Resolved**로 옮기고 여기서 제거한다.
>
> O-번호는 본 ADR 본문의 cross-reference와 **공유**한다(번호 보존). O4–O7·O9·O11–O17·O21–O26은
> 해소되거나 정리되어 빠졌다(번호 gap은 의도) — 해소·정리 내역은 ADR Part III **Resolved** 및 재구성 내역 참조.

| # | 질문 | 현황 / 방향 |
|---|---|---|
| O8 | breaker canary는 real 대기 task인가 synthetic dispatch인가? | 미정. synthetic + R2 예외 명문화 방향 우세 |
| O10 | retry 새 run의 definition 버전: 원 run 동일 vs 생성 시점 ACTIVE? | 미정. DEPRECATED run retry edge와 함께 pipeline-api.md에서 확정 |
| O18 | `FORCE_CHECK`를 kind에서 빼고 수동 강제 확인을 actor/triggered_by 속성으로 표현? | trigger 주체는 kind와 직교 축. 채택 시 task_check에 actor 추가·kind에서 FORCE 제거; 미채택 시 FORCE_CHECK kind 유지(현행). 미정 |
| O19 | `task_check.observed` 어휘 통일 방식 | 통합 enum(예: PENDING\|DONE\|FAILED) vs 원시값(RUNNING/SUCCEEDED·MET/NOT_MET)을 detail(jsonb)에 보존. 미정 |
| O20 | `DISPATCH` task_check 행과 task_attempt 행의 중복 정리 | 둘 다 유지 vs attempt로 충분 — 별도 정리 사안. 미정 |
| O27 | 완료(terminal) id 결과 보존 방식 | 방식1: 집계 시 id별 최신 check 행 조회(추가 상태 없음, 권장) vs 방식2: terminal id를 context에 누적(대규모). 동작 동일 |
| O28 | 모든 dispatch task가 실제로 멱등인가 (특히 DELETE의 not-found=성공) | 멱등성 불변식은 선언됨(결정 3.1)이나 각 task 구현이 이를 만족하는지는 코드·IM 확인 대상 — P0-1 해소가 이 불변식에 의존하므로 task별 검증 필요 |
