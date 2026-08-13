import { getCredentialErrors } from '@/app/components/features/project-create/credential-fields';
import type { CreationCandidatesInput } from '@/app/lib/api';
import { OTHERS_DB_TYPE, type DbType } from '@/lib/constants/db-types';
import {
  PROVIDER_CHIP_BY_KEY,
  isCspChip,
  type ProviderChipKey,
} from '@/lib/constants/provider-mapping';

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export const WIZARD_STEPS: Array<{ step: WizardStep; title: string; sublabel: string }> = [
  { step: 1, title: '클라우드 계정', sublabel: '운영 환경 선택' },
  { step: 2, title: '계정 정보', sublabel: '연결할 계정 입력' },
  { step: 3, title: '사용하는 Database 확인', sublabel: '운영 중인 DB 선택' },
  { step: 4, title: '등록 내용 확인', sublabel: '연동 구성 확인' },
  { step: 5, title: '등록 결과', sublabel: '완료' },
];

/** Global = 일반 리전, China = 별도 파티션. Drives the required `is_china_region`. */
export type OperatingRegion = 'global' | 'china';

/** auto → grant_service_terraform_execution_permission=true, manual → false. */
export type AwsInstallMode = 'auto' | 'manual';

export interface WizardFormState {
  providerKey: ProviderChipKey;
  region: OperatingRegion;
  installMode: AwsInstallMode;
  fields: Record<string, string>;
  dbTypes: DbType[];
  othersDb: boolean;
}

export const buildCandidatesInput = (state: WizardFormState): CreationCandidatesInput => {
  const { providerKey, fields } = state;
  // Trimmed here because that is what validation judged: `credentialFieldError`
  // trims before it validates, so a pasted " 249f9b54-… " passes the GUID check —
  // sending it untrimmed would put whitespace the user never approved on the wire.
  const field = (name: string) => fields[name]?.trim() ?? '';
  const description = field('description');
  return {
    cloudType: PROVIDER_CHIP_BY_KEY[providerKey].cloudType,
    // Common required field. IDC/기타 are not asked for a region, so they are never China.
    isChinaRegion: isCspChip(providerKey) && state.region === 'china',
    dbTypes: [...state.dbTypes, ...(state.othersDb ? [OTHERS_DB_TYPE] : [])],
    ...(providerKey === 'aws'
      ? {
          awsAccountId: field('payerAccount'),
          // payer 는 결제 루트일 뿐이고 스캔 대상 리소스는 하위 계정에 있다. 폼이 두 칸을
          // 묻는 이상 둘 다 나가야 한다 — 배선 전까지 이 값은 state 에만 남아 있었다.
          awsLinkedAccountId: field('linkedAccount'),
          // AWS only: 자동 delegates Terraform execution, 수동 keeps the script with the admin.
          isTerraformExecutionGranted: state.installMode === 'auto',
        }
      : {}),
    ...(providerKey === 'azure'
      ? { tenantId: field('tenantId'), subscriptionId: field('subscriptionId') }
      : {}),
    ...(providerKey === 'gcp' ? { gcpProjectId: field('projectId') } : {}),
    ...(description ? { description } : {}),
  };
};

/**
 * 36 (createTargetSource) 은 35 가 돌려준 candidate 를 그대로 되던진다. 그런데
 * `aws_linked_account_id` 는 아직 계약에 없는 키라 업스트림이 응답에 실어 줄 이유가
 * 없고, mock 은 `buildCandidateMetadata` 화이트리스트에서 실제로 떨군다. 되던지기 전에
 * 폼이 가진 값을 다시 붙여야 등록 요청까지 linked 계정이 살아서 간다 — 35 에만 실리고
 * 36 에서 payer 만 남는 게 지금 증상이다.
 *
 * BFF 가 이 키를 선언하고 echo 하기 시작하면 이 함수는 같은 값을 덮어쓰는 no-op 이 된다.
 */
export const attachLinkedAccount = <T extends { metadata?: { [k: string]: unknown } | null }>(
  candidate: T,
  state: WizardFormState,
): T => {
  if (state.providerKey !== 'aws') return candidate;
  const linked = state.fields.linkedAccount?.trim();
  if (!linked) return candidate;
  return { ...candidate, metadata: { ...candidate.metadata, aws_linked_account_id: linked } };
};

/**
 * May 다음 leave this step? Steps 4 and 5 are gated by the candidate/registration
 * state instead — nothing on the form can be wrong there.
 */
export const isStepComplete = (step: WizardStep, state: WizardFormState): boolean => {
  switch (step) {
    case 1:
      // A provider is always selected and the region defaults to Global.
      return true;
    case 2:
      return Object.keys(getCredentialErrors(state.providerKey, state.fields)).length === 0;
    case 3:
      return state.dbTypes.length > 0 || state.othersDb;
    case 4:
    case 5:
      return true;
  }
};
