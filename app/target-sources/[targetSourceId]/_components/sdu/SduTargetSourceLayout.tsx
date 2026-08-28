'use client';

import type { ReactNode } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import { ProjectPageMeta } from '@/app/target-sources/[targetSourceId]/_components/common';
import type { ProjectIdentity } from '@/app/target-sources/[targetSourceId]/_components/common';
import { sduStepOf } from '@/app/target-sources/[targetSourceId]/_components/sdu/sdu-steps';
import type { SduStepProps } from '@/app/target-sources/[targetSourceId]/_components/sdu/types';
import { SduStep1Define } from '@/app/target-sources/[targetSourceId]/_components/sdu/steps/SduStep1Define';
import { SduStep4Upload } from '@/app/target-sources/[targetSourceId]/_components/sdu/steps/SduStep4Upload';
import { SduStep6Integrating } from '@/app/target-sources/[targetSourceId]/_components/sdu/steps/SduStep6Integrating';
import { SduStep7Complete } from '@/app/target-sources/[targetSourceId]/_components/sdu/steps/SduStep7Complete';

/**
 * Four screens for seven statuses. The cloud and IDC layouts switch on `processStatus`
 * directly because they have one screen per status; SDU folds three statuses onto
 * 2 데이터 업로드 and two onto 3 SDU 연동중, so the switch runs on the SDU step instead and
 * `sduStepOf` is the single place that fold is written.
 */
const renderStep = (props: SduStepProps): ReactNode => {
  switch (sduStepOf(props.project.processStatus)) {
    case 1:
      return <SduStep1Define {...props} />;
    case 2:
      return <SduStep4Upload {...props} />;
    case 3:
      return <SduStep6Integrating {...props} />;
    case 4:
      return <SduStep7Complete {...props} />;
    default:
      // `sduStepOf` is total over `ProcessStatus`, but the status arrives over the wire —
      // an unknown one renders nothing rather than guessing a screen for it.
      return null;
  }
};

interface SduTargetSourceLayoutProps extends SduStepProps {
  identity: ProjectIdentity;
}

export const SduTargetSourceLayout = ({
  identity,
  ...stepProps
}: SduTargetSourceLayoutProps) => {
  const step = renderStep(stepProps);
  if (!step) return null;
  return (
    // Same shell as `IdcTargetSourceLayout` down to the class strings: `min-h-full` (not
    // `min-h-screen`, which is dead scroll inside ProjectDetail's `100vh - 64px` column),
    // the flat header spanning the column, then the 32/20/80 body. SDU is a different
    // flow, not a different kind of page — it must not arrive looking like one.
    <main className="min-h-full">
      <ProjectPageMeta project={stepProps.project} identity={identity} />
      <div className="px-5 pt-8 pb-20 space-y-6">{step}</div>
    </main>
  );
};

export type { CloudTargetSource };
