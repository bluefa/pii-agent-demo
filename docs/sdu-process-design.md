# SDU 연동 프로세스 설계

> SDU(Structured Data Upload) Provider의 연동 프로세스, 상태 모델, UX 구조를 정의합니다.

---

## 기존 Provider와의 차이점

### 패러다임 비교

| 구분 | AWS/Azure/GCP | IDC | SDU |
|------|--------------|-----|-----|
| 리소스 발견 | 스캔 (자동) | 직접 입력 | Crawler (BDC) |
| 리소스 선택 | 체크박스 선택 | 직접 입력 | 선택 없음 (전체 자동) |
| 승인 | 있음 | 없음 | 없음 |
| 설치 주체 | 시스템/담당자 | BDC | BDC |
| 프로세스 중 변경 | 거의 없음 | 일부 | 빈번 (IAM, SourceIP) |

### SDU 핵심 특성

1. **상시 관리 영역 존재**: IAM USER, SourceIP는 프로세스 단계가 아닌 프로젝트 속성
2. **리소스 선택권 없음**: Crawler 결과 전체 자동 연동
3. **BDC 주도 프로세스**: S3 확인 이후 모든 작업은 BDC측에서 수행
4. **짧은 순차 프로세스**: S3 확인 → 설치 → 테스트 → 완료

---

## 역할별 액션 흐름

```
서비스측                              BDC측
──────                               ──────
                                 0. IAM USER 생성
AK/SK 다운로드 ←──────────────────
SourceIP 등록 ────────────────────→  SourceIP 확인
S3 데이터 업로드
        │
        ▼
   [S3 확인 완료] ·················→ API로 확인
        │
        │                    ──── 여기서부터 완전히 BDC ────
        │
        │                        1. Crawler 설정 + 실행
        │                        2. Athena Table 생성 확인
        │                        3. 연동 확정 (전체, 선택 없음)
        │                        4. BDC측 Athena 설정
        │
        ▼
   [Test Connection]
        │
        ▼
   이후 AWS와 동일
```

**서비스측 관여 지점**: AK/SK 다운로드 + S3 업로드, Test Connection 이후

---

## 프로세스 상태 모델

### SDU 전용 상태머신

기존 6단계 상태머신(WAITING_TARGET_CONFIRMATION → WAITING_APPROVAL → ...)을 재활용하지 않는다.
SDU는 승인/확정 대기 상태가 존재하지 않으므로 전용 상태를 정의한다.

```
S3_UPLOAD_PENDING          S3 업로드 대기
    │
    ▼  (API로 S3 업로드 확인)
S3_UPLOAD_CONFIRMED        S3 업로드 확인 완료
    │
    ▼  (Crawler + Athena 확정 + BDC Athena 설정)
INSTALLING                 환경 구성 중
    │
    ▼  (설치 완료)
WAITING_CONNECTION_TEST    연결 테스트 대기
    │
    ▼  (이후 AWS 동일)
CONNECTION_VERIFIED        연결 확인
    │
    ▼
INSTALLATION_COMPLETE      완료
```

### INSTALLING 내부 서브스텝

INSTALLING 단계는 BDC측에서 순차적으로 수행하는 4개 서브스텝으로 구성된다.

```
INSTALLING
  ├─ crawler:         PENDING → IN_PROGRESS → COMPLETED
  ├─ athenaTable:     PENDING → CREATED (n개)
  ├─ targetConfirmed: false → true          ← BDC 내부 확정 (전체 자동, 선택 없음)
  └─ athenaSetup:     PENDING → IN_PROGRESS → COMPLETED   ← BDC측 Athena 설정
```

### 상태 데이터 구조 (제안)

```typescript
// SDU 전용 ProjectStatus
interface SduProjectStatus {
  s3Upload: {
    status: 'PENDING' | 'CONFIRMED';
    confirmedAt?: string;
  };
  installation: {
    crawler: {
      status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
      lastRunAt?: string;
    };
    athenaTable: {
      status: 'PENDING' | 'CREATED';
      tableCount: number;
      database: string;              // e.g. "sdu_abc"
    };
    targetConfirmed: boolean;
    athenaSetup: {
      status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
    };
  };
  connectionTest: {
    status: 'NOT_TESTED' | 'PASSED' | 'FAILED';
  };
}
```

### Frontend 단계 계산 (ADR-004 패턴)

```typescript
function getSduCurrentStep(status: SduProjectStatus): SduProcessStatus {
  if (status.s3Upload.status !== 'CONFIRMED') return 'S3_UPLOAD_PENDING';
  if (status.installation.athenaSetup.status !== 'COMPLETED') return 'INSTALLING';
  if (status.connectionTest.status !== 'PASSED') return 'WAITING_CONNECTION_TEST';
  return 'INSTALLATION_COMPLETE';
}
```

---

## UX 구조

### 화면 레이아웃

기존 ProjectInfoCard + StepProgressBar 구조를 유지하되, SDU 특성을 반영한다.

