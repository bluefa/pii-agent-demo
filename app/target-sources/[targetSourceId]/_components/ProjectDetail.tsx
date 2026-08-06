'use client';

import { useState } from 'react';
import type { TargetSource } from '@/lib/types';
import { providerAccent, providerAccentDefault } from '@/lib/theme';
import { ErrorState, GuidePanel } from '@/app/target-sources/[targetSourceId]/_components/common';
import type { JiraTicketState } from '@/app/target-sources/[targetSourceId]/_components/common/GuidePanel';
import { resolveProjectStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
import { AwsProjectPage } from '@/app/target-sources/[targetSourceId]/_components/aws';
import { AzureProjectPage } from '@/app/target-sources/[targetSourceId]/_components/azure';
import { GcpProjectPage } from '@/app/target-sources/[targetSourceId]/_components/gcp';
import { IdcProjectPage } from '@/app/target-sources/[targetSourceId]/_components/idc';
import { ServiceListPanel } from '@/app/target-sources/[targetSourceId]/_components/ServiceListPanel';

interface ProjectDetailProps {
  initialProject: TargetSource;
  /** SSR-resolved collab ticket (page.tsx): null = none mapped (404), 'error' = fetch failed. */
  jiraTicket: JiraTicketState;
}

export const ProjectDetail = ({ initialProject, jiraTicket }: ProjectDetailProps) => {
  const [project, setProject] = useState<TargetSource>(initialProject);

  // Same semantics as the per-provider identity strips had: SDU accounts are
  // monitored via SDU, everything else via the provider agent.
  const monitoringLabel = project.isSduType ? 'SDU' : `${project.cloudProvider} Agent`;
  const monitoringAccent =
    providerAccent[project.cloudProvider.toLowerCase()] ?? providerAccentDefault;

  // Guide band (was the full-height right rail) — built here because its data
  // is page-level (SSR jiraTicket, monitoring identity), then handed to the
  // provider layout, which slots it directly under the flat page header.
  const guideSlot = (
    <GuidePanel
      slotKey={resolveProjectStepSlot(project)}
      jiraTicket={jiraTicket}
      monitoringLabel={monitoringLabel}
      monitoringAccent={monitoringAccent}
    />
  );

  // Right column wrapper is a <div> (not <main>) — provider pages already
  // render their own <main>, and nesting two <main> elements is invalid.
  const renderProvider = () => {
    switch (project.cloudProvider) {
      case 'AWS':
        return <AwsProjectPage project={project} onProjectUpdate={setProject} guideSlot={guideSlot} />;
      case 'Azure':
        return <AzureProjectPage project={project} onProjectUpdate={setProject} guideSlot={guideSlot} />;
      case 'GCP':
        return <GcpProjectPage project={project} onProjectUpdate={setProject} guideSlot={guideSlot} />;
      case 'IDC':
        // key by targetSourceId so switching IDC target sources fully remounts
        // the subtree — no stale per-target state leaks across (DR2).
        return (
          <IdcProjectPage
            key={project.targetSourceId}
            project={project}
            onProjectUpdate={setProject}
            guideSlot={guideSlot}
          />
        );
      default:
        return <ErrorState error="지원하지 않는 클라우드 프로바이더입니다." />;
    }
  };

  return (
    <div className="flex h-[calc(100vh-56px)]">
      <ServiceListPanel
        currentService={{ code: project.serviceCode, name: project.serviceName }}
      />
      <div className="flex-1 min-w-0 overflow-auto">
        {renderProvider()}
      </div>
    </div>
  );
};
