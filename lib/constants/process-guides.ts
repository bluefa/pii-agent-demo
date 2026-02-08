import type { CloudProvider } from '@/lib/types';
import type { ProviderProcessGuide } from '@/lib/types/process-guide';

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
      prerequisites: [
        'AWS Console > IAM > Roles에서 스캔 Role 생성 및 등록 완료',
        'TerraformExecutionRole 등록 완료 (자동 설치 모드에서 필수)',
        '연동 대상 DB의 Credential(접속 정보) 등록 완료',
      ],
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
      prerequisites: [
        'AWS Console > IAM > Roles에서 스캔 Role 생성 및 등록 완료',
        '연동 대상 DB의 Credential(접속 정보) 등록 완료',
      ],
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