```
┌─────────────────────────────────────────────────────────────┐
│ 기본 정보                                                    │
├─────────────────────────────────────────────────────────────┤
│ 서비스코드: SVC-001        과제코드: SDU-2026-001            │
│ Provider: SDU              담당자: user@bdc.com              │
│                                                              │
│ IAM USER: sdu-svc-user-01                        [관리]      │
│   AK/SK 발급: 2026-02-01 (admin@bdc.com) 만료: 2027-02-01   │
│                                                              │
│ SourceIP: 10.0.1.0/24  확인완료                  [관리]      │
│   등록일: 2026-02-01                                         │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ SDU 환경 구성 가이드                              [보기] │ │
│ └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 연동 진행                                                    │
├─────────────────────────────────────────────────────────────┤
│  ●━━━━○━━━━○━━━━○                                           │
│ S3확인  설치  테스트  완료                                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  (현재 단계 콘텐츠 영역)                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 기본 정보 영역 (상시 관리)

IAM USER와 SourceIP는 **프로젝트 속성**으로 기본 정보 영역에 배치한다.
기존 AWS에서 설치 모드(awsInstallationMode)가 기본 정보에 있는 것과 동일한 맥락.

- 프로세스 단계와 무관하게 항상 접근 가능
- [관리] 버튼으로 Modal을 통해 수정

#### IAM USER 관리

| 항목 | 설명 |
|------|------|
| USER명 | BDC가 생성한 IAM USER 이름 |
| AK/SK 발급일 | 최근 발급 일시 |
| AK/SK 발급자 | 발급 수행자 |
| AK/SK 만료일 | 만료 예정일 |

**AK/SK 재발급 규칙**:
- 하나만 발급 가능 — 발급 즉시 기존 AK/SK 삭제
- 재발급 시 확인 Dialog 필수 (파괴적 액션)

```
┌────────────────────────────────────────┐
│ AK/SK 재발급 확인                   ✕  │
├────────────────────────────────────────┤
│ ⚠ 새 AK/SK를 발급하면 기존 키는       │
│   즉시 삭제되며 복구할 수 없습니다.     │
│                                        │
│ 기존 키를 사용 중인 서비스가 있다면     │
│ 연동이 중단될 수 있습니다.              │
│                                        │
│                    [취소]  [재발급]     │
└────────────────────────────────────────┘
```

#### SourceIP 관리

| 항목 | 설명 |
|------|------|
| CIDR | 서비스측이 S3 업로드 시 사용하는 Private IP CIDR 블록 |
| 확인 상태 | 서비스측 등록 → BDC 확인 |

**SourceIP 흐름**:
1. 서비스측이 SourceIP(CIDR) 등록
2. BDC측이 등록된 SourceIP 확인
3. BDC측은 서비스측 방화벽 설정 여부를 알 수 없음 (블랙박스)

```
┌────────────────────────────────────────┐
│ SourceIP 관리                       ✕  │
├────────────────────────────────────────┤
│ 등록된 SourceIP                        │
│ ┌──────────────────────────────────┐   │
│ │ 10.0.1.0/24    등록대기    [확인] │   │
│ │ 10.0.2.0/24    확인완료          │   │
│ └──────────────────────────────────┘   │
│                                        │
│ * 서비스측에서 등록한 SourceIP를        │
│   확인해주세요.                         │
└────────────────────────────────────────┘
```

### 환경 구성 가이드

모든 단계에서 항상 접근 가능한 가이드 Modal.
기본 정보 영역에 [보기] 버튼으로 노출한다.

```
┌──────────────────────────────────────────┐
│ SDU 환경 구성 가이드                  ✕  │
├──────────────────────────────────────────┤
│                                          │
│ 1. BDC에서 IAM USER를 생성합니다.        │
│ 2. AK/SK를 다운로드하세요.               │
│ 3. SourceIP(CIDR)를 등록하세요.          │
│ 4. S3에 데이터를 업로드하세요.            │
│ 5. BDC에서 환경을 구성합니다.            │
│    (Crawler 설정, Athena 설정)            │
│ 6. 환경 구성이 완료되면                   │
│    연결 테스트를 진행하세요.              │
│                                          │
└──────────────────────────────────────────┘
```

### StepProgressBar

4단계 표시 (기존 대비 축소):

```
●━━━━○━━━━○━━━━○
S3확인  설치  테스트  완료
```

| 단계 | 라벨 | 설명 |
|------|------|------|
| 1 | S3 확인 | S3 데이터 업로드 확인 |
| 2 | 설치 | Crawler + Athena Table + 확정 + BDC Athena 설정 |
| 3 | 테스트 | Test Connection (AWS 동일) |
| 4 | 완료 | 연동 완료 |

### 설치 단계 상세 표시 (서비스측 화면)

설치 단계에서 서비스측은 BDC 작업의 진행 상황을 확인한다.

```
┌─────────────────────────────────────────────────────────┐
│ 환경 구성 진행 상황                                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ☑ Crawler 설정 완료                                     │
│  ☑ Athena Table 생성 (sdu_abc / 3개 테이블)              │
│  ◐ BDC측 Athena 설정 진행 중...                          │
│                                                          │
│  BDC에서 환경을 구성하고 있습니다.                        │
│  완료되면 연결 테스트를 진행할 수 있습니다.                │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Athena Table 목록 표시

