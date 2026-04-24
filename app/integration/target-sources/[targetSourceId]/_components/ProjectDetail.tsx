'use client';

import { useState } from 'react';
import type { SecretKey, TargetSource } from '@/lib/types';
import { ErrorState } from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { AwsProjectPage } from '@/app/integration/target-sources/[targetSourceId]/_components/aws';
import { AzureProjectPage } from '@/app/integration/target-sources/[targetSourceId]/_components/azure';
import { GcpProjectPage } from '@/app/integration/target-sources/[targetSourceId]/_components/gcp';
import { IdcProjectPage } from '@/app/integration/target-sources/[targetSourceId]/_components/idc';
import { SduProjectPage } from '@/app/integration/target-sources/[targetSourceId]/_components/sdu';

interface ProjectDetailProps {
  initialProject: TargetSource;
  initialCredentials: SecretKey[];
}

export const ProjectDetail = ({
  initialProject,
  initialCredentials,
}: ProjectDetailProps) => {
  const [project, setProject] = useState<TargetSource>(initialProject);
  const [credentials] = useState(initialCredentials);

  switch (project.cloudProvider) {
    case 'AWS':
      return <AwsProjectPage project={project} credentials={credentials} onProjectUpdate={setProject} />;
    case 'Azure':
      return <AzureProjectPage project={project} credentials={credentials} onProjectUpdate={setProject} />;
    case 'GCP':
      return <GcpProjectPage project={project} credentials={credentials} onProjectUpdate={setProject} />;
    case 'IDC':
      return <IdcProjectPage project={project} credentials={credentials} onProjectUpdate={setProject} />;
    case 'SDU':
      return <SduProjectPage project={project} credentials={credentials} onProjectUpdate={setProject} />;
    default:
      return <ErrorState error="지원하지 않는 클라우드 프로바이더입니다." />;
  }
};
