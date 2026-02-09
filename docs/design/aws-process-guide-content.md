# AWS 프로세스 가이드 상세 콘텐츠

> 2026-02-08 | feat/process-guide
> 전체 프로세스 가이드 모달에서 AWS 각 단계에 표시할 콘텐츠 정의

## 설치 모드 (프로젝트 생성 시 결정, 변경 불가)

| 모드 | TF Role 필요 | 설치 방식 |
|------|-------------|----------|
| 자동 설치 | O (TerraformExecutionRole) | 시스템 자동 TF 실행 |
| 수동 설치 | X | 담당자 직접 TF Script 실행 |

---

## 자동 설치 모드 (5단계)

### Step 1. 연동 대상 확정

| 항목 | 내용 |
|------|------|
| **설명** | 스캔된 리소스 중 연동할 대상을 선택하고 확정합니다. |
| **사전 조치** | - 스캔 Role 등록<br>- TerraformExecutionRole 등록 (자동 설치 필수)<br>- DB Credential 등록 |
| **수행 절차** | 1. 리소스 스캔 실행<br>2. 리소스 목록에서 연동 대상 선택<br>3. VM(EC2) 포함 여부 UI 필터 선택 (선택사항)<br>4. [연동 대상 확정] 버튼 클릭 |
| **주의사항** | - 리소스 목록이 조회되지 않으면 스캔 권한 확인 필요<br>- 최소 1개 이상 리소스 선택 필수 |
| **참고** | 전체 리소스 선택 시 자동 승인 (제외 확정되지 않은 리소스를 모두 선택한 경우) |

### Step 2. 승인 대기

| 항목 | 내용 |
|------|------|
| **설명** | 관리자의 승인을 기다리는 중입니다. |
| **수행 절차** | - 서비스 담당자: 대기<br>- 관리자: 승인 또는 반려 처리 |
| **참고** | - 전체 리소스 선택 + 미선택 리소스가 모두 제외 확정 상태 → 자동 승인<br>- 반려 시 History 탭에서 반려 사유 확인 가능 |

### Step 3. 설치 진행 (자동)

| 항목 | 내용 |
|------|------|
| **설명** | 시스템이 자동으로 Terraform을 실행하여 PII Agent를 설치합니다. |
| **진행 항목** | - Service TF: 서비스 인프라 설치<br>- BDC TF: BDC 에이전트 설치 |
| **주의사항** | - TerraformExecutionRole이 등록되어 있어야 설치 진행 가능<br>- Role 미등록 시 경고 표시 + [Role 등록 가이드] 제공<br>- 설치 최대 10분 소요 가능 |
| **TF Role 등록 가이드** | 1. AWS Console > IAM > Roles 이동<br>2. Create Role (Trusted entity: AWS account)<br>3. Role name: TerraformExecutionRole<br>4. Policy 연결 (ec2:*, rds:*, s3:*, iam:PassRole)<br>5. [Role 등록 확인] 버튼으로 검증 |

### Step 4. 연결 테스트

| 항목 | 내용 |
|------|------|
| **설명** | 설치가 완료되었습니다. DB 연결을 테스트하세요. |
| **수행 절차** | 1. [Test Connection] 버튼 클릭<br>2. 연결 결과 확인 (성공/실패)<br>3. 실패 시 Credential 확인 또는 네트워크 점검 |
| **주의사항** | - DB Credential이 미설정된 리소스가 있으면 테스트 전 설정 필요<br>- 연결 실패 시 Credential 탭에서 상태 확인 |

### Step 5. 완료

| 항목 | 내용 |
|------|------|
| **설명** | PII Agent 연동이 완료되었습니다. |
| **참고** | - 언제든 재테스트 가능<br>- 신규 리소스 발견 시 프로세스 재시작 가능 |

---

## 수동 설치 모드 (5단계)

### Step 1. 연동 대상 확정

자동 설치와 동일. 단, 사전 조치에서 **TerraformExecutionRole 불필요**.

| 항목 | 내용 |
|------|------|
| **사전 조치** | - 스캔 Role 등록<br>- DB Credential 등록 |

나머지는 자동 설치 Step 1과 동일.

### Step 2. 승인 대기

자동 설치 Step 2와 동일.

### Step 3. TF Script 수동 설치

| 항목 | 내용 |
|------|------|
| **설명** | TF Script를 다운로드하여 직접 실행합니다. |
| **수행 절차** | 1. [TF Script 다운로드] 버튼 클릭<br>2. Terraform CLI 환경에서 압축 해제<br>3. `terraform init` → `terraform plan` → `terraform apply` 실행<br>4. 설치 완료 후 시스템이 자동 확인 (최대 5분) |
| **주의사항** | - Terraform >= 1.5.0 필요<br>- AWS CLI 인증 필수 (잘못된 계정 주의)<br>- 담당자와 설치 일정 조율 필요 |
| **TF Script 설치 가이드** | 1. INSTALLING 단계에서 TF Script 다운로드<br>2. Terraform CLI 환경 준비 (>= 1.5.0)<br>3. `cd terraform-script/ && terraform init && terraform plan && terraform apply`<br>4. apply 완료 후 자동 확인 (최대 5분) |

### Step 4. 연결 테스트

자동 설치 Step 4와 동일.

### Step 5. 완료

자동 설치 Step 5와 동일.

---

## 공통 요소

### 프로세스 전반 경고 (자동 설치 모드)
TF Role 미등록 시 모든 단계에서 경고 표시:
```
⚠️ TerraformExecutionRole이 등록되지 않았습니다.
자동 설치를 진행하려면 Role을 등록하세요.
[Role 등록 가이드]
```

### 연결 테스트 패널 구조
- **DB 연결 History** 탭: 테스트 이력
- **DB Credential 목록** 탭: 등록된 Credential
- **Credential 미설정** 탭: 미설정 리소스 (해당 시에만 표시)

### VM(EC2) 처리
- 프로세스에 영향 없음
- UI 필터로 선택
- 스캔 결과에 EC2가 없어도 문제 없음
