# AWS 사전 조치 상세 가이드 콘텐츠

> Issue #47 — 콘텐츠 확정 후 구현 착수

## 1. 타입 확장

현재 `prerequisites?: string[]`를 확장하여 상세 가이드를 지원합니다.

```typescript
interface PrerequisiteGuide {
  label: string;        // "스캔 Role 등록"
  summary: string;      // 한 줄 요약 (접힌 상태에서 표시)
  steps: string[];      // 상세 절차 (번호 매김)
  warnings?: string[];  // 주의사항
  notes?: string[];     // 참고사항
}

// ProcessGuideStep에 추가
interface ProcessGuideStep {
  // ... 기존 필드
  prerequisiteGuides?: PrerequisiteGuide[];  // 상세 가이드 (prerequisites 대체)
}
```

- `prerequisiteGuides`가 있으면 아코디언 UI로 렌더링
- 없으면 기존 `prerequisites` string 리스트 그대로 사용 (하위 호환)

## 2. UI 동작

```
[사전 조치]
 ☐ 스캔 Role 등록 ................... [완료]  ← 접힌 상태: summary 표시
   ▼ 클릭 시 펼침:
   ┌─────────────────────────────────────┐
   │ 1. AWS Console > IAM > Roles 이동   │
   │ 2. [Create role] 클릭              │
   │ 3. ...                             │
   │ ⚠️ 주의: ...                        │
   │ ℹ️ 참고: ...                        │
   └─────────────────────────────────────┘
```

---

## 3. 상세 가이드 콘텐츠

### 3.1 스캔 Role 등록 가이드

**적용 대상**: Step 1 (자동 설치, 수동 설치 공통)

```
label: "스캔 Role 등록"
summary: "AWS IAM Role을 생성하고, PII Agent가 리소스를 스캔할 수 있도록 권한을 부여합니다"

steps:
  1. AWS Console > IAM > Roles > [Create role] 클릭
  2. Trusted entity type: "AWS account" 선택
  3. Account ID에 PII Agent 서비스 계정 ID 입력 (관리자 문의)
  4. 다음 Policy를 연결:
     - AmazonRDSReadOnlyAccess
     - AmazonS3ReadOnlyAccess
     - AmazonEC2ReadOnlyAccess (VM 스캔 시)
  5. Role name: 조직 네이밍 규칙에 맞게 입력 (예: PIIAgentScanRole)
  6. Role 생성 완료 후, Role ARN을 복사
  7. PII Agent > 프로젝트 설정 > 스캔 Role ARN 입력란에 붙여넣기
  8. [Role 검증] 버튼 클릭하여 연결 확인

warnings:
  - ReadOnlyAccess 이상의 권한은 부여하지 마세요. 스캔에는 읽기 권한만 필요합니다
  - Cross-account 신뢰 설정 시 External ID 조건을 추가하면 보안이 강화됩니다

notes:
  - VM(EC2) 스캔이 불필요하면 AmazonEC2ReadOnlyAccess는 생략 가능합니다
  - Role 검증에 실패하면 Trust Policy의 Account ID를 확인하세요
```

### 3.2 TerraformExecutionRole 등록 가이드

**적용 대상**: Step 1 (자동 설치 전용)

```
label: "TerraformExecutionRole 등록"
summary: "자동 설치에 필요한 Terraform 실행 Role을 AWS 계정에 생성합니다"

steps:
  1. AWS Console > IAM > Roles > [Create role] 클릭
  2. Trusted entity type: "AWS account" 선택
  3. Account ID에 PII Agent 서비스 계정 ID 입력
  4. 다음 Policy를 연결 (Terraform이 리소스를 생성/수정하는 데 필요):
     - AmazonEC2FullAccess
     - AmazonRDSFullAccess
     - AmazonS3FullAccess
     - IAMFullAccess (PassRole 포함)
     - AmazonVPCFullAccess
  5. Role name: "TerraformExecutionRole" (정확히 이 이름 사용)
  6. Role 생성 완료 후, Role ARN을 복사
  7. PII Agent > 프로젝트 설정 > TerraformExecutionRole ARN 입력란에 붙여넣기
  8. [Role 검증] 버튼 클릭하여 연결 확인

warnings:
  - Role 이름이 정확히 "TerraformExecutionRole"이어야 합니다. 다른 이름은 인식되지 않습니다
  - 이 Role은 FullAccess 권한을 포함하므로, 사용 후 비활성화 또는 삭제를 권장합니다
  - Role 미등록 시 설치(Step 3)에서 자동 실행이 차단됩니다

notes:
  - 조직 보안 정책상 FullAccess가 불가한 경우, 관리자에게 최소 권한 목록을 문의하세요
  - 수동 설치 모드에서는 이 Role이 필요하지 않습니다
```

