'use client';

import { useState } from 'react';
import type { Project, SecretKey } from '@/lib/types';
import { ErrorState } from '@/app/projects/[targetSourceId]/common';
import { AwsProjectPage } from '@/app/projects/[targetSourceId]/aws';
import { AzureProjectPage } from '@/app/projects/[targetSourceId]/azure';
import { GcpProjectPage } from '@/app/projects/[targetSourceId]/gcp';
import { IdcProjectPage } from '@/app/projects/[targetSourceId]/idc';
import { SduProjectPage } from '@/app/projects/[targetSourceId]/sdu';

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
