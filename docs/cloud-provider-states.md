# Cloud Provider별 상태 정보 정리

> 이 문서는 각 Cloud Provider별로 Project Detail에서 표현해야 할 상태 정보를 정리합니다.

---

# 상황별 프로세스 정의

## AWS

### Case 1: TF 권한 O + DB Only

```
[사전 조치]
├─ 스캔 Role 등록
├─ TF 권한 부여 ✓
└─ DB Credential 등록

[프로세스]
1. 스캔 → 리소스 확정 (DB)
2. 승인 대기
3. 설치 (Service TF + BDC TF) ← 자동
4. Test Connection
5. 연결 완료
```

### Case 2: TF 권한 O + DB + VM

```
[사전 조치]
├─ 스캔 Role 등록
├─ TF 권한 부여 ✓
├─ DB Credential 등록
└─ VM 연동 선택 ✓

[프로세스]
1. 스캔 → 리소스 확정 (DB + VM)
2. 승인 대기
3. 설치 (Service TF + BDC TF) ← 자동
4. Test Connection
5. 연결 완료
```

### Case 3: TF 권한 X + DB Only

```
[사전 조치]
├─ 스캔 Role 등록
├─ TF 권한 없음 ✗
└─ DB Credential 등록

[프로세스]
1. 스캔 → 리소스 확정 (DB)
2. 승인 대기
3. TF Script 다운로드 → 담당자와 설치 일정 조율 ⚠️
4. Test Connection
5. 연결 완료
```

### Case 4: TF 권한 X + DB + VM

```
[사전 조치]
├─ 스캔 Role 등록
├─ TF 권한 없음 ✗
├─ DB Credential 등록
└─ VM 연동 선택 ✓

[프로세스]
1. 스캔 → 리소스 확정 (DB + VM)
2. 승인 대기
3. TF Script 다운로드 → 담당자와 설치 일정 조율 ⚠️
4. Test Connection
5. 연결 완료
```

**TF 권한 없음 시 UI:**
- "TF Script를 다운로드 받아서 담당자와 함께 설치 일정을 조율하세요" 메시지 표시
- TF Script 다운로드 버튼 제공

---

## Azure

### Case 1: DB Only (VM 미포함)

```
[사전 조치]
├─ Scan App 등록
└─ DB Credential 등록

[프로세스]
1. 스캔 → 리소스 확정
2. 승인 대기
3. 설치 (TF 설치 → Private Endpoint 승인 요청)
4. Test Connection
5. 연결 완료
```

### Case 2: DB + VM (VM 포함)

```
[사전 조치]
├─ Scan App 등록
├─ DB Credential 등록
├─ VM 연동 선택 ✓
└─ Subnet 확인 (없으면 생성 필수)

[프로세스]
1. 스캔 → 리소스 확정 (DB + VM)
2. 승인 대기
3. 설치
   ├─ DB: TF 설치 (자동) → Private Endpoint 승인 요청
   └─ VM: TF Script 다운로드 → 서비스 담당자가 직접 실행 ⚠️
4. Test Connection
5. 연결 완료
```

**VM 설치 상세:**
| 단계 | 주체 | 설명 |
|------|------|------|
| TF Script 다운로드 | 시스템 | 스크립트 제공 |
| TF Script 실행 | 서비스 담당자 | 직접 실행 필요 |
| Subnet 생성 | 서비스 담당자 | 없으면 가이드 제공 |

**Subnet 요구사항:**
- 특수 목적의 Subnet 필요
- 기존에 있으면 재사용 가능
- **없으면 가이드 제공** (Azure는 권한 없음 → 서비스 담당자가 직접 생성)

---

## GCP

### Case 1: 기본 (Subnet 불필요)

```
[사전 조치]
├─ 프로젝트 스캔 권한 등록
├─ Host Project 스캔 권한 (Cloud SQL 사용 시)
└─ DB Credential 등록

[프로세스]
1. 스캔 → 리소스 확정
2. 승인 대기
3. 설치 (TF 설치)
4. Test Connection
5. 연결 완료
```

### Case 2: Subnet 생성 필요

```
[사전 조치]
├─ 프로젝트 스캔 권한 등록
├─ Host Project 스캔 권한 (Cloud SQL 사용 시)
├─ DB Credential 등록
└─ Subnet 생성 선택 ✓

[프로세스]
1. 스캔 → 리소스 확정
2. 승인 대기
3. 설치
   ├─ Subnet 생성 (VPC/Region 선택, REGIONAL_MANAGED_SUBNET)
   └─ TF 설치
4. Test Connection
5. 연결 완료
```

> GCP는 VM 연동 미지원

**GCP vs Azure Subnet 차이:**
| | GCP | Azure |
|---|---|---|
| **권한** | 있음 | 없음 |
| **생성 방식** | 시스템이 직접 생성 | 가이드 제공 → 서비스 담당자가 생성 |

---

## IDC

### Case 1: 기본