기존 ResourceTable(체크박스, 리전 그룹)을 재사용하지 않는다.
SDU는 선택 없이 동일 Database의 테이블 목록만 표시한다.

| 컬럼 | 설명 |
|------|------|
| Table명 | `{database}.{tableName}` |
| S3 Location | S3 경로 |

> 리전마다 하나의 Database (e.g. `sdu_abc`), 해당 DB에 테이블이 생성된다.

---

## 전제 조건 (Prerequisites)

IAM USER와 SourceIP는 프로세스 단계가 아니지만, 둘 다 완료되어야 S3 업로드가 가능하다.

| 전제 조건 | 수행 주체 | 필수 여부 | 프로세스 차단 |
|-----------|----------|----------|-------------|
| IAM USER 생성 | BDC | 필수 | S3 업로드 불가 |
| AK/SK 발급 | BDC | 필수 | S3 업로드 불가 |
| SourceIP 등록 | 서비스측 등록 → BDC 확인 | 필수 | S3 업로드 불가 |

> 전제 조건 미충족 시 프로세스를 시스템이 차단하진 않지만, 서비스측에서 실질적으로 S3 업로드가 불가능하다.

---

## 기존 상태머신 매핑 (참고)

기존 `ProjectStatus` 필드 대비 SDU에서의 대응:

| 기존 필드 | SDU 대응 | 비고 |
|-----------|----------|------|
| `scan` | 없음 | 스캔 없음 |
| `targets.confirmed` | `installation.targetConfirmed` | BDC 내부 확정, 서비스측 노출 불필요 |
| `approval` | 없음 | 승인 없음 |
| `installation` | `installation` (서브스텝 확장) | Crawler + Athena + 설정 |
| `connectionTest` | `connectionTest` | 동일 |
| — | `s3Upload` | 신규 |

---

## 프로세스 중 변경 가능 요소

| 변경 가능 요소 | 빈도 | 위치 | 프로세스 영향 |
|---------------|------|------|-------------|
| AK/SK 재발급 | 수시 | 기본 정보 | 기존 키 즉시 삭제, 서비스측 재설정 필요 |
| SourceIP 변경 | 수시 | 기본 정보 | BDC 재확인 필요 |
| S3 데이터 재업로드 | 간혹 | Step 1 | 재확인 필요 |
| Crawler 재실행 | 간혹 | Step 2 | Table 목록 갱신 |

> 변경 가능 요소는 모두 기본 정보 영역에서 관리하여 프로세스 흐름을 방해하지 않는다.

---

## History 기록 대상

| 유형 | 설명 | 기록 정보 |
|------|------|----------|
| `S3_UPLOAD_CONFIRMED` | S3 업로드 확인 | 시스템, 일시 |
| `CRAWLER_COMPLETED` | Crawler 설정 완료 | 수행자, 일시, 테이블 수 |
| `TARGET_CONFIRMED` | 연동 확정 (전체) | 수행자, 일시, 테이블 수 |
| `ATHENA_SETUP_COMPLETED` | BDC Athena 설정 완료 | 수행자, 일시 |
| `AK_SK_ISSUED` | AK/SK 발급 | 발급자, 일시 |
| `SOURCE_IP_REGISTERED` | SourceIP 등록 | 등록자, 일시, CIDR |
| `SOURCE_IP_CONFIRMED` | SourceIP 확인 (BDC) | 확인자, 일시 |

---

## BFF API 요구사항 (TODO)

기존 `docs/api/providers/sdu.md`를 아래 내용으로 확장 필요:

| API | 설명 | 우선순위 |
|-----|------|---------|
| S3 업로드 확인 | S3에 데이터 업로드 여부 조회 | 필수 |
| IAM USER 조회/관리 | IAM USER 정보 + AK/SK 발급 이력 | 필수 |
| SourceIP 등록/확인 | 서비스측 등록 + BDC 확인 플로우 | 필수 |
| Crawler 설정/상태 | 기존 API 유지 | 기존 |
| Athena Table 목록 | 기존 API + S3 Location 추가 | 수정 |
| 설치 상태 | 서브스텝 포함 확장 | 수정 |

---

## 프로세스 비교표 (전체 Provider)

| Provider | 사전조치 | 리소스발견 | 리소스선택 | 승인 | 설치 | VM |
|----------|---------|-----------|-----------|------|------|-----|
| **AWS** | Role, TF권한, Cred | 스캔 | 선택 | O | TF | UI 필터 |
| **Azure** | App, Cred | 스캔 | 선택 | O | TF+PE | 지원 (수동 TF) |
| **GCP** | 프로젝트권한, Cred | 스캔 | 선택 | O | TF (+Subnet) | 미지원 |
| **IDC** | Cred, 방화벽 | 직접입력 | 직접입력 | X | BDC TF | - |
| **SDU** | IAM, SourceIP | Crawler | 없음 (전체) | X | Crawler+Athena설정 | - |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-02-07 | 초안 작성 — 프로세스 상태, UX 구조, 역할별 흐름 정의 |
