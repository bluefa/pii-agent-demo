# UI/UX 컴포넌트 현황 진단 리포트

> 진단일: 2026-02-17
> 대상: ~95개 컴포넌트 (.tsx)
> 진단 기준: 테마 준수, 상태 처리, CTA 라벨, 사용자 피드백, 정보 계층, 에러 복구

---

## 1. Executive Summary

| 항목 | 현황 |
|------|------|
| 전체 컴포넌트 | ~95개 |
| 테마 토큰 사용 | ~47개 (54%) |
| Raw Tailwind 사용 | ~40개 (46%) |
| `alert()` 호출 | 41회 |
| Toast/Notification 시스템 | 미구현 |
| ErrorView 컴포넌트 | 미구현 (ADR-008 후속 작업) |
| Error Boundary | 미구현 (ADR-008 v2) |

### 핵심 발견사항

1. **인프라는 완성, 채택 미완료** — `lib/theme.ts` (282줄), `lib/errors.ts`, `lib/fetch-json.ts` 모두 구현되었으나 컴포넌트 레벨 적용률 54%
2. **모든 에러 피드백이 `alert()`** — 41회, 사용자 흐름 차단 및 복구 옵션 미제공
3. **동적 Tailwind 클래스 버그** — `hover:${변수}` 패턴으로 일부 스타일 미작동
4. **접근성 기본 요소 누락** — role, aria-label, focus trap 등 광범위하게 부재

---

## 2. alert() 사용 현황 — 가장 시급한 문제

**총 41회**, 모든 에러/성공 피드백이 브라우저 `alert()`로 처리됨.

| 영역 | 파일 | 횟수 | 비고 |
|------|------|------|------|
| Admin | AdminDashboard.tsx | 7 | 사용자 추가/삭제, 승인/반려, 설치 완료 |
| AWS | AwsProjectPage.tsx | 4 | 크레덴셜, 연결 테스트, VM 검증 |
| Azure | AzureProjectPage.tsx | 4 | AWS와 동일 패턴 |
| GCP | GcpProjectPage.tsx | 4 | AWS와 동일 패턴 |
| IDC | IdcProjectPage.tsx | 8 | 최다 — 리소스 업데이트, 방화벽, 재시도 등 |
| SDU | SduProjectPage.tsx | 4 | **성공 시에도 alert()** (line 188) |
| Hooks | useAsync, useApiMutation | 2 | 폴백 에러 핸들러 |
| Features | CredentialListTab, TestConnectionTab 등 | 8 | |

**영향:**
- 사용자 작업 흐름을 블로킹 방식으로 중단
- 에러 발생 시 복구 옵션(재시도, 상세 보기 등) 미제공
- 성공/실패 구분 없이 동일한 alert() 사용

**필요 조치:** Toast/Notification 시스템 구현 후 전면 교체

---

## 3. 테마 토큰 준수 현황

### 3.1 인프라 (lib/theme.ts)

`lib/theme.ts` (282줄)에 다음 토큰이 정의되어 있으나 채택률이 불완전함:

| 토큰 | 용도 | 채택률 |
|------|------|--------|
| `statusColors` | 성공/에러/경고/대기/정보 색상 | ~60% |
| `textColors` | 텍스트 색상 (primary~inverse) | ~40% |
| `buttonStyles` + `getButtonClass()` | 버튼 variant/size | ~30% |
| `cardStyles` | 카드 레이아웃 | ~20% |
| `tableStyles` | 테이블 헤더/행/셀 | ~40% |
| `modalStyles` | 모달 overlay/container | ~10% |
| `getInputClass()` | 입력 필드 상태 | ~20% |

### 3.2 심각도별 분류

#### 파손 (런타임 버그)

| 파일 | 문제 | 라인 |
|------|------|------|
| ResourceRow.tsx | `hover:${bgColors.muted}` — Tailwind 동적 클래스 미작동 | 98, 119, 194 |
| ClusterRow.tsx | 동일한 동적 클래스 문제 | 103 |
| CollapsibleSection.tsx | `hover:${bgColors.muted}` 동일 문제 | 41 |

