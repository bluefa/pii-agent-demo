'use client';

import { useState } from 'react';
import type { TargetSource } from '@/lib/types';
import {
  ErrorState,
  GuidePanel,
} from '@/app/target-sources/[targetSourceId]/_components/common';
import type { JiraTicketState } from '@/app/target-sources/[targetSourceId]/_components/common/GuidePanel';
import type { RailCollapsed } from '@/app/components/ui/RailCollapse';
import { resolveProjectStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
import { AwsProjectPage } from '@/app/target-sources/[targetSourceId]/_components/aws';
import { AzureProjectPage } from '@/app/target-sources/[targetSourceId]/_components/azure';
import { GcpProjectPage } from '@/app/target-sources/[targetSourceId]/_components/gcp';
import { IdcProjectPage } from '@/app/target-sources/[targetSourceId]/_components/idc';
import { SduProjectPage } from '@/app/target-sources/[targetSourceId]/_components/sdu';
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
  /** Fold preference off the request cookie (page.tsx). `null` = none stored. */
  railCollapsed: RailCollapsed;
}

export const ProjectDetail = ({
  initialProject,
  jiraTicket,
  railCollapsed,
}: ProjectDetailProps) => {
  const [project, setProject] = useState<TargetSource>(initialProject);

  // Right column wrapper is a <div> (not <main>) — provider pages already
  // render their own <main>, and nesting two <main> elements is invalid.
  const renderProvider = () => {
    // SDU is checked BEFORE the provider switch, and it is not a case in it: SDU names how
    // the data arrives, not where it lives, so an SDU target still carries a real
    // `cloudProvider` and would fall straight into that provider's page — a screen that
    // would scan an account nobody is installing into.
    //
    // This used to be a full-page 「아직 지원하지 않는 서비스 타입입니다」 notice mounted in
    // place of the whole layout, rail included. The flow exists now, so the notice is gone
    // and the SDU page takes the same slot every other provider page takes — inside the
    // scroll column, with ServiceListPanel to its left and the guide rail to its right.
    // Keyed by targetSourceId for the same reason IDC is: switching targets fully remounts
    // the subtree so no per-target state leaks across (DR2).
    if (project.isSduType) {
      return (
        <SduProjectPage
          key={project.targetSourceId}
          project={project}
          onProjectUpdate={setProject}
        />
      );
    }

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

  return (
    <div className="flex h-[calc(100vh-64px)]">
      <ServiceListPanel
        currentService={{ code: project.serviceCode, name: project.serviceName }}
      />
      <div className={SCROLL_COLUMN}>
        {renderProvider()}
      </div>
      {/* Full-height right rail (가이드) — mirrors the left ServiceListPanel. */}
      <GuidePanel
        slotKey={resolveProjectStepSlot(project)}
        jiraTicket={jiraTicket}
        initialCollapsed={railCollapsed}
      />
    </div>
  );
};
