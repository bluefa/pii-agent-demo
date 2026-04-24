'use client';

import { useState } from 'react';
import type { TargetSource } from '@/lib/types';
import { ErrorState } from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { AwsProjectPage } from '@/app/integration/target-sources/[targetSourceId]/_components/aws';
import { AzureProjectPage } from '@/app/integration/target-sources/[targetSourceId]/_components/azure';
import { GcpProjectPage } from '@/app/integration/target-sources/[targetSourceId]/_components/gcp';

interface ProjectDetailProps {
  initialProject: TargetSource;
}

export const ProjectDetail = ({ initialProject }: ProjectDetailProps) => {
  const [project, setProject] = useState<TargetSource>(initialProject);

  switch (project.cloudProvider) {
    case 'AWS':
      return <AwsProjectPage project={project} onProjectUpdate={setProject} />;
    case 'Azure':
      return <AzureProjectPage project={project} onProjectUpdate={setProject} />;
    case 'GCP':
      return <GcpProjectPage project={project} onProjectUpdate={setProject} />;
    default:
      return <ErrorState error="지원하지 않는 클라우드 프로바이더입니다." />;
  }
};
