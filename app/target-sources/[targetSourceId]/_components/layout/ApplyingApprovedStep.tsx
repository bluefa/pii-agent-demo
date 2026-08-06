'use client';

import type { CloudTargetSource } from '@/lib/types';
import {
  RejectionAlert,
} from '@/app/target-sources/[targetSourceId]/_components/common';
import { ApplyingApprovedCard } from '@/app/target-sources/[targetSourceId]/_components/layout/ApplyingApprovedCard';

interface ApplyingApprovedStepProps {
  project: CloudTargetSource;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

export const ApplyingApprovedStep = ({
  project,
}: ApplyingApprovedStepProps) => {

  return (
    <>
      <ApplyingApprovedCard targetSourceId={project.targetSourceId} />
      <RejectionAlert project={project} />
    </>
  );
};
