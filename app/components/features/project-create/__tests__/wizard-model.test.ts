import { describe, expect, it } from 'vitest';
import {
  buildCandidatesInput,
  isStepComplete,
  type WizardFormState,
} from '@/app/components/features/project-create/wizard-model';
import {
  CREDENTIAL_FIELDS,
  getCredentialErrors,
} from '@/app/components/features/project-create/credential-fields';
import {
  candidateDescriptionLine,
  candidateIdentity,
  candidateInstallModeIsAuto,
  candidateProviderKey,
  candidateTitle,
} from '@/app/components/features/project-create/candidate-display';
import type { TargetSourceCreationCandidateResponse } from '@/app/lib/api';

const candidate = (
  overrides: Partial<TargetSourceCreationCandidateResponse> = {},
): TargetSourceCreationCandidateResponse => ({
  status: 'ADD',
  cloud_type: 'AWS',
  is_sdu_type: false,
  is_china_region: false,
  metadata: {},
  ...overrides,
});

const baseState = (overrides: Partial<WizardFormState> = {}): WizardFormState => ({
  providerKey: 'aws',
  region: 'global',
  installMode: 'auto',
  fields: { payerAccount: '123456789012' },
  dbTypes: ['mysql'],
  othersDb: false,
  ...overrides,
});

describe('buildCandidatesInput — creation-candidates request body (35)', () => {
  it('sends lowercase wire database_types and appends "others" only when toggled', () => {
    const withoutOthers = buildCandidatesInput(baseState({ dbTypes: ['mysql', 'postgresql'] }));
    expect(withoutOthers.dbTypes).toEqual(['mysql', 'postgresql']);

    const withOthers = buildCandidatesInput(
      baseState({ dbTypes: ['mysql', 'postgresql'], othersDb: true }),
    );
    expect(withOthers.dbTypes).toEqual(['mysql', 'postgresql', 'others']);
  });

  it('sends "others" alone when nothing in the listed catalog matched', () => {
    expect(buildCandidatesInput(baseState({ dbTypes: [], othersDb: true })).dbTypes).toEqual([
      'others',
    ]);
  });

  it('maps the 기타 chip to cloud_type "others" (no longer aliased to idc)', () => {
    const input = buildCandidatesInput(
      baseState({ providerKey: 'other', fields: { description: '온프레미스 클러스터' } }),
    );
    expect(input.cloudType).toBe('others');
    expect(input.description).toBe('온프레미스 클러스터');
    // 기타 is never asked for a region.
    expect(input.isChinaRegion).toBe(false);
  });

  it('carries is_china_region for Azure, not just AWS', () => {
    const azureChina = buildCandidatesInput(
      baseState({
        providerKey: 'azure',
        region: 'china',
        fields: { tenantId: 'tenant-1', subscriptionId: 'sub-1' },
      }),
    );
    expect(azureChina.cloudType).toBe('azure');
    expect(azureChina.isChinaRegion).toBe(true);
    expect(azureChina.tenantId).toBe('tenant-1');
    expect(azureChina.subscriptionId).toBe('sub-1');

    const gcpChina = buildCandidatesInput(
      baseState({ providerKey: 'gcp', region: 'china', fields: { projectId: 'proj-1' } }),
    );
    expect(gcpChina.isChinaRegion).toBe(true);
    expect(gcpChina.gcpProjectId).toBe('proj-1');
  });

  it('keeps IDC out of the region question even if a region was picked earlier', () => {
    const idc = buildCandidatesInput(
      baseState({ providerKey: 'idc', region: 'china', fields: { description: '판교 IDC' } }),
    );
    expect(idc.cloudType).toBe('idc');
    expect(idc.isChinaRegion).toBe(false);
  });

  it('maps the AWS install mode onto the terraform-permission flag', () => {
    expect(buildCandidatesInput(baseState({ installMode: 'auto' })).isTerraformExecutionGranted).toBe(
      true,
    );
    expect(
      buildCandidatesInput(baseState({ installMode: 'manual' })).isTerraformExecutionGranted,
    ).toBe(false);
  });

  it('never sends the terraform flag for a non-AWS provider', () => {
    const azure = buildCandidatesInput(
      baseState({
        providerKey: 'azure',
        installMode: 'auto',
        fields: { tenantId: 'tenant-1', subscriptionId: 'sub-1' },
      }),
    );
    expect(azure.isTerraformExecutionGranted).toBeUndefined();
    expect(azure.awsAccountId).toBeUndefined();
  });

  it('omits an empty description rather than sending a blank string', () => {
    expect(
      buildCandidatesInput(baseState({ fields: { payerAccount: '123456789012', description: '  ' } }))
        .description,
    ).toBeUndefined();
  });
});

