'use client';

import { useState, useEffect } from 'react';
import { Project, DBCredential } from '@/lib/types';
import { getProject, getCurrentUser, CurrentUser, getCredentials } from '@/app/lib/api';
import { LoadingState, ErrorState } from './common';
import { AwsProjectPage } from './aws';
import { AzureProjectPage } from './azure';
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
  const [credentials, setCredentials] = useState<DBCredential[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [projectData, userData] = await Promise.all([
          getProject(projectId),
          getCurrentUser(),
        ]);
        setProject(projectData);
        setCurrentUser(userData);
        setError(null);

        // Credential 목록 가져오기
        const creds = await getCredentials(projectId);
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

  // Provider별 페이지 라우팅
  switch (project.cloudProvider) {
    case 'Azure':
      return (
        <AzureProjectPage
          project={project}
          isAdmin={isAdmin}
          credentials={credentials}
          onProjectUpdate={setProject}
        />
      );
    case 'IDC':
      return (
        <IdcProjectPage
          project={project}
          isAdmin={isAdmin}
          credentials={credentials}
          onProjectUpdate={setProject}
        />
      );
    case 'SDU':
      return (
        <SduProjectPage
          project={project}
          isAdmin={isAdmin}
          onProjectUpdate={setProject}
        />
      );
    case 'AWS':
    default:
      return (
        <AwsProjectPage
          project={project}
          isAdmin={isAdmin}
          credentials={credentials}
          onProjectUpdate={setProject}
        />
      );
  }
};
