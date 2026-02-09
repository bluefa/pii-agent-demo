import type { CloudProvider } from '@/lib/types';
import type { PrerequisiteGuide, ProviderProcessGuide } from '@/lib/types/process-guide';

/** 공통 사전 조치 가이드 */
const SCAN_ROLE_GUIDE: PrerequisiteGuide = {
  label: '스캔 Role 등록',
  summary: 'AWS IAM Role을 생성하고, PII Agent가 리소스를 스캔할 수 있도록 권한을 부여합니다',
  steps: [
    'AWS Console > IAM > Roles > [Create role] 클릭',
    'Trusted entity type: "AWS account" 선택',
    'Account ID에 PII Agent 서비스 계정 ID 입력 (관리자 문의)',
    'Policy 연결: AmazonRDSReadOnlyAccess, AmazonS3ReadOnlyAccess, AmazonEC2ReadOnlyAccess (VM 스캔 시)',
    'Role name 입력 (예: PIIAgentScanRole)',
    'Role 생성 완료 후 Role ARN 복사',
    'PII Agent > 프로젝트 설정 > 스캔 Role ARN 입력란에 붙여넣기',
    '[Role 검증] 버튼 클릭하여 연결 확인',
  ],
  warnings: [
    'ReadOnlyAccess 이상의 권한은 부여하지 마세요. 스캔에는 읽기 권한만 필요합니다',
    'Cross-account 신뢰 설정 시 External ID 조건을 추가하면 보안이 강화됩니다',
  ],
  notes: [
    'VM(EC2) 스캔이 불필요하면 AmazonEC2ReadOnlyAccess는 생략 가능합니다',
    'Role 검증에 실패하면 Trust Policy의 Account ID를 확인하세요',
  ],
};

const DB_CREDENTIAL_GUIDE: PrerequisiteGuide = {
  label: 'DB Credential 등록',
  summary: '연동 대상 데이터베이스의 접속 정보를 등록합니다',
  steps: [
    'PII Agent > 좌측 메뉴 > [DB Credential 관리] 클릭',
    '[Credential 추가] 버튼 클릭',
    'DB 유형 선택 (RDS MySQL / RDS PostgreSQL / Aurora 등)',
    'Host 입력 (예: mydb.abc123.ap-northeast-2.rds.amazonaws.com)',
    'Port 입력 (MySQL: 3306, PostgreSQL: 5432)',
    'Database, Username, Password 입력',
    '[연결 테스트] 버튼으로 접속 확인',
    '테스트 성공 시 [저장] 클릭',
  ],
  warnings: [
    'DB 계정에는 읽기(SELECT) 권한만 부여하세요. 쓰기 권한은 불필요합니다',
    '보안 그룹(Security Group)에서 PII Agent 서비스 IP 대역이 허용되어 있어야 합니다',
    'Credential은 암호화되어 저장되며, 비밀번호는 등록 후 조회할 수 없습니다',
  ],
  notes: [
    '연동 대상 DB가 여러 개인 경우, 각각 별도로 등록해야 합니다',
    'RDS Proxy를 사용하는 경우, Proxy 엔드포인트를 Host에 입력하세요',
  ],
};

const TF_EXECUTION_ROLE_GUIDE: PrerequisiteGuide = {
  label: 'TerraformExecutionRole 등록',
  summary: '자동 설치에 필요한 Terraform 실행 Role을 AWS 계정에 생성합니다',
  steps: [
    'AWS Console > IAM > Roles > [Create role] 클릭',
    'Trusted entity type: "AWS account" 선택',
    'Account ID에 PII Agent 서비스 계정 ID 입력',
    'Policy 연결: AmazonEC2FullAccess, AmazonRDSFullAccess, AmazonS3FullAccess, IAMFullAccess, AmazonVPCFullAccess',
    'Role name: "TerraformExecutionRole" (정확히 이 이름 사용)',
    'Role 생성 완료 후 Role ARN 복사',
    'PII Agent > 프로젝트 설정 > TerraformExecutionRole ARN 입력란에 붙여넣기',
    '[Role 검증] 버튼 클릭하여 연결 확인',
  ],
  warnings: [
    'Role 이름이 정확히 "TerraformExecutionRole"이어야 합니다. 다른 이름은 인식되지 않습니다',
    '이 Role은 FullAccess 권한을 포함하므로, 사용 후 비활성화 또는 삭제를 권장합니다',
    'Role 미등록 시 설치(Step 3)에서 자동 실행이 차단됩니다',
  ],
  notes: [
    '조직 보안 정책상 FullAccess가 불가한 경우, 관리자에게 최소 권한 목록을 문의하세요',
    '수동 설치 모드에서는 이 Role이 필요하지 않습니다',
  ],
};

/**
 * AWS 자동 설치 프로세스 가이드
 */