```
[사전 조치]
├─ DB Credential 등록
└─ 방화벽 오픈 준비

[프로세스]
1. 리소스 직접 입력 (IP/Port/DatabaseType)
   └─ Oracle인 경우 ServiceId 추가
2. 방화벽 오픈 확인 + BDC TF 설치
3. Test Connection
4. 연결 완료
```

> 승인 단계 없음, 스캔 없음

**방화벽 TBD:**
- IP 타입에 따라 source IP 달라짐
- 분기 로직 추후 정의 필요

---

## SDU

### Case 1: 기본

```
[사전 조치]
├─ 방화벽 결제 (S3 업로드용)
└─ 데이터 업로드 (BDC에서 확인)

[프로세스]
1. Crawler 설정 (BDC측에서 동작)
2. Athena Table 목록 확인
3. Test Connection
4. 연결 완료
```

> 승인 단계 없음, 스캔 없음 (Crawler가 Athena Table 목록화)

---

## 수동조사

> 🚧 서비스 준비중입니다.

---

# 프로세스 비교표

| Provider | 사전조치 | 리소스발견 | 승인 | 설치 특이사항 | VM |
|----------|---------|-----------|------|--------------|-----|
| **AWS** | Role, TF권한, Cred | 스캔 | O | TF권한O:자동 / TF권한X:수동 | 지원 |
| **Azure** | App, Cred | 스캔 | O | TF+Private Endpoint | 지원 (수동 TF) |
| **Azure+VM** | App, Cred, Subnet | 스캔 | O | DB자동 + VM수동 | Subnet 필수 |
| **GCP** | 프로젝트권한, Cred | 스캔 | O | TF (+Subnet 옵션) | 미지원 |
| **IDC** | Cred, 방화벽 | 직접입력 | X | BDC TF + 방화벽 | - |
| **SDU** | 방화벽결제, 업로드 | Crawler | X | Crawler 설정 | - |

---

# 전체 프로세스 플로우 (케이스별)

| Provider | 케이스 | 프로세스 단계 |
|----------|--------|--------------|
| **AWS** | TF권한O + DB Only | 스캔 → 리소스 확정 → 승인 대기 → 설치(자동) → Test Connection → 완료 |
| **AWS** | TF권한O + DB+VM | 스캔 → 리소스 확정 → 승인 대기 → 설치(자동) → Test Connection → 완료 |
| **AWS** | TF권한X + DB Only | 스캔 → 리소스 확정 → 승인 대기 → TF Script(수동) → Test Connection → 완료 |
| **AWS** | TF권한X + DB+VM | 스캔 → 리소스 확정 → 승인 대기 → TF Script(수동) → Test Connection → 완료 |
| **Azure** | DB Only | 스캔 → 리소스 확정 → 승인 대기 → 설치(TF) → PE승인대기 → Test Connection → 완료 |
| **Azure** | DB + VM | 스캔 → 리소스 확정 → 승인 대기 → 설치(DB:TF+PE / VM:수동TF) → Test Connection → 완료 |
| **GCP** | 기본 | 스캔 → 리소스 확정 → 승인 대기 → 설치(TF) → Test Connection → 완료 |
| **GCP** | Subnet 필요 | 스캔 → 리소스 확정 → 승인 대기 → Subnet생성 → 설치(TF) → Test Connection → 완료 |
| **IDC** | 기본 | 리소스 직접입력 → 방화벽+BDC TF → Test Connection → 완료 |
| **SDU** | 기본 | Crawler 설정 → Athena 확인 → Test Connection → 완료 |
| **수동조사** | - | 🚧 미구현 |

---

# UX 처리 규칙

## 스캔 오류 처리 (AWS/Azure/GCP 공통)

| 상황 | 에러 메시지 |
|------|------------|
| 스캔 결과 DB 없음 | "스캔 권한 확인 필요" |
| 권한 부족 Exception | "스캔 권한 확인 필요" |

> 권한 문제인지, 실제로 리소스가 없는지 구분 어려움 → 일단 권한 확인 유도

---

## VM 연동 설정 불일치 처리

> VM 연동을 선택했는데 리소스 확정 단계에서 VM이 없는 경우

```
┌─────────────────────────────────────┐
│  VM 연동 설정 변경                    │
├─────────────────────────────────────┤
│  VM 연동을 선택하셨으나               │
│  스캔된 VM 리소스가 없습니다.          │
│                                     │
│  VM 연동 설정을 해제하시겠습니까?      │
│                                     │
│     [취소]  [설정 변경]               │
└─────────────────────────────────────┘
```

- 팝업으로 안내
- 설정 변경 시 VM 연동 해제

---

# History 요구사항 (정리 필요)

> 전체 프로세스 진행 History를 가시적으로 표시

## 기록해야 할 항목

### 1. 승인/반려 History
| 항목 | 설명 |
|------|------|
| 승인/반려 여부 | APPROVED / REJECTED |
| 처리자 | 관리자 ID |
| 처리 일시 | timestamp |
| 반려 사유 | **필수 입력** (3000자 이하) |

