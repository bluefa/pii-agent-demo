'use client';

import type { ReactNode } from 'react';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import { ProjectPageMeta } from '@/app/target-sources/[targetSourceId]/_components/common';
import type { IdcStepProps } from '@/app/target-sources/[targetSourceId]/_components/idc/types';
import { IdcStep1TargetInput } from '@/app/target-sources/[targetSourceId]/_components/idc/steps/IdcStep1TargetInput';
import { IdcStep2WaitingApproval } from '@/app/target-sources/[targetSourceId]/_components/idc/steps/IdcStep2WaitingApproval';
import { IdcStep3Applying } from '@/app/target-sources/[targetSourceId]/_components/idc/steps/IdcStep3Applying';
import { IdcStep4Installing } from '@/app/target-sources/[targetSourceId]/_components/idc/steps/IdcStep4Installing';
import { IdcStep5ConnectionTest } from '@/app/target-sources/[targetSourceId]/_components/idc/steps/IdcStep5ConnectionTest';
import { IdcStep6ConnectionVerified } from '@/app/target-sources/[targetSourceId]/_components/idc/steps/IdcStep6ConnectionVerified';
import { IdcStep7Complete } from '@/app/target-sources/[targetSourceId]/_components/idc/steps/IdcStep7Complete';

const renderStep = (props: IdcStepProps): ReactNode => {
  switch (props.project.processStatus) {
    case ProcessStatus.WAITING_TARGET_CONFIRMATION:
      return <IdcStep1TargetInput {...props} />;
    case ProcessStatus.WAITING_APPROVAL:
      return <IdcStep2WaitingApproval {...props} />;
    case ProcessStatus.APPLYING_APPROVED:
      return <IdcStep3Applying {...props} />;
    case ProcessStatus.INSTALLING:
      return <IdcStep4Installing {...props} />;
    case ProcessStatus.WAITING_CONNECTION_TEST:
      return <IdcStep5ConnectionTest {...props} />;
    case ProcessStatus.CONNECTION_VERIFIED:
      return <IdcStep6ConnectionVerified {...props} />;
    case ProcessStatus.INSTALLATION_COMPLETE:
      return <IdcStep7Complete {...props} />;
    default:
      return null;
  }
};

export const IdcTargetSourceLayout = (props: IdcStepProps) => {
  const step = renderStep(props);
  if (!step) return null;
  return (
    // `min-h-full`, not `min-h-screen` (#665) — see CloudTargetSourceLayout: a
    // full 100vh inside ProjectDetail's `100vh - 76px` column is dead scroll.
    <main className="min-h-full">
      {/* Flat page header (chrome) spans the column edge-to-edge above the padded
          body — the layout owns it; steps render cards only (cloud layout parity). */}
      <ProjectPageMeta project={props.project} identity={props.identity} action={props.action} />
      {/* v16 `.main` — full-width flex column, padding 32px 40px 80px (top/x/bottom). The 40px
          left padding sits flush against the 296px sidebar so content begins at 336px, matching v16.
          The step guide lives in the full-height right rail (GuidePanel, ProjectDetail). */}
      <div className="px-10 pt-8 pb-20 space-y-6">{step}</div>
    </main>
  );
};

export type { CloudTargetSource };