export const AWS_AUTO_GUIDE: ProviderProcessGuide = {
  provider: 'AWS',
  variant: 'auto',
  title: 'AWS 자동 설치',
  steps: [
    {
      stepNumber: 1,
      label: '연동 대상 확정',
      description: 'AWS 계정에 등록된 RDS, S3 등의 리소스를 스캔하고, PII Agent를 연동할 대상을 선택하여 확정합니다.',
      prerequisiteGuides: [SCAN_ROLE_GUIDE, TF_EXECUTION_ROLE_GUIDE, DB_CREDENTIAL_GUIDE],
      procedures: [
        '[리소스 스캔] 버튼을 클릭하여 AWS 계정의 리소스(RDS, S3 등)를 조회',
        '스캔 결과 목록에서 PII Agent를 연동할 리소스를 선택',
        'EC2(VM) 인스턴스를 포함하려면 상단 필터에서 VM 포함 옵션을 선택',
        '선택 완료 후 [연동 대상 확정] 버튼 클릭',
      ],
      warnings: [
        '리소스가 조회되지 않으면 AWS Console > IAM에서 스캔 Role의 권한(rds:Describe*, s3:List* 등)을 확인하세요',
        '최소 1개 이상의 리소스를 선택해야 확정이 가능합니다',
      ],
      notes: [
        '전체 리소스를 선택하고 제외된 리소스가 없으면 관리자 승인 없이 자동 확정됩니다',
        '확정 후에는 선택한 리소스를 변경할 수 없으므로 신중하게 선택해주세요',
      ],
    },
    {
      stepNumber: 2,
      label: '승인 대기',
      description: '관리자의 승인을 기다리는 중입니다.',
      procedures: [
        '서비스 담당자: 관리자 승인 대기',
        '관리자: 승인 또는 반려 처리',
      ],
      notes: [
        '전체 리소스 선택 + 미선택 리소스가 모두 제외 확정 → 자동 승인',
        '반려 시 History 탭에서 반려 사유 확인 가능',
      ],
    },
    {
      stepNumber: 3,
      label: '설치 진행 (자동)',
      description: '시스템이 자동으로 Terraform을 실행하여 PII Agent를 설치합니다.',
      procedures: [
        'Service TF 설치 (서비스 인프라)',
        'BDC TF 설치 (BDC 에이전트)',
      ],
      warnings: [
        'TerraformExecutionRole이 등록되어 있어야 설치가 진행됩니다',
        'Role 미등록 시 [Role 등록 가이드]에서 등록 방법을 확인하세요',
        '설치에 최대 10분이 소요될 수 있습니다',
      ],
    },
    {
      stepNumber: 4,
      label: '연결 테스트',
      description: '설치가 완료되었습니다. DB 연결을 테스트하세요.',
      procedures: [
        '[Test Connection] 버튼 클릭',
        '연결 결과 확인 (성공/실패)',
        '실패 시 Credential 확인 또는 네트워크 점검',
      ],
      warnings: ['DB Credential이 미설정된 리소스는 테스트 전 설정이 필요합니다'],
    },
    {
      stepNumber: 5,
      label: '연결 확인',
      description: 'PII Agent 연결이 확인되었습니다. 관리자의 최종 확정을 기다리는 중입니다.',
      notes: [
        '관리자가 최종 확정하면 연동이 완료됩니다',
        '이 단계에서도 재테스트가 가능합니다',
      ],
    },
    {
      stepNumber: 6,
      label: '완료',
      description: 'PII Agent 연동이 완료되었습니다.',
      notes: [
        '언제든 재테스트 가능',
        '신규 리소스 발견 시 프로세스가 재시작됩니다',
      ],
    },
  ],
};

/**
 * AWS 수동 설치 프로세스 가이드
 */
