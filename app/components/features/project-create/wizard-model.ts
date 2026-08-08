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
  const description = fields.description?.trim();
  return {
    cloudType: PROVIDER_CHIP_BY_KEY[providerKey].cloudType,
    // Common required field. IDC/기타 are not asked for a region, so they are never China.
    isChinaRegion: isCspChip(providerKey) && state.region === 'china',
    dbTypes: [...state.dbTypes, ...(state.othersDb ? [OTHERS_DB_TYPE] : [])],
    ...(providerKey === 'aws'
      ? {
          awsAccountId: fields.payerAccount,
          // AWS only: 자동 delegates Terraform execution, 수동 keeps the script with the admin.
          isTerraformExecutionGranted: state.installMode === 'auto',
        }
      : {}),
    ...(providerKey === 'azure'
      ? { tenantId: fields.tenantId, subscriptionId: fields.subscriptionId }
      : {}),
    ...(providerKey === 'gcp' ? { gcpProjectId: fields.projectId } : {}),
    ...(description ? { description } : {}),
  };
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