#### 전면 위반 (theme.ts 참조 전혀 없음)

| 파일 | 설명 |
|------|------|
| FilterTab.tsx | 100% raw Tailwind — `bg-blue-100`, `text-blue-700` 등 |
| StatusIcon.tsx | 모든 색상 정의가 raw — `text-green-500`, `bg-red-50` 등 |
| TestConnectionTab.tsx | 광범위한 raw 클래스 — 상태 표시, 버튼, 정보 섹션 전체 |
| TerraformStatusModal.tsx | 스타일 함수 내 raw 클래스 |
| StepIndicator.tsx | `bg-green-500`, `bg-blue-500`, `ring-blue-100` 등 |

#### 부분 위반 (토큰이 있지만 하드코딩)

| 파일 | 문제 |
|------|------|
| Button.tsx | `buttonStyles`/`getButtonClass()` 존재하지만 자체 `variantStyles` 정의 |
| Modal.tsx | `modalStyles` 존재하지만 직접 클래스 사용 |
| Card.tsx | `cardStyles` 존재하지만 직접 클래스 사용 |
| Table.tsx | `tableStyles` 존재하지만 직접 클래스 사용 |
| UserSearchInput.tsx | `getInputClass()` 존재하지만 직접 클래스 사용 |

#### 색상 불일치

| 파일 | 사용 값 | 토큰 값 |
|------|---------|---------|
| ErrorState.tsx | `bg-red-50` | `statusColors.error.bg` = `bg-red-100` |
| RejectionAlert.tsx | `bg-red-50`, `border-red-200` | `statusColors.error.bg/border` = `bg-red-100`/`border-red-300` |

#### 아이콘 하드코딩

| 파일 | 문제 |
|------|------|
| CloudProviderIcon.tsx | `bg-[#FF9900]/10` 등 hex 색상 직접 사용 |
| AwsServiceIcon.tsx | colorMap에 hex 색상 하드코딩 |
| GcpServiceIcon.tsx | colorMap에 hex 색상 하드코딩 |
| DatabaseIcon.tsx | `bg-gray-200`, `text-gray-500` 직접 사용 |

### 3.3 모범 사례 (참고용)

| 파일 | 특징 |
|------|------|
| ApprovalDetailModal.tsx | textColors, tableStyles, getInputClass() 모두 사용 |
| ProjectCreateModal.tsx | statusColors, getInputClass(), providerColors 모두 사용 |
| Badge.tsx | badgeStyles, statusColors 완벽 사용 |
| InstallationErrorView.tsx | statusColors 토큰 정확히 사용 |
| ActionCard.tsx | statusColors 토큰 정확히 사용 |
| ScanPanel.tsx | statusColors, textColors, borderColors 모두 사용 |

---

## 4. 상태 처리 (Empty / Loading / Error)

### 4.1 잘 된 곳

| 컴포넌트 | 구현 내용 |
|----------|----------|
| ProjectsTable | 로딩 스피너 + "등록된 과제가 없습니다" + 안내 메시지 |
| ScanHistoryList | 로딩/에러/빈 상태 모두 별도 UI |
| ProjectCreateModal | 인라인 검증 + 에러 알림 + 로딩 상태 |
| ScanPanel | IDLE/IN_PROGRESS/FAILED/COMPLETED 4개 상태 모두 처리 |
| InstancePanel | 인스턴스 수, 선택 안내, 접기/펼치기 |

### 4.2 누락된 곳

