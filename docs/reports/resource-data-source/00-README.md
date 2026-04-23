# Resource Data Source Migration — Wave Specs

원본 감사 문서: [`../resource-data-source-audit-2026-04-23.md`](../resource-data-source-audit-2026-04-23.md)

## 배경

- Provider 페이지(AWS/Azure/GCP) 의 "리소스" 표시가 step 무관하게 4 개 / 2 개 API 를 병합하거나, mock 누설값 `project.resources` 를 직접 사용해 왔음.
- 신규 정책: 단계별 단일 데이터 소스로 정렬.

## Wave 구성

| Spec | 제목 | Scope | 의존 | 병렬 가능 |
|---|---|---|---|---|
| `phase1-mock-fix.md` | Mock confirmed-integration 누락 + targetSource 누설 차단 | mock store + bff route | 없음 | Phase 3 와 병렬 가능 |
| `phase2-integration-target-info-card.md` | `IntegrationTargetInfoCard` 신규 + step 4-7 분기 | 신규 컴포넌트 + 3 provider 페이지 step 분기 | Phase 1 | — |
| `phase3-process-status-cleanup.md` | `ProcessStatusCard` 의 confirmed-integration 호출 제거 | ProcessStatusCard + ApprovalWaitingCard / ApprovalApplyingBanner | 없음 | Phase 1 과 병렬 가능 |
| `phase4-project-resources-removal.md` | `Project.resources` 필드 폐기 + provider 페이지 catalog 호출 전환 | 3 provider 페이지 + 타입 / normalizer / mock get | Phase 1, 2, 3 | — |

## 신규 정책 (요약)

| Step | 컴포넌트 | API |
|---|---|---|
| 1 WAITING_TARGET_CONFIRMATION | `DbSelectionCard` | `getConfirmResources` (`/resources`) |
| 2 WAITING_APPROVAL | (리소스 미표시) | 호출 없음 |
| 3 APPLYING_APPROVED | `ResourceTransitionPanel` (개편) | `getApprovedIntegration` (`/approved-integration`) |
| 4-7 INSTALLING ~ INSTALLATION_COMPLETE | `IntegrationTargetInfoCard` (신규) | `getConfirmedIntegration` (`/confirmed-integration`) |

## 실행 순서 (권장)

```
Phase 1 ─────────┐
                 ├─→ Phase 2 ─→ Phase 4
Phase 3 ─────────┘
```

- Phase 1 & Phase 3 병렬 시작 가능
- Phase 2 는 Phase 1 머지 후 (mock 가 step 4 에서 confirmed-integration 응답을 채워야 신규 카드 검증 가능)
- Phase 4 는 1, 2, 3 모두 머지 후 (마지막에 누설 차단)
