# 상태 관리 정의서

## 개요

PII Agent 시스템의 상태는 크게 4가지 관점으로 구분됩니다.

| 관점 | 필드 | 적용 대상 |
|------|------|-----------|
| PII Agent 연결 상태 | `connectionStatus` | Resource |
| 리소스 라이프사이클 | `lifecycleStatus` | Resource |
| 신규 리소스 여부 | `isNew` | Resource |
| 프로세스 진행 상태 | `processStatus` | Project |
| 반려 상태 | `isRejected`, `rejectionReason`, `rejectedAt` | Project |

---

## 1. ConnectionStatus (PII Agent 연결 상태)

리소스와 PII Agent 간의 실제 연결 상태를 나타냅니다.

```typescript
type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'PENDING';
```

| 상태 | 설명 | UI 표시 |
|------|------|---------|
| `CONNECTED` | PII Agent와 연결 완료 | 녹색 (green-500) |
| `DISCONNECTED` | 연결 끊김 (재연결 필요) | 빨강 (red-500) |
| `PENDING` | PII Agent 설치/연결 대기중 | 회색 (gray-400) |

### 상태 전이
- 초기값: `PENDING`
- 설치 완료 후 연결 테스트 성공: `PENDING` → `CONNECTED`
- 연결 끊김 감지: `CONNECTED` → `DISCONNECTED`
- 재연결 성공: `DISCONNECTED` → `CONNECTED`

---

## 2. ResourceLifecycleStatus (리소스 라이프사이클)

리소스의 설치 프로세스 내 현재 단계를 나타냅니다.

```typescript
type ResourceLifecycleStatus =
  | 'DISCOVERED'        // 스캔됨 (기본)
  | 'TARGET'            // 연동 대상으로 선택됨
  | 'PENDING_APPROVAL'  // 승인 요청 진행중
  | 'INSTALLING'        // 설치 진행중
  | 'READY_TO_TEST'     // 연결 테스트 필요
  | 'ACTIVE';           // 설치/연결 완료
```

| 상태 | 프로세스 단계 | 설명 |
|------|---------------|------|
| `DISCOVERED` | 1단계 | 스캔으로 발견됨, 아직 연동 대상 아님 |
| `TARGET` | 1단계 | 사용자가 연동 대상으로 선택함 |
| `PENDING_APPROVAL` | 2단계 | 관리자 승인 대기중 |
| `INSTALLING` | 3단계 | PII Agent 설치 진행중 |
| `READY_TO_TEST` | 4단계 | 설치 완료, 연결 테스트 필요 |
| `ACTIVE` | 5단계 | 모든 설치/연결 완료 |

### 상태 전이 흐름
```
DISCOVERED → TARGET → PENDING_APPROVAL → INSTALLING → READY_TO_TEST → ACTIVE
                ↑           |
                └───────────┘ (반려 시 TARGET으로 복귀)
```

---

## 3. isNew (신규 리소스 플래그)

스캔으로 새로 발견된 리소스임을 표시합니다.

```typescript
interface Resource {
  isNew?: boolean;  // true: NEW 라벨 표시
}
```

| 값 | 설명 | UI 표시 |
|----|------|---------|
| `true` | 신규 발견 리소스 | "NEW" 뱃지 (blue-500) |
| `false` / undefined | 기존 리소스 | 표시 없음 |

### 리셋 시점
- **연동 대상 확정 요청 시**: `isNew`를 `false`로 리셋
- 이후 재스캔에서 발견된 리소스만 다시 `isNew: true`

---

## 4. ProcessStatus (프로세스 진행 상태)

과제(Project)의 전체 설치 프로세스 진행 단계입니다.

```typescript
enum ProcessStatus {
  WAITING_TARGET_CONFIRMATION = 1,  // 연동 대상 확정 대기
  WAITING_APPROVAL = 2,              // 승인 대기
  INSTALLING = 3,                    // 설치 진행 중
  WAITING_CONNECTION_TEST = 4,       // 연결 테스트 필요
  INSTALLATION_COMPLETE = 5          // 설치 완료
}
```

| 단계 | 상태 | 주요 액션 | 담당자 |
|------|------|----------|--------|
| 1 | `WAITING_TARGET_CONFIRMATION` | 연동 대상 확정 | 서비스 담당자 |
| 2 | `WAITING_APPROVAL` | 승인/반려 | 관리자 |
| 3 | `INSTALLING` | 설치 상태 모니터링 | 시스템 |
| 4 | `WAITING_CONNECTION_TEST` | DB 연결 테스트 | 서비스 담당자 |
| 5 | `INSTALLATION_COMPLETE` | - | - |

### AWS vs IDC 차이점
| 구분 | AWS | IDC |
|------|-----|-----|
| 1단계 진입 전 | 리소스 자동 스캔 | 스캔 없음 |
| 스캔 재실행 | 가능 | 불가 (버튼 숨김) |

---

## 5. 반려 상태 (Project Rejection)

관리자가 승인 요청을 반려한 경우의 상태입니다.

```typescript
interface Project {
  isRejected: boolean;
  rejectionReason?: string;
  rejectedAt?: string;  // ISO 8601 형식
}
```

| 필드 | 설명 |
|------|------|
| `isRejected` | 반려 여부 (true/false) |
| `rejectionReason` | 반려 사유 |
| `rejectedAt` | 반려 일시 |

### 반려 시 동작
- `processStatus`는 `WAITING_APPROVAL (2)` 유지
- `isRejected`를 `true`로 설정
- 리소스의 `lifecycleStatus`는 변경 없음 (재수정 후 재요청 가능)
- UI에 반려 사유 표시

### 재요청 시 동작
- 서비스 담당자가 리소스 수정 후 재요청
- `isRejected`를 `false`로 리셋
- `rejectionReason`, `rejectedAt` 클리어

---

## 상태 조합 시나리오

### 시나리오 1: 정상 설치 완료
```
리소스 A:
  connectionStatus: CONNECTED
  lifecycleStatus: ACTIVE
  isNew: false
```

### 시나리오 2: 승인 대기 중 (신규 리소스)
```
리소스 B:
  connectionStatus: PENDING
  lifecycleStatus: PENDING_APPROVAL
  isNew: true

프로젝트:
  processStatus: WAITING_APPROVAL
  isRejected: false
```

### 시나리오 3: 반려됨
```
프로젝트:
  processStatus: WAITING_APPROVAL
  isRejected: true
  rejectionReason: "RDS_CLUSTER는 지원되지 않습니다."
```

### 시나리오 4: 연결 끊김 감지
```
리소스 C:
  connectionStatus: DISCONNECTED
  lifecycleStatus: ACTIVE
  isNew: false
  note: "끊김"
```

### 시나리오 5: 재스캔으로 신규 리소스 발견
```
기존 리소스 (연동 완료):
  connectionStatus: CONNECTED
  lifecycleStatus: ACTIVE
  isNew: false

신규 발견 리소스:
  connectionStatus: PENDING
  lifecycleStatus: DISCOVERED
  isNew: true
  isSelected: false
```
