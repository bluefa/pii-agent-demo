'use client';

import { useEffect, useState } from 'react';
import type { TargetSource } from '@/lib/types';
import { getJiraTicket } from '@/app/lib/api';
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
}

export const ProjectDetail = ({ initialProject }: ProjectDetailProps) => {
  const [project, setProject] = useState<TargetSource>(initialProject);

  // Collab-channel ticket for the guide rail card. States are kept distinct so
  // a fetch outage ('error') is never rendered as the 미연결 state (null = the
  // API's 404, i.e. genuinely no ticket mapped).
  const [jiraTicket, setJiraTicket] = useState<JiraTicketState>('loading');
  // Reset during render (not in the effect) when the target changes, so the
  // previous target's ticket never flashes on the new page.
  const [ticketTargetId, setTicketTargetId] = useState(project.targetSourceId);
  if (ticketTargetId !== project.targetSourceId) {
    setTicketTargetId(project.targetSourceId);
    setJiraTicket('loading');
  }
  useEffect(() => {
    let cancelled = false;
    getJiraTicket(project.targetSourceId)
      .then((ticket) => {
        if (!cancelled) setJiraTicket(ticket);
      })
      .catch(() => {
        if (!cancelled) setJiraTicket('error');
      });
    return () => {
      cancelled = true;
    };
  }, [project.targetSourceId]);

  // Same semantics as the per-provider identity strips had: SDU accounts are
  // monitored via SDU, everything else via the provider agent.
  const monitoringLabel = project.isSduType ? 'SDU' : `${project.cloudProvider} Agent`;
  const monitoringAccent =
    providerAccent[project.cloudProvider.toLowerCase()] ?? providerAccentDefault;

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
      case 'IDC':
        // key by targetSourceId so switching IDC target sources fully remounts
        // the subtree — no stale per-target state leaks across (DR2).
        return (
          <IdcProjectPage
            key={project.targetSourceId}
            project={project}
            onProjectUpdate={setProject}
          />
        );
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
      {/* Full-height right rail (가이드/진행 내역) — mirrors the left ServiceListPanel. */}
      <GuidePanel
        slotKey={resolveProjectStepSlot(project)}
        jiraTicket={jiraTicket}
        monitoringLabel={monitoringLabel}
        monitoringAccent={monitoringAccent}
      />
    </div>
  );
};