describe('isStepComplete — step gating', () => {
  it('never blocks step 1: a provider is always selected', () => {
    expect(isStepComplete(1, baseState({ fields: {}, dbTypes: [] }))).toBe(true);
  });

  it('blocks step 2 until every required credential is present and well-formed', () => {
    expect(isStepComplete(2, baseState({ fields: {} }))).toBe(false);
    expect(isStepComplete(2, baseState({ fields: { payerAccount: '12345' } }))).toBe(false);
    // The description is required everywhere — an account id alone no longer passes.
    expect(isStepComplete(2, baseState({ fields: { payerAccount: '123456789012' } }))).toBe(false);
    expect(
      isStepComplete(
        2,
        baseState({
          fields: {
            payerAccount: '123456789012',
            linkedAccount: '210987654321',
            description: '결제 운영계',
          },
        }),
      ),
    ).toBe(true);
  });

  it('requires the AWS linked account, and still validates its format', () => {
    const withoutLinked = baseState({
      fields: { payerAccount: '123456789012', description: '결제 운영계' },
    });
    expect(isStepComplete(2, withoutLinked)).toBe(false);
    expect(getCredentialErrors('aws', withoutLinked.fields).linkedAccount).toBe(
      'Linked Account을(를) 입력해 주세요',
    );

    // Present but malformed is still refused — required did not replace the format check.
    expect(
      isStepComplete(
        2,
        baseState({
          fields: { payerAccount: '123456789012', description: '결제 운영계', linkedAccount: '99' },
        }),
      ),
    ).toBe(false);

    // A single-account org repeats the payer id — the helper tells them to, so it must pass.
    expect(
      isStepComplete(
        2,
        baseState({
          fields: {
            payerAccount: '123456789012',
            linkedAccount: '123456789012',
            description: '결제 운영계',
          },
        }),
      ),
    ).toBe(true);
  });

  it('marks Linked Account as required in the field definition', () => {
    const linked = CREDENTIAL_FIELDS.aws.find((field) => field.name === 'linkedAccount');
    expect(linked?.optional).toBeFalsy();
    // The label renders (선택) off `optional`, so the helper must not promise optional either.
    expect(linked?.helper).not.toContain('선택');
  });

  it('requires a description for IDC and 기타', () => {
    expect(isStepComplete(2, baseState({ providerKey: 'idc', fields: {} }))).toBe(false);
    expect(
      isStepComplete(2, baseState({ providerKey: 'other', fields: { description: '온프레미스' } })),
    ).toBe(true);
  });

  it('blocks step 3 until a database is checked or Others is toggled', () => {
    expect(isStepComplete(3, baseState({ dbTypes: [], othersDb: false }))).toBe(false);
    expect(isStepComplete(3, baseState({ dbTypes: [], othersDb: true }))).toBe(true);
    expect(isStepComplete(3, baseState({ dbTypes: ['oracle'], othersDb: false }))).toBe(true);
  });
});

describe('candidate display mapping', () => {
  it('maps the response cloud_type enum to a chip, with no AWS fallback', () => {
    expect(candidateProviderKey('AWS')).toBe('aws');
    expect(candidateProviderKey('AZURE')).toBe('azure');
    expect(candidateProviderKey('GCP')).toBe('gcp');
    expect(candidateProviderKey('IDC')).toBe('idc');
    // An 기타 registration returns UNKNOWN — it must read as 기타, never as AWS.
    expect(candidateProviderKey('UNKNOWN')).toBe('other');
    expect(candidateProviderKey('OTHERS')).toBe('other');
    expect(candidateProviderKey(null)).toBe('other');
  });

  it('titles an SDU candidate by its upload method, not by its underlying cloud', () => {
    expect(
      candidateTitle({
        status: 'ADD',
        cloud_type: 'AWS',
        is_sdu_type: true,
        is_china_region: true,
        metadata: {},
      }),
    ).toBe('Self Data Upload 계정');
    expect(
      candidateTitle({
        status: 'ADD',
        cloud_type: 'UNKNOWN',
        is_sdu_type: false,
        is_china_region: false,
        metadata: {},
      }),
    ).toBe('기타 계정');
  });
});

