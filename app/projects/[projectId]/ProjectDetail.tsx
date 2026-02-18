'use client';

import { useState } from 'react';
import type { Project, SecretKey } from '@/lib/types';
import type { CurrentUser } from '@/app/lib/api';
import { ErrorState } from './common';
import { AwsProjectPage } from './aws';
import { AzureProjectPage } from './azure';
import { GcpProjectPage } from './gcp';
import { IdcProjectPage } from './idc';
import { SduProjectPage } from './sdu';

interface ProjectDetailProps {
  initialProject: Project;
  initialUser: CurrentUser;
  initialCredentials: SecretKey[];
}

export const ProjectDetail = ({
  initialProject,
  initialUser,
  initialCredentials,
}: ProjectDetailProps) => {
  const [project, setProject] = useState(initialProject);
  const [credentials] = useState(initialCredentials);

  const isAdmin = initialUser.role === 'ADMIN';

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
      return <SduProjectPage {...pageProps} isAdmin={isAdmin} />;
    default:
      return <ErrorState error={`지원하지 않는 클라우드 프로바이더입니다: ${project.cloudProvider}`} />;
  }
};