| 컴포넌트 | 문제 |
|----------|------|
| ServiceSidebar | 서비스 0건일 때 빈 `<ul>` 렌더링 — 안내 메시지 없음 |
| AdminDashboard | 서비스 fetch 중 빈 사이드바 노출 |
| ErrorState.tsx | **재시도 버튼 없음** — "돌아가기"만 존재 |
| LoadingState.tsx | "로딩 중..." — 대상 불명, 타임아웃 안내 없음 |
| AWS/Azure/GCP ResourceTable | 리소스 0건일 때 빈 테이블만 노출 (로딩/빈 상태 구분 불가) |
| Button.tsx | 로딩 상태 미지원 |
| Card.tsx | 빈 상태 표시 미지원 |
| Table.tsx | 로딩/에러 상태 미지원 (빈 상태만 있음) |

### 4.3 미구현 인프라

| 항목 | 상태 | ADR-008 참조 |
|------|------|------------|
| ErrorView 컴포넌트 | 미존재 | "후속 작업" 명시 |
| Toast/Notification | 미존재 | — |
| Error Boundary | 미존재 | "v2에서 도입" |
| ErrorCatalog | 미존재 | "ErrorView 안정화 후" |
| fetchJson → 기존 API 마이그레이션 | 미착수 | "점진적" |

---

## 5. CTA 라벨 진단

### 5.1 좋은 패턴 (동사+목적어)

- "연동 대상 확정 승인 요청"
- "확정 대상 수정"
- "리소스 추가"
- "과제 등록"
- "연결 테스트 실행"
- "설치 스크립트 다운로드"
- "권한 등록 확인"
- "승인하기" / "반려하기"

### 5.2 문제 있는 패턴

| 현재 | 문제 | 개선안 |
|------|------|--------|
| "돌아가기" | 목적지 불명확 | "목록으로 돌아가기" |
| "Test Connection" | 영어 (IdcProcessStatusCard) | "연결 테스트 실행" |
| "관리" | 대상 불명확 (Info Card) | "IAM USER 관리", "SourceIP 관리" |
| "가이드" | 대상 불명확 (Info Card) | "Scan Role 등록 가이드" |
| "확인" | 일부 맥락에서 모호 | 맥락별 구체화 필요 |

---

## 6. 접근성 (Accessibility) 진단

| 컴포넌트 | 문제 | 심각도 |
|----------|------|--------|
| LoadingSpinner | `role="status"`, `aria-label` 없음 | 높음 |
| Modal | Focus trap 미구현 | 높음 |
| Tooltip | `role="tooltip"`, `aria-describedby` 없음, 키보드 접근 불가 | 높음 |
| Table.tsx | `scope="col"` 없음, 클릭 행에 `role="button"` 없음 | 중간 |
| UserSearchInput | `aria-expanded`, `role="listbox"`, `role="option"` 없음 | 중간 |
| CollapsibleSection | `aria-expanded`, `aria-controls` 없음 | 중간 |
| ProcessGuideTimeline | 정의되지 않은 `status` 변수 참조 (aria-label 깨짐) | 중간 |
| 아이콘 컴포넌트 전체 | `aria-hidden` 또는 의미 있는 `aria-label` 없음 | 낮음 |
| AzureServiceIcon | `alt={type}` — enum 값(AZURE_MSSQL) 그대로 노출 | 낮음 |
| Badge | 색상만으로 상태 구분 (dot이 부분 보완) | 낮음 |

---

## 7. 에러 복구 (Error Recovery)

### 현재 패턴

```
에러 발생 → alert() → 사용자가 "확인" 클릭 → 아무것도 안 됨
```

### 누락된 복구 옵션

| 상황 | 현재 | 필요 |
|------|------|------|
| ErrorState.tsx | "돌아가기"만 있음 | 재시도 버튼 추가 |
| 설치 실패 (Azure/GCP) | 리소스별 재시도 없음 | 개별 재시도 CTA |
| AwsInstallationModeSelector | 비가역 선택인데 확인 대화상자 없음 | 확인 모달 추가 |
| ProcessStatusCard 폴링 | 폴링 실패 시 조용히 무시 | 재연결 안내 |
| PE_REJECTED (Azure) | "재승인 필요" 표시만 | 재승인 제출 CTA |
| SduProjectPage | 성공 시 alert() | Toast로 비차단 알림 |

