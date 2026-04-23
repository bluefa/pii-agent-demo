# Scan 컴포넌트

AWS/Azure/GCP 프로젝트의 리소스 스캔 기능을 제공하는 컴포넌트 모음.

## 컴포넌트 구조

```
scan/
├── index.ts              # Export barrel
├── ScanPanel.tsx         # ScanController(headless) + 기본 UI 래퍼
├── ScanStatusBadge.tsx   # 상태 뱃지
├── ScanProgressBar.tsx   # 진행률 바
└── ScanResultSummary.tsx # 스캔 결과 요약
```

## 사용법

### ScanPanel (기본 UI)

프로젝트 상세 페이지에서 ResourceTable 상단에 배치.

```tsx
import { ScanPanel } from '@/app/components/features/scan';

<ScanPanel
  targetSourceId={project.targetSourceId}
  cloudProvider={project.cloudProvider}
  onScanComplete={async () => {
    const updatedProject = await getProject(project.id);
    onProjectUpdate(updatedProject);
  }}
/>
```

#### Props

| Prop | Type | 설명 |
|------|------|------|
| `targetSourceId` | `number` | Target Source ID |
| `cloudProvider` | `CloudProvider` | AWS, Azure, GCP 등 |
| `onScanComplete` | `() => void` | 스캔 완료 시 콜백 (리소스 갱신용) |

### ScanController (headless)

render-props 패턴으로 스캔 상태/액션만 노출. 커스텀 UI를 플러그인할 때 사용.

```tsx
import { ScanController } from '@/app/components/features/scan';

<ScanController targetSourceId={id} onScanComplete={refresh}>
  {({ state, startScan, progress, lastResult, canStart }) => (
    // state: 'EMPTY' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED'
    <MyCustomScanUI ... />
  )}
</ScanController>
```

## 훅

### useScanPolling

스캔 상태를 폴링하고 UI 상태를 계산하는 훅.

```tsx
import { useScanPolling } from '@/app/hooks/useScanPolling';

const {
  latestJob,    // V1ScanJob | null
  uiState,      // 'IDLE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  loading,      // boolean
  isPolling,    // boolean
  refresh,      // () => Promise<void>
  startPolling, // () => void
  stopPolling,  // () => void
} = useScanPolling(targetSourceId, {
  onScanComplete: () => { /* 스캔 완료 시 */ },
  onError: (error) => { /* 에러 발생 시 */ },
  interval: 2000,    // 폴링 간격 (기본 2초)
  autoStart: true,   // 마운트 시 자동 시작
});
```

## UI 상태별 동작

| 상태 | 버튼 | 본문 |
|------|------|------|
| `EMPTY` | "스캔 시작" (활성화) | 안내 메시지 |
| `IN_PROGRESS` | 숨김 | 진행률 바 |
| `SUCCESS` | "스캔 시작" (활성화) | 스캔 결과 요약 |
| `FAILED` | "스캔 시작" (활성화) | 에러 메시지 |

## API 연동

- `GET /v1/target-sources/{id}/scan-jobs/latest` - 최신 스캔 상태
- `POST /v1/target-sources/{id}/scan-jobs` - 스캔 시작

API 함수는 `app/lib/api/scan.ts`에 정의됨.
