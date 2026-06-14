# ADR-016 — Open Questions (미해결 질문)

> [ADR-016 설치/삭제 파이프라인 오케스트레이션 아키텍처](./016-installation-pipeline-architecture.md)의
> **미해결 질문 트래커**. 본 ADR 본문(Part IV)에서 분리한 작업 노트다 — 결정이 나면 본 ADR의
> Part III **Resolved**로 옮기고 여기서 제거한다.
>
> O-번호는 본 ADR 본문의 cross-reference와 **공유**한다(번호 보존). O4–O9·O11–O18·O21–O28은
> 해소되거나 정리되어 빠졌다(번호 gap은 의도) — 해소·정리 내역은 ADR Part III **Resolved** 및 재구성 내역 참조.
> 특히 **O8(breaker canary)·O18(force-check actor)** 는 **개정 4판**의 circuit breaker·force-check
> 제거로 소멸했다(ADR 재구성 내역 참조).

| # | 질문 | 현황 / 방향 |
|---|---|---|
| O10 | retry 새 run의 definition 버전: 원 run 동일 vs 생성 시점 ACTIVE? | 미정. DEPRECATED run retry edge와 함께 pipeline-api.md에서 확정 |
| O19 | `task_check.observed` 어휘 통일 방식 | 통합 enum(예: PENDING\|DONE\|FAILED) vs 원시값(RUNNING/SUCCEEDED·MET/NOT_MET)을 detail(jsonb)에 보존. 미정 |
| O20 | `DISPATCH` task_check 행과 task_attempt 행의 중복 정리 | 둘 다 유지 vs attempt로 충분 — 별도 정리 사안. 미정 |
