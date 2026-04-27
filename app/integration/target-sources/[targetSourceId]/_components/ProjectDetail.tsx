'use client';

import { useState } from 'react';
import type { TargetSource } from '@/lib/types';
import { ErrorState } from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { AwsProjectPage } from '@/app/integration/target-sources/[targetSourceId]/_components/aws';
import { AzureProjectPage } from '@/app/integration/target-sources/[targetSourceId]/_components/azure';
import { GcpProjectPage } from '@/app/integration/target-sources/[targetSourceId]/_components/gcp';
import { ServiceListPanel } from './ServiceListPanel';

interface ProjectDetailProps {
  initialProject: TargetSource;
}

export const ProjectDetail = ({ initialProject }: ProjectDetailProps) => {
  const [project, setProject] = useState<TargetSource>(initialProject);

  // Right column wrapper is a <div> (not <main>) — provider pages already
  // render their own <main>, and nesting two <main> elements is invalid.
  const renderProvider = () => {
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

  return (
    <div className="flex h-[calc(100vh-56px)]">
      <ServiceListPanel />
      <div className="flex-1 min-w-0 overflow-auto">
        {renderProvider()}
      </div>
    </div>
  );
};
