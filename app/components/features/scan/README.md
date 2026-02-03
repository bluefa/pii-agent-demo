# Scan 컴포넌트

AWS/Azure 프로젝트의 리소스 스캔 기능을 제공하는 컴포넌트 모음.

## 컴포넌트 구조

```
scan/
├── index.ts              # Export barrel
├── ScanPanel.tsx         # 메인 패널 (인라인, 접이식)
├── ScanStatusBadge.tsx   # 상태 뱃지
├── ScanProgressBar.tsx   # 진행률 바
├── ScanResultSummary.tsx # 스캔 결과 요약
├── ScanHistoryList.tsx   # 스캔 이력 목록
└── CooldownTimer.tsx     # 쿨다운 타이머 (+ useCooldownTimer 훅)
```

## 사용법

### ScanPanel

프로젝트 상세 페이지에서 ResourceTable 상단에 배치.

```tsx
import { ScanPanel } from '@/app/components/features/scan';

<ScanPanel
  projectId={project.id}
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
| `projectId` | `string` | 프로젝트 ID |
| `cloudProvider` | `CloudProvider` | AWS, Azure, GCP 등 |
| `onScanComplete` | `() => void` | 스캔 완료 시 콜백 (리소스 갱신용) |

## 훅

### useScanPolling

스캔 상태를 폴링하고 UI 상태를 계산하는 훅.

```tsx
import { useScanPolling } from '@/app/hooks/useScanPolling';

const {
  status,       // ScanStatusResponse | null
  uiState,      // 'IDLE' | 'COOLDOWN' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  loading,      // boolean
  isPolling,    // boolean
  refresh,      // () => Promise<void>
  startPolling, // () => void
  stopPolling,  // () => void
} = useScanPolling(projectId, {
  onScanComplete: () => { /* 스캔 완료 시 */ },
  onError: (error) => { /* 에러 발생 시 */ },
  interval: 2000,    // 폴링 간격 (기본 2초)
  autoStart: true,   // 마운트 시 자동 시작
});
```

### useCooldownTimer

쿨다운 시간을 실시간으로 계산하는 훅.

```tsx
import { useCooldownTimer } from '@/app/components/features/scan';

const { remainingMs, isExpired, formatted } = useCooldownTimer(
  status?.cooldownUntil,
  onCooldownEnd
);
// formatted: "3분 12초"
```

## UI 상태별 동작

| 상태 | 버튼 | 본문 |
|------|------|------|
| `IDLE` | "스캔 시작" (활성화) | 안내 메시지 또는 마지막 결과 |
| `COOLDOWN` | "X분 X초 후" (비활성화) | 마지막 스캔 결과 표시 |
| `IN_PROGRESS` | "스캔 중..." (비활성화) | 진행률 바 |
| `COMPLETED` | "스캔 시작" (활성화) | 스캔 결과 요약 |
| `FAILED` | "스캔 시작" (활성화) | 에러 메시지 |

## API 연동

- `GET /api/v2/projects/{projectId}/scan/status` - 상태 조회
- `POST /api/v2/projects/{projectId}/scan` - 스캔 시작
- `GET /api/v2/projects/{projectId}/scan/history` - 이력 조회

API 함수는 `app/lib/api/scan.ts`에 정의됨.
