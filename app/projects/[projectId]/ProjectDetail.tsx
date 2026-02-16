'use client';

import { useState, useEffect } from 'react';
import { Project } from '@/lib/types';
import type { SecretKey } from '@/lib/types';
import { getProject, getCurrentUser, CurrentUser, getSecrets } from '@/app/lib/api';
import { LoadingState, ErrorState } from './common';
import { AwsProjectPage } from './aws';
import { AzureProjectPage } from './azure';
import { GcpProjectPage } from './gcp';
import { IdcProjectPage } from './idc';
import { SduProjectPage } from './sdu';

interface ProjectDetailProps {
  projectId: string;
}

export const ProjectDetail = ({ projectId }: ProjectDetailProps) => {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [credentials, setCredentials] = useState<SecretKey[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [projectData, userData] = await Promise.all([
          getProject(Number(projectId)),
          getCurrentUser(),
        ]);
        setProject(projectData);
        setCurrentUser(userData);
        setError(null);

        // Credential 목록 가져오기
        const creds = await getSecrets(projectData.targetSourceId);
        setCredentials(creds || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : '과제를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId]);

  const isAdmin = currentUser?.role === 'ADMIN';

  if (loading) {
    return <LoadingState />;
  }

  if (error || !project) {
    return <ErrorState error={error} />;
  }

  const pageProps = {
    project,
    credentials,
    onProjectUpdate: setProject,
  };

  // Provider별 페이지 라우팅
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