### 2. 리소스 변경 History
| 항목 | 설명 |
|------|------|
| 변경 유형 | 추가 / 제외 / 재포함 |
| 리소스 ID | 대상 리소스 |
| 변경자 | 사용자 ID |
| 변경 일시 | timestamp |
| 제외 사유 | **필수 입력** (3000자 이하) - 제외 시 |

### 3. 리소스별 상태
| 항목 | 설명 |
|------|------|
| 연동 상태 | 포함 / 제외 |
| 제외 일시 | 연동 제외한 시점 |
| 제외 사유 | **필수 입력** (3000자 이하) |

### 조회 권한
- 관리자: 전체 조회 가능
- 서비스 담당자: 전체 조회 가능

---

## 신규 리소스 방치 현황 (AWS/Azure/GCP)

> 스캔된 신규 리소스가 얼마나 방치되고 있는지 추적

### 표시 방식
- 경고 기준 없음 (단순 "신규 발견 리소스 있음" 표시)
- 상세 기간 추적 불필요

### 대상 Provider
- [x] AWS
- [x] Azure
- [x] GCP
- [ ] IDC (스캔 없음)
- [ ] SDU (스캔 없음)

---

# 프로세스 재시작 상황

> 연동 완료 후에도 프로세스를 다시 시작해야 하는 케이스

## 재시작 트리거

| 상황 | 설명 | 대상 Provider |
|------|------|--------------|
| 신규 리소스 발견 | 스캔 시 새로운 리소스 감지 | AWS, Azure, GCP |
| 연동 리소스 삭제 | 기존 연동된 리소스가 클라우드에서 삭제됨 | AWS, Azure, GCP |
| 네트워크 연결 이슈 | 원인 불명의 연결 실패 | 전체 |

---

# 연결 끊김 케이스

> Test Connection 실패 또는 연동 후 연결 상태 변경

## 원인 유형

| 유형 | 설명 |
|------|------|
| Credential 권한 만료 | DB Credential에 등록된 사용자 권한 만료 |
| 인증 실패 | 비밀번호 변경, 계정 잠김 등 |
| 네트워크 이슈 | 방화벽 차단, VPC 설정 변경 등 |
| 리소스 삭제 | 대상 DB/VM이 삭제됨 |
| 설정 변경 | Endpoint 변경, Port 변경 등 |

## 상태 표시

- 연결 끊김 시 해당 리소스 상태를 `DISCONNECTED`로 변경
- 원인 파악이 어려운 경우가 많음 → 일반적인 "연결 끊김" 표시

---

## UI 표시 방식 (TBD)

> 어떻게 가시적으로 보여줄지 미정

**가능한 옵션:**
1. 타임라인 형태 (세로 스크롤)
2. 테이블 형태 (필터/정렬)
3. 접이식 섹션 (최근 N개만 표시)
4. 별도 모달/페이지

**표시할 정보:**
- [ ] 프로세스 단계 변경
- [x] 승인/반려 내역
- [x] 리소스 변경 내역 (추가/제외)
- [ ] 설정 변경 내역 (VM 연동 등)
- [ ] 스캔 실행 내역

---

# 확정된 규칙

## Private Endpoint 승인 (Azure)
- **승인 주체**: 서비스 담당자가 직접
- **상태 표시**: 리소스별로 승인 대기/완료 표시

## Terraform 설치 상태
- 단순화: **완료 / 미완료** 두 가지만 표시
- 실패 상세 원인은 표시하지 않음

## Azure VM TF 수동 설치 확인
- 주기적으로 API 호출하여 설치 여부 확인
- API는 존재함 (시스템이 자동 확인)

## DB Credential 상태
- **서비스 단위**로 항상 표시 (상태처럼 계속 노출)
- 체크 조건: 1개 이상 등록 여부
- 미등록 시 Warning 표시

## 스캔 주기 (AWS/Azure/GCP)
- **트리거**: 페이지 진입 시 자동 스캔
- **중복 방지**: 최근 스캔이 5분 이내면 스킵
- 스캔 이력은 저장됨
- 스캔 API 명세는 추후 전달 예정

## 승인 후 리소스 변경
- **가능** (현재도 가능)
- 재승인 필요 없음

## IDC 방화벽 source IP
- **Source IP 추천 API** 별도 존재한다고 가정
- IP 타입에 따라 API가 적절한 source IP 반환

## 프로세스 취소/롤백
- **직접 취소 불가**
- 연동 대상 수정을 통해서만 일부 프로세스 과정 취소 가능

---

# 미정 사항 (TBD)

1. **사전 조치 vs 설정 상태**
   - 프로세스 시작 전 필수? vs 언제든 수정 가능한 체크리스트?
   - 구현해보면서 결정

2. **History UI 형태**
   - 타임라인 vs 테이블 vs 접이식
   - 어디까지 기록할지 범위 결정

3. **GCP Host Project 권한 오류**
   - Cloud SQL 사용 시 Host Project 권한 필요
   - 권한 없으면 스캔 API에서 에러 발생
   - 스캔 API 논의 시 함께 정의

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-01-27 | 초안 작성 (AWS 기준), IDC 제거 |