describe('candidateIdentity — /services row anatomy, response-derived only', () => {
  it('leads with the provider name and names the id that follows it', () => {
    expect(
      candidateIdentity(candidate({ metadata: { aws_account_id: '123456789012' } })),
    ).toEqual({ name: 'AWS', kind: 'Account', value: '123456789012' });

    expect(
      candidateIdentity(
        candidate({ cloud_type: 'AZURE', metadata: { subscription_id: 'sub-1' } }),
      ),
    ).toEqual({ name: 'Azure', kind: 'Subscription', value: 'sub-1' });
  });

  it('drops GCP onto its own second line, where a long project id has the width', () => {
    expect(
      candidateIdentity(candidate({ cloud_type: 'GCP', metadata: { project_id: 'proj-1' } })),
    ).toEqual({ name: 'GCP', secondKind: 'Project', secondValue: 'proj-1' });
  });

  it('shows the provider name alone when the response carried no id', () => {
    const identity = candidateIdentity(candidate({ metadata: {} }));
    expect(identity.name).toBe('AWS');
    expect(identity.value).toBeUndefined();
  });

  it('uses the description as the gloss for IDC and 기타 — they own no account id', () => {
    expect(
      candidateIdentity(candidate({ cloud_type: 'IDC', metadata: { description: '판교 IDC' } })),
    ).toEqual({ name: 'IDC 인프라', gloss: '판교 IDC' });
    expect(
      candidateIdentity(candidate({ cloud_type: 'UNKNOWN', metadata: { description: '온프레미스' } })),
    ).toEqual({ name: '기타 인프라', gloss: '온프레미스' });
  });

  it('hides the underlying CSP behind the SDU identity', () => {
    expect(
      candidateIdentity(
        candidate({ is_sdu_type: true, metadata: { aws_account_id: '123456789012' } }),
      ),
    ).toEqual({ name: 'SDU', gloss: '서비스 담당자가 데이터를 직접 업로드' });
  });
});

describe('candidateInstallModeIsAuto — response echo, wizard fallback', () => {
  it('trusts the response when it echoes the permission', () => {
    expect(
      candidateInstallModeIsAuto(
        candidate({ grant_service_terraform_execution_permission: true }),
        false,
      ),
    ).toBe(true);
    expect(
      candidateInstallModeIsAuto(
        candidate({ grant_service_terraform_execution_permission: false }),
        true,
      ),
    ).toBe(false);
  });

  it('falls back to what the wizard asked when the key is absent', () => {
    expect(candidateInstallModeIsAuto(candidate(), true)).toBe(true);
    expect(candidateInstallModeIsAuto(candidate(), false)).toBe(false);
  });
});

describe('candidateDescriptionLine', () => {
  it('gives a CSP card its own 설명 layer', () => {
    expect(candidateDescriptionLine(candidate({ metadata: { description: '결제 계정' } }))).toBe(
      '결제 계정',
    );
  });

  it('stays null where the description is already the identity gloss', () => {
    expect(
      candidateDescriptionLine(candidate({ cloud_type: 'IDC', metadata: { description: '판교' } })),
    ).toBeNull();
    expect(
      candidateDescriptionLine(
        candidate({ cloud_type: 'UNKNOWN', metadata: { description: '온프레미스' } }),
      ),
    ).toBeNull();
  });

  it('stays null on an SDU card, which shows no CSP detail at all', () => {
    expect(
      candidateDescriptionLine(
        candidate({ is_sdu_type: true, metadata: { description: '결제 계정' } }),
      ),
    ).toBeNull();
  });
});
