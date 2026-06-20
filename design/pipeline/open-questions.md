# ADR-016 — Open Questions (미해결 질문)

> [ADR-016 Install/Delete Pipeline Orchestration](../../docs/adr/ADR-016-install-delete-pipeline-orchestration.md)의
> **미해결 질문 트래커**. 결정이 나면 [decision-history.md](./decision-history.md)의 **Resolved**로
> 옮기고 여기서 제거한다.
>
> O-번호는 본 ADR 본문의 cross-reference와 **공유**한다(번호 보존). O4–O9·O11–O28은
> 해소되거나 정리되어 빠졌다(**활성 미해결 0건** — O29는 postCheck v1 defer와 함께 dormant; 번호 gap은 의도) — 해소·정리 내역은 ADR Part III **Resolved** 및 재구성 내역 참조.
> 특히 **O8(breaker canary)·O18(force-check actor)** 는 **개정 4판**의 circuit breaker·force-check
> 제거로 소멸했다(ADR 재구성 내역 참조).

| # | 질문 | 현황 / 방향 |
|---|---|---|
| O29 | `task_check.detail`의 kind별 스키마 + full terraform 로그 조회 경로 | **write-once 캡처라 중요**(덜 캡처 시 옛 run 데이터 영구 소실). 하위 4: (1) full 로그 위치 — 포인터 위임(A)/BFF 복제(B·B')/발췌만(C), **IM 로그 API 존재·보관기간**에 종속; (2) 발췌 정책(크기·tail vs apply 요약); (3) type별 필드(TERRAFORM_LOG·API_RESPONSE·CHECK/DISPATCH detail 유무); (4) 민감정보 redaction(캡처 전 필수). 타입 그릇 패턴은 S27 확정. **DEFERRED (dormant)** — postCheck v1 미도입(task-model.md)과 함께 보류; postCheck 도입 시 재개(선결 외부 사실: IM 로그 API 실재·보관기간). |
