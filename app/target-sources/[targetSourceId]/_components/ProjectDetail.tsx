'use client';

import { useState } from 'react';
import type { TargetSource } from '@/lib/types';
import { providerAccent, providerAccentDefault } from '@/lib/theme';
import {
  ErrorState,
  GuidePanel,
  SduUnsupportedNotice,
} from '@/app/target-sources/[targetSourceId]/_components/common';
import type { JiraTicketState } from '@/app/target-sources/[targetSourceId]/_components/common/GuidePanel';
import { resolveProjectStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
import { AwsProjectPage } from '@/app/target-sources/[targetSourceId]/_components/aws';
import { AzureProjectPage } from '@/app/target-sources/[targetSourceId]/_components/azure';
import { GcpProjectPage } from '@/app/target-sources/[targetSourceId]/_components/gcp';
import { IdcProjectPage } from '@/app/target-sources/[targetSourceId]/_components/idc';
import { ServiceListPanel } from '@/app/target-sources/[targetSourceId]/_components/ServiceListPanel';

// The middle column is the page's only scroller — the row above it is height-fixed
// so the rails stay put. `relative` is what holds that promise: without a positioned
// ancestor, an `absolute` descendant resolves against the initial containing block
// instead of this box, and `overflow-auto` does not clip what it does not contain.
// Tailwind's `sr-only` is exactly that (position: absolute), so every aria-live
// region inside a long step table sat at its static y — 1897px on a 900px viewport —
// and stretched the ROOT scroll area: the whole page scrolled, rails and top nav
// included, until nothing was left on screen.
const SCROLL_COLUMN = 'relative flex-1 min-w-0 overflow-auto';

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
        return <ErrorState message="지원하지 않는 클라우드 프로바이더예요." />;
    }
  };

  // SDU is not an account we install into — the owner uploads the data themselves —
  // so no step, no resource table and no install status on this page has anything to
  // say about it. Gate here rather than inside each provider page: this way nothing
  // downstream mounts and nothing is fetched, instead of a full screen loading itself
  // only to come back empty. The rail goes too — it reports on install progress that
  // does not exist. The service list stays, because it is how you leave.
  if (project.isSduType) {
    return (
      <div className="flex h-[calc(100vh-64px)]">
        <ServiceListPanel
          currentService={{ code: project.serviceCode, name: project.serviceName }}
        />
        <div className={SCROLL_COLUMN}>
          <SduUnsupportedNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
      <ServiceListPanel
        currentService={{ code: project.serviceCode, name: project.serviceName }}
      />
      <div className={SCROLL_COLUMN}>
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