export const AWS_MANUAL_GUIDE: ProviderProcessGuide = {
  provider: 'AWS',
  variant: 'manual',
  title: 'AWS 수동 설치',
  steps: [
    {
      stepNumber: 1,
      label: '연동 대상 확정',
      description: 'AWS 계정에 등록된 RDS, S3 등의 리소스를 스캔하고, PII Agent를 연동할 대상을 선택하여 확정합니다.',
      prerequisiteGuides: [SCAN_ROLE_GUIDE, DB_CREDENTIAL_GUIDE],
      procedures: [
        '[리소스 스캔] 버튼을 클릭하여 AWS 계정의 리소스(RDS, S3 등)를 조회',
        '스캔 결과 목록에서 PII Agent를 연동할 리소스를 선택',
        'EC2(VM) 인스턴스를 포함하려면 상단 필터에서 VM 포함 옵션을 선택',
        '선택 완료 후 [연동 대상 확정] 버튼 클릭',
      ],
      warnings: [
        '리소스가 조회되지 않으면 AWS Console > IAM에서 스캔 Role의 권한(rds:Describe*, s3:List* 등)을 확인하세요',
        '최소 1개 이상의 리소스를 선택해야 확정이 가능합니다',
      ],
      notes: [
        '전체 리소스를 선택하고 제외된 리소스가 없으면 관리자 승인 없이 자동 확정됩니다',
        '확정 후에는 선택한 리소스를 변경할 수 없으므로 신중하게 선택해주세요',
      ],
    },
    {
      stepNumber: 2,
      label: '승인 대기',
      description: '관리자의 승인을 기다리는 중입니다.',
      procedures: [
        '서비스 담당자: 관리자 승인 대기',
        '관리자: 승인 또는 반려 처리',
      ],
      notes: [
        '전체 리소스 선택 + 미선택 리소스가 모두 제외 확정 → 자동 승인',
        '반려 시 History 탭에서 반려 사유 확인 가능',
      ],
    },
    {
      stepNumber: 3,
      label: 'TF Script 수동 설치',
      description: 'TF Script를 다운로드하여 직접 실행합니다.',
      prerequisiteGuides: [
        {
          label: 'Terraform CLI 환경 준비',
          summary: 'TF Script를 실행하기 위한 로컬 환경을 준비합니다',
          steps: [
            'Terraform CLI 설치 확인: terraform version (>= 1.5.0 필요)',
            'AWS CLI 인증 확인: aws sts get-caller-identity',
            '올바른 AWS 계정/Role로 인증되었는지 반드시 확인',
            'PII Agent에서 [TF Script 다운로드] 버튼 클릭',
            '다운로드된 디렉토리로 이동: cd terraform-script/',
            '초기화: terraform init',
            '변경사항 확인: terraform plan (결과를 검토하여 예상치 못한 리소스 변경이 없는지 확인)',
            '적용: terraform apply ("yes" 입력하여 실행 확인)',
          ],
          warnings: [
            '반드시 올바른 AWS 계정으로 인증되었는지 확인하세요. 잘못된 계정에 리소스가 생성될 수 있습니다',
            'terraform apply 전에 plan 결과를 반드시 검토하세요',
            '실행 중 오류 발생 시 terraform destroy로 정리 후 담당자에게 문의하세요',
          ],
          notes: [
            'Terraform 미설치 시: developer.hashicorp.com/terraform/install',
            'AWS CLI 미설치 시: docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html',
            '설치 완료 후 PII Agent가 자동 감지하지 못하면 [설치 확인] 버튼을 클릭하세요',
          ],
        },
      ],
      procedures: [
        '[TF Script 다운로드] 버튼 클릭',
        'Terraform CLI 환경에서 압축 해제',
        'terraform init → plan → apply 실행',
        '설치 완료 후 시스템이 자동 확인 (최대 5분)',
      ],
      warnings: [
        'Terraform >= 1.5.0 버전이 필요합니다',
        'AWS CLI 인증이 완료되어 있어야 합니다 (잘못된 계정 주의)',
        '담당자와 설치 일정을 조율하세요',
      ],
    },
    {
      stepNumber: 4,
      label: '연결 테스트',
      description: '설치가 완료되었습니다. DB 연결을 테스트하세요.',
      procedures: [
        '[Test Connection] 버튼 클릭',
        '연결 결과 확인 (성공/실패)',
        '실패 시 Credential 확인 또는 네트워크 점검',
      ],
      warnings: ['DB Credential이 미설정된 리소스는 테스트 전 설정이 필요합니다'],
    },
    {
      stepNumber: 5,
      label: '연결 확인',
      description: 'PII Agent 연결이 확인되었습니다. 관리자의 최종 확정을 기다리는 중입니다.',
      notes: [
        '관리자가 최종 확정하면 연동이 완료됩니다',
        '이 단계에서도 재테스트가 가능합니다',
      ],
    },
    {
      stepNumber: 6,
      label: '완료',
      description: 'PII Agent 연동이 완료되었습니다.',
      notes: [
        '언제든 재테스트 가능',
        '신규 리소스 발견 시 프로세스가 재시작됩니다',
      ],
    },
  ],
};

/**
 * 특정 Provider와 variant에 해당하는 프로세스 가이드 조회
 */
export const getProcessGuide = (provider: CloudProvider, variant?: string): ProviderProcessGuide | undefined => {
  const guides = [AWS_AUTO_GUIDE, AWS_MANUAL_GUIDE];
  return guides.find(g => g.provider === provider && (!variant || g.variant === variant));
};

/**
 * 특정 Provider의 모든 가이드 variant 조회
 */
export const getProcessGuideVariants = (provider: CloudProvider): ProviderProcessGuide[] => {
  const guides = [AWS_AUTO_GUIDE, AWS_MANUAL_GUIDE];
  return guides.filter(g => g.provider === provider);
};