---

## 8. 컴포넌트별 종합 스코어카드

### 범례: ✅ 양호 / ⚠️ 부분 문제 / ❌ 심각 / — 해당 없음

### UI Primitives

| 컴포넌트 | 테마 | 상태 | CTA | 피드백 | 접근성 |
|----------|------|------|-----|--------|--------|
| Badge.tsx | ✅ | ✅ | — | ✅ | ⚠️ |
| HistoryTable.tsx | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Button.tsx | ❌ | ⚠️ | — | ❌ | ⚠️ |
| Modal.tsx | ⚠️ | ✅ | ✅ | ✅ | ⚠️ |
| Card.tsx | ⚠️ | ⚠️ | — | ⚠️ | ⚠️ |
| Table.tsx | ⚠️ | ⚠️ | — | ⚠️ | ❌ |
| UserSearchInput | ⚠️ | ⚠️ | ✅ | ⚠️ | ❌ |
| CollapsibleSection | ❌ | ✅ | ✅ | ✅ | ❌ |
| Tooltip.tsx | ⚠️ | ✅ | — | ✅ | ❌ |
| LoadingSpinner | ⚠️ | ✅ | — | — | ❌ |
| CloudProviderIcon | ❌ | ✅ | — | ✅ | ⚠️ |

### Admin

| 컴포넌트 | 테마 | 상태 | CTA | 피드백 | 복구 |
|----------|------|------|-----|--------|------|
| ApprovalDetailModal | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| ProjectCreateModal | ✅ | ✅ | ✅ | ✅ | ✅ |
| ProjectsTable | ⚠️ | ✅ | ✅ | ⚠️ | — |
| AdminDashboard | ⚠️ | ✅ | ✅ | ❌ | — |
| PermissionsPanel | ⚠️ | ✅ | ✅ | ⚠️ | — |
| ServiceSidebar | ⚠️ | ❌ | — | ⚠️ | — |
| AdminHeader | ⚠️ | — | — | — | — |

### Project Pages

| 컴포넌트 | 테마 | alert() | CTA | 복구 |
|----------|------|---------|-----|------|
| AwsProjectPage | ✅ | 4회 | ✅ | ⚠️ |
| AzureProjectPage | ⚠️ | 4회 | ✅ | ⚠️ |
| GcpProjectPage | ✅ | 4회 | ✅ | ⚠️ |
| IdcProjectPage | ✅ | 8회 | ✅ | ⚠️ |
| SduProjectPage | ✅ | 4회 | ⚠️ | ⚠️ |
| ErrorState.tsx | ❌ | — | ⚠️ | ❌ |
| LoadingState.tsx | ❌ | — | — | — |
| ProjectHeader.tsx | ❌ | — | ⚠️ | — |

### Process Status

| 컴포넌트 | 테마 | 상태 | CTA | 피드백 | 복구 |
|----------|------|------|-----|--------|------|
| ProcessStatusCard | ✅ | ⚠️ | ⚠️ | ✅ | ⚠️ |
| StepProgressBar | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| ApprovalRequestModal | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| ProcessGuideStepCard | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| AwsInstallationInline | ✅ | ✅ | ✅ | ✅ | ✅ |
| AzureInstallationInline | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| GcpInstallationInline | ✅ | ✅ | — | ✅ | ⚠️ |
| ApprovalModals | ❌ | ⚠️ | ✅ | ⚠️ | ❌ |
| AwsInstallationModeSelector | ⚠️ | ⚠️ | ✅ | ✅ | ❌ |
| ConnectionTestPanel | ⚠️ | ✅ | ✅ | ✅ | ⚠️ |
| MissingCredentialsTab | ⚠️ | ✅ | — | ✅ | ⚠️ |
| InstallationErrorView | ✅ | ✅ | ✅ | ✅ | ✅ |

### Scan & Resource