### 3.3 DB Credential 등록 가이드

**적용 대상**: Step 1 (자동 설치, 수동 설치 공통)

```
label: "DB Credential 등록"
summary: "연동 대상 데이터베이스의 접속 정보를 등록합니다"

steps:
  1. PII Agent > 좌측 메뉴 > [DB Credential 관리] 클릭
  2. [Credential 추가] 버튼 클릭
  3. 다음 정보를 입력:
     - DB 유형: RDS MySQL / RDS PostgreSQL / Aurora 등
     - Host: DB 엔드포인트 (예: mydb.abc123.ap-northeast-2.rds.amazonaws.com)
     - Port: 기본 포트 (MySQL: 3306, PostgreSQL: 5432)
     - Database: 대상 데이터베이스 이름
     - Username: 읽기 권한이 있는 DB 계정
     - Password: 해당 계정 비밀번호
  4. [연결 테스트] 버튼으로 접속 확인
  5. 테스트 성공 시 [저장] 클릭

warnings:
  - DB 계정에는 읽기(SELECT) 권한만 부여하세요. 쓰기 권한은 불필요합니다
  - 보안 그룹(Security Group)에서 PII Agent 서비스 IP 대역이 허용되어 있어야 합니다
  - Credential은 암호화되어 저장되며, 비밀번호는 등록 후 조회할 수 없습니다

notes:
  - 연동 대상 DB가 여러 개인 경우, 각각 별도로 등록해야 합니다
  - RDS Proxy를 사용하는 경우, Proxy 엔드포인트를 Host에 입력하세요
```

### 3.4 TF Script 다운로드/실행 가이드

**적용 대상**: Step 3 (수동 설치 전용)

> 이 가이드는 Step 3의 procedures를 보강하는 형태로 적용합니다.
> Step 3에 `prerequisiteGuides`를 추가하여 "Terraform CLI 환경 준비" 가이드를 넣습니다.

```
label: "Terraform CLI 환경 준비"
summary: "TF Script를 실행하기 위한 로컬 환경을 준비합니다"

steps:
  1. Terraform CLI 설치 확인: terraform version (>= 1.5.0 필요)
  2. AWS CLI 인증 확인: aws sts get-caller-identity
     - 올바른 AWS 계정/Role로 인증되었는지 반드시 확인
  3. PII Agent에서 [TF Script 다운로드] 버튼 클릭
  4. 다운로드된 디렉토리로 이동: cd terraform-script/
  5. 초기화: terraform init
  6. 변경사항 확인: terraform plan
     - plan 결과를 검토하여 예상치 못한 리소스 변경이 없는지 확인
  7. 적용: terraform apply
     - "yes" 입력하여 실행 확인
  8. 완료 후 PII Agent 화면에서 설치 상태가 자동 갱신됩니다 (최대 5분)

warnings:
  - 반드시 올바른 AWS 계정으로 인증되었는지 확인하세요. 잘못된 계정에 리소스가 생성될 수 있습니다
  - terraform apply 전에 plan 결과를 반드시 검토하세요
  - 실행 중 오류 발생 시 terraform destroy로 정리 후 담당자에게 문의하세요

notes:
  - Terraform이 설치되지 않은 경우: https://developer.hashicorp.com/terraform/install
  - AWS CLI 설치: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
  - 설치 완료 후 PII Agent가 자동 감지하지 못하면 [설치 확인] 버튼을 클릭하세요
```

---

## 4. 적용 매핑

| 가이드 | 적용 위치 | 모드 |
|--------|----------|------|
| 스캔 Role 등록 | Step 1 prerequisiteGuides | 자동+수동 공통 |
| TerraformExecutionRole 등록 | Step 1 prerequisiteGuides | 자동 전용 |
| DB Credential 등록 | Step 1 prerequisiteGuides | 자동+수동 공통 |
| Terraform CLI 환경 준비 | Step 3 prerequisiteGuides | 수동 전용 |

## 5. 구현 범위

### 타입 변경
- `lib/types/process-guide.ts`: `PrerequisiteGuide` 인터페이스 추가, `ProcessGuideStep`에 `prerequisiteGuides` 필드 추가

### 데이터 변경
- `lib/constants/process-guides.ts`: 4개 가이드 데이터 추가 (기존 prerequisites는 유지 — 하위 호환)

### UI 변경
- `ProcessGuideStepCard.tsx`: prerequisiteGuides 렌더링 — 아코디언 확장/축소 UI
  - 접힌 상태: summary + 화살표 아이콘
  - 펼친 상태: steps(번호 리스트) + warnings(amber) + notes(blue)
