'use client';

import { useState } from 'react';
import type { Project, SecretKey } from '@/lib/types';
import { ErrorState } from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { AwsProjectPage } from '@/app/integration/target-sources/[targetSourceId]/_components/aws';
import { AzureProjectPage } from '@/app/integration/target-sources/[targetSourceId]/_components/azure';
import { GcpProjectPage } from '@/app/integration/target-sources/[targetSourceId]/_components/gcp';
import { IdcProjectPage } from '@/app/integration/target-sources/[targetSourceId]/_components/idc';
import { SduProjectPage } from '@/app/integration/target-sources/[targetSourceId]/_components/sdu';

interface ProjectDetailProps {
  initialProject: Project;
  initialCredentials: SecretKey[];
}

export const ProjectDetail = ({
  initialProject,
  initialCredentials,
}: ProjectDetailProps) => {
  const [project, setProject] = useState(initialProject);
  const [credentials] = useState(initialCredentials);

  const pageProps = {
    project,
    credentials,
    onProjectUpdate: setProject,
  };

  switch (project.cloudProvider) {
    case 'AWS':
      return <AwsProjectPage {...pageProps} />;
    case 'Azure':
      return <AzureProjectPage {...pageProps} />;
    case 'GCP':
      return <GcpProjectPage {...pageProps} />;
    case 'IDC':
      return <IdcProjectPage {...pageProps} />;
    case 'SDU':
      return <SduProjectPage {...pageProps} />;
    default:
      return <ErrorState error={`지원하지 않는 클라우드 프로바이더입니다: ${project.cloudProvider}`} />;
  }
};