| 컴포넌트 | 테마 | 상태 | CTA | 피드백 |
|----------|------|------|-----|--------|
| ScanPanel | ✅ | ✅ | ⚠️ | ✅ |
| ScanHistoryList | ✅ | ✅ | ✅ | ✅ |
| ResourceTable | ✅ | ✅ | ✅ | ✅ |
| InstancePanel | ✅ | ✅ | ✅ | ✅ |
| VmDatabaseConfigPanel | ⚠️ | ✅ | ✅ | ✅ |
| ScanProgressBar | ❌ | ✅ | — | ✅ |
| ResourceRow | ❌ | ✅ | ✅ | ✅ |
| ClusterRow | ❌ | ✅ | ✅ | ✅ |
| FilterTab | ❌ | — | ✅ | ✅ |
| StatusIcon | ❌ | — | — | ✅ |
| EmptyState | ❌ | ✅ | — | ✅ |
| RegionGroup | ❌ | — | — | ✅ |

### Remaining Features

| 컴포넌트 | 테마 | 상태 | CTA | 피드백 |
|----------|------|------|-----|--------|
| ProjectInfoCard | ✅ | ✅ | — | ✅ |
| AwsInfoCard | ✅ | ✅ | ⚠️ | ✅ |
| AzureInfoCard | ✅ | ✅ | ⚠️ | ✅ |
| GcpInfoCard | ✅ | ✅ | ⚠️ | ✅ |
| SduInstallationProgress | ✅ | ✅ | ✅ | ✅ |
| IamUserManageModal | ✅ | ✅ | ✅ | ✅ |
| SourceIpManageModal | ✅ | ✅ | ✅ | ✅ |
| TestConnectionTab | ❌ | ✅ | ✅ | ✅ |
| TerraformStatusModal | ❌ | ✅ | ✅ | ✅ |
| StepIndicator | ❌ | ✅ | — | ✅ |
| IdcInstallationStatus | ⚠️ | ✅ | ✅ | ✅ |
| CredentialListTab | ⚠️ | ✅ | ✅ | ✅ |

---

## 9. 개선 우선순위 제안

### P0 — 사용자 경험 차단 (Critical Path)

1. **Toast/Notification 시스템 구현** → 41개 `alert()` 대체
2. **동적 Tailwind 클래스 버그 수정** — ResourceRow, ClusterRow, CollapsibleSection
3. **ErrorState.tsx에 재시도 버튼 추가**

### P1 — 디자인 시스템 표준화

4. 전면 위반 파일 토큰화 (FilterTab, StatusIcon, TestConnectionTab, TerraformStatusModal, StepIndicator)
5. UI Primitive 토큰 연결 (Button → `getButtonClass()`, Modal → `modalStyles`, Card → `cardStyles`)
6. 색상 불일치 해소 (ErrorState, RejectionAlert의 `bg-red-50` vs `statusColors.error.bg`)

### P2 — 상태 처리 보완

7. ServiceSidebar 빈 상태 메시지 추가
8. AdminDashboard 서비스 로딩 상태 추가
9. LoadingState에 로딩 대상 표시 + 타임아웃 안내

### P3 — UX 개선

10. CTA 라벨 구체화 ("가이드" → "Scan Role 등록 가이드", "관리" → "DB Credential 관리")
11. "Test Connection" → "연결 테스트 실행" (한국어 통일)
12. 비가역 선택 확인 대화상자 (AwsInstallationModeSelector)
13. 접근성 기본 요소 (LoadingSpinner role, Modal focus trap, Tooltip keyboard)

---

## 관련 문서

- `docs/adr/008-error-handling-strategy.md` — 에러 처리 전략 (Layer 1 구현 완료, Layer 2 미구현)
- `lib/theme.ts` — 디자인 토큰 시스템 (282줄)
- `lib/errors.ts` — AppError 클래스 (79줄)
- `lib/fetch-json.ts` — fetchJson 래퍼 (195줄)
