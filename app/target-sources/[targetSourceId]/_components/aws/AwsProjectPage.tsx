'use client';

import { CloudTargetSource } from '@/lib/types';
import { awsRoleArnDisplay } from '@/lib/constants/aws-role';
import {
  type ProjectIdentity,
  type TargetSourceIdentifier,
} from '@/app/target-sources/[targetSourceId]/_components/common';
import { CloudTargetSourceLayout } from '@/app/target-sources/[targetSourceId]/_components/layout/CloudTargetSourceLayout';

interface AwsProjectPageProps {
  project: CloudTargetSource;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

/**
 * A role cell: the role NAME is printed, the full ARN is what gets copied and what the
 * cell's `title` spells out (`awsRoleArnDisplay`, the rule the ops strip already uses —
 * the evidence lives in three places, so the one slot that exists to be READ can be
 * short). 「미등록」 when the target has none: the cell stays, because a cell that
 * disappears makes "there is none" and "not read yet" look the same.
 */
const roleFact = (label: string, arn: string | undefined): TargetSourceIdentifier => ({
  label,
  value: arn ?? null,
  display: arn ? awsRoleArnDisplay(arn) : undefined,
  mono: true,
  emptyText: '미등록',
});

export const AwsProjectPage = ({
  project,
  onProjectUpdate,
}: AwsProjectPageProps) => {
  // metadata.grant_service_terraform_execution_permission → 설치 모드. Always resolved:
  // an account we were told nothing about is one nobody granted, i.e. manual install —
  // blanking the row on an absent key hid the mode (#640).
  const autoInstall = project.isTerraformExecutionGranted;

  const identity: ProjectIdentity = {
    cloudProvider: 'AWS',
    // The four facts the AWS header states, in one grid (오너 2026-08-28). Labels are the
    // literal Korean strings rather than an import of the ops tree's `ROLE_META` — that
    // would cross a layer for two words — but they are kept identical to
    // `ROLE_META.scan.short` / `ROLE_META.execution.short` so both screens name the same
    // role the same way.
    identifiers: [
      { label: '계정', value: project.awsAccountId ?? null, mono: true },
      roleFact('스캔 역할', project.scanPrincipal),
      autoInstall
        ? roleFact('테라폼 역할', project.awsTerraformExecutionRoleArn)
        : {
            // A manual install runs the script directly, so there is no Terraform
            // execution role to register — an absence with a reason, not a gap. The cell
            // renders in BOTH modes for that reason: one that vanished under 수동 설치
            // would read the same as one we simply had not loaded.
            label: '테라폼 역할',
            value: null,
            emptyText: '역할 불필요',
            emptyHint:
              '수동 설치는 제공된 설치 스크립트를 직접 실행하므로, BDC 가 대신 수행할 Terraform 실행 Role 을 등록하지 않아요.',
          },
    ],
    // The header renders it as the InstallModeModal vocabulary (자동/수동 설치) —
    // "TF 실행 권한" was internal jargon, not a user-facing name.
    installMode: autoInstall ? 'auto' : 'manual',
  };

  return (
    <CloudTargetSourceLayout
      project={project}
      identity={identity}
      providerLabel="AWS Infrastructure"
      onProjectUpdate={onProjectUpdate}
    />
  );
};
