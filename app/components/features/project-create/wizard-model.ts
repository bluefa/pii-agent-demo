import { getCredentialErrors } from '@/app/components/features/project-create/credential-fields';
import type { CreationCandidatesInput } from '@/app/lib/api';
import { OTHERS_DB_TYPE, type DbType } from '@/lib/constants/db-types';
import {
  PROVIDER_CHIP_BY_KEY,
  hasChinaRegion,
  type ProviderChipKey,
} from '@/lib/constants/provider-mapping';
import { COPY } from '@/lib/copy';
import { DEFAULT_LOCALE } from '@/lib/locale';

export type WizardStep = 1 | 2 | 3 | 4 | 5;

/** The wizard dictionary, so the step list can take it as a parameter. */
type WizardCopy = (typeof COPY)['ko']['wizard'];

/** The `step` values are identity, not copy — only the two labels come from `t`. */
export const wizardSteps = (
  t: WizardCopy,
): Array<{ step: WizardStep; title: string; sublabel: string }> => [
  { step: 1, title: t.step1Title, sublabel: t.step1Sub },
  { step: 2, title: t.step2Title, sublabel: t.step2Sub },
  { step: 3, title: t.step3Title, sublabel: t.step3Sub },
  { step: 4, title: t.step4Title, sublabel: t.step4Sub },
  { step: 5, title: t.step5Title, sublabel: t.step5Sub },
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
    // Common required field. Only the providers that have a China partition can send
    // true. GCP has no China region at all, so a China pick left over from an earlier
    // AWS/Azure selection must not leak onto its wire.
    isChinaRegion: hasChinaRegion(providerKey) && state.region === 'china',
    dbTypes: [...state.dbTypes, ...(state.othersDb ? [OTHERS_DB_TYPE] : [])],
    ...(providerKey === 'aws'
      ? {
          // 계약의 계정 칸(`aws_account_id`)은 리소스가 실제로 있는 linked 계정이 채운다.
          // payer 는 결제 루트일 뿐이라 계약의 계정 칸에 실리지 않는다 — 폼은 여전히
          // 묻지만 와이어로는 나가지 않는다.
          awsAccountId: field('linkedAccount'),
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
 * May 다음 leave this step? Steps 4 and 5 are gated by the candidate/registration
 * state instead — nothing on the form can be wrong there.
 */
export const isStepComplete = (step: WizardStep, state: WizardFormState): boolean => {
  switch (step) {
    case 1:
      // A provider is always selected and the region defaults to Global.
      return true;
    case 2:
      // Only the COUNT of errors gates the step, never their text, so this reads a
      // fixed dictionary instead of taking the reader's language as an argument. A
      // form that could advance in one language and not in the other would be a bug.
      return (
        Object.keys(
          getCredentialErrors(COPY[DEFAULT_LOCALE].wizard, state.providerKey, state.fields),
        ).length === 0
      );
    case 3:
      return state.dbTypes.length > 0 || state.othersDb;
    case 4:
    case 5:
      return true;
  }
};
