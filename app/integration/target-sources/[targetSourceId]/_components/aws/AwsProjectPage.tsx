'use client';

import { CloudTargetSource } from '@/lib/types';
import {
  DeleteInfrastructureButton,
  ProjectPageMeta,
  type ProjectIdentity,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { CloudTargetSourceLayout } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/CloudTargetSourceLayout';

interface AwsProjectPageProps {
  project: CloudTargetSource;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

export const AwsProjectPage = ({
  project,
  onProjectUpdate,
}: AwsProjectPageProps) => {
  const identity: ProjectIdentity = {
    cloudProvider: 'AWS',
    // detail metadata.is_sdu_type — SDU accounts surface as "SDU", not an Agent.
    monitoringMethod: project.isSduType ? 'SDU' : 'AWS Agent',
    jiraLink: null,
    identifiers: [
      { label: 'Account ID', value: project.awsAccountId ?? null, mono: true },
      // metadata.grant_service_terraform_execution_permission — stays visible so the
      // auto(허용)/manual(미허용) install mode is always readable from the metadata bar.
      {
        label: 'TF 실행 권한',
        value:
          project.isTerraformExecutionGranted === undefined
            ? null
            : project.isTerraformExecutionGranted
              ? '허용 · 자동 설치'
              : '미허용 · 수동 설치',
      },
    ],
  };

  return (
    <CloudTargetSourceLayout
      project={project}
      identity={identity}
      providerLabel="AWS Infrastructure"
      action={<DeleteInfrastructureButton />}
      onProjectUpdate={onProjectUpdate}
    />
  );
};
