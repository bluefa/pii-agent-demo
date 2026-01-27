# Phase 1: 유틸리티 및 상수 통합

## 개요

이 문서는 Phase 1 리팩토링에서 생성된 유틸리티 함수와 상수들의 사용법을 설명합니다.

---

## 생성된 파일

```
lib/
  utils/
    date.ts           # 날짜 포맷팅 유틸리티
    credentials.ts    # 자격증명 관련 유틸리티
  constants/
    labels.ts         # 라벨 상수 통합
```

---

## 날짜 포맷팅 유틸리티

### 파일 위치
`lib/utils/date.ts`

### 사용 가능한 포맷

| 포맷 | 설명 | 예시 출력 |
|------|------|----------|
| `date` | 날짜만 | 2024. 01. 15. |
| `datetime` | 날짜 + 시간 | 2024. 01. 15. 14:30 |
| `datetime-seconds` | 날짜 + 시간 + 초 | 2024. 01. 15. 14:30:45 |
| `short` | 짧은 형식 | 1월 15일 14:30 |

### 사용 예시

```typescript
import { formatDate, formatDateOnly, formatDateTime, formatDateTimeSeconds } from '@/lib/utils/date';

// 기본 사용 (date 포맷)
formatDate('2024-01-15T14:30:45Z');                    // "2024. 01. 15."

// 포맷 지정
formatDate('2024-01-15T14:30:45Z', 'datetime');        // "2024. 01. 15. 14:30"
formatDate('2024-01-15T14:30:45Z', 'datetime-seconds'); // "2024. 01. 15. 14:30:45"
formatDate('2024-01-15T14:30:45Z', 'short');           // "1월 15일 14:30"

// 헬퍼 함수 사용
formatDateOnly('2024-01-15T14:30:45Z');    // "2024. 01. 15."
formatDateTime('2024-01-15T14:30:45Z');    // "2024. 01. 15. 14:30"
formatDateTimeSeconds('2024-01-15T14:30:45Z'); // "2024. 01. 15. 14:30:45"
```

### 마이그레이션 가이드

**Before:**
```typescript
// 각 컴포넌트에서 직접 정의
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};
```

**After:**
```typescript
import { formatDateOnly } from '@/lib/utils/date';

// 직접 사용
<span>{formatDateOnly(project.createdAt)}</span>
```

---

## 자격증명 유틸리티

### 파일 위치
`lib/utils/credentials.ts`

### 함수 목록

| 함수 | 설명 |
|------|------|
| `filterCredentialsByType` | 데이터베이스 타입별 자격증명 필터링 |
| `findCredentialById` | ID로 자격증명 찾기 |

### 사용 예시

```typescript
import { filterCredentialsByType, findCredentialById } from '@/lib/utils/credentials';
import { DatabaseType } from '@/lib/types';

// 타입별 필터링
const rdsCredentials = filterCredentialsByType(credentials, 'RDS' as DatabaseType);
const postgresCredentials = filterCredentialsByType(credentials, 'POSTGRESQL' as DatabaseType);

// ID로 찾기
const credential = findCredentialById(credentials, 'cred-123');
```

---

## 라벨 상수

### 파일 위치
`lib/constants/labels.ts`

### 사용 가능한 상수

#### ERROR_TYPE_LABELS
연결 에러 타입에 대한 한국어 라벨

```typescript
import { ERROR_TYPE_LABELS, getErrorTypeLabel } from '@/lib/constants/labels';

// 직접 접근
ERROR_TYPE_LABELS['AUTH_FAILED']  // "인증 실패"
ERROR_TYPE_LABELS['NETWORK_ERROR'] // "네트워크 오류"

// 헬퍼 함수 사용 (없는 키에 대해 기본값 반환)
getErrorTypeLabel('AUTH_FAILED')   // "인증 실패"
getErrorTypeLabel('UNKNOWN_KEY')   // "알 수 없는 오류"
```

#### PROCESS_STATUS_LABELS
프로세스 상태에 대한 한국어 라벨

```typescript
import { ProcessStatus } from '@/lib/types';
import { PROCESS_STATUS_LABELS, getProcessStatusLabel } from '@/lib/constants/labels';

// 직접 접근
PROCESS_STATUS_LABELS[ProcessStatus.WAITING_APPROVAL]  // "승인 대기"

// 헬퍼 함수 사용
getProcessStatusLabel(ProcessStatus.INSTALLING)  // "설치 진행 중"
```

#### CONNECTION_STATUS_CONFIG
연결 상태에 대한 스타일 설정

```typescript
import { CONNECTION_STATUS_CONFIG } from '@/lib/constants/labels';

const config = CONNECTION_STATUS_CONFIG['CONNECTED'];
// { label: '연결됨', className: 'text-green-500', icon: '●' }

// 사용 예
<span className={config.className}>{config.icon} {config.label}</span>
```

#### REGION_LABELS
AWS 리전 코드에 대한 한국어 라벨

```typescript
import { REGION_LABELS, getRegionLabel } from '@/lib/constants/labels';

// 직접 접근
REGION_LABELS['ap-northeast-2']  // "서울 (ap-northeast-2)"

// 헬퍼 함수 사용 (없는 키에 대해 원본 반환)
getRegionLabel('ap-northeast-2')  // "서울 (ap-northeast-2)"
getRegionLabel('unknown-region')  // "unknown-region"
```

---

## 변경된 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `ConnectionDetailModal.tsx` | `formatDateTimeSeconds`, `ERROR_TYPE_LABELS` import |
| `ConnectionHistoryTab.tsx` | `formatDateTime` import |
| `ProjectInfoCard.tsx` | `formatDateOnly` import |
| `CredentialListTab.tsx` | `formatDateOnly` import |
| `TestConnectionTab.tsx` | `ERROR_TYPE_LABELS`, `filterCredentialsByType` import |
| `ResourceTable.tsx` | `REGION_LABELS`, `CONNECTION_STATUS_CONFIG`, `filterCredentialsByType` import |

---

## 제거된 중복 코드

1. **날짜 포맷 함수**: 5개 → 1개 (lib/utils/date.ts)
2. **ERROR_TYPE_LABELS**: 2개 → 1개 (lib/constants/labels.ts)
3. **REGION_LABELS**: 1개 → lib/constants/labels.ts로 이동
4. **CONNECTION_STATUS_CONFIG**: 1개 → lib/constants/labels.ts로 이동
5. **getCredentialsForType 로직**: 3개 → filterCredentialsByType 사용
