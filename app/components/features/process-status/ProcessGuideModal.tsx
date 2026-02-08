'use client';

import { useEffect, useRef } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { statusColors } from '@/lib/theme';
import { ProcessGuideTimeline } from './ProcessGuideTimeline';
import { ProcessGuideStepCard } from './ProcessGuideStepCard';
import type { ProviderProcessGuide } from '@/lib/types/process-guide';

export interface ProcessGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  guide: ProviderProcessGuide;
  currentStepNumber: number;
}

export const ProcessGuideModal = ({ isOpen, onClose, guide, currentStepNumber }: ProcessGuideModalProps) => {
  const stepRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!isOpen) return;
    setTimeout(() => {
      stepRefs.current[currentStepNumber]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, [isOpen, currentStepNumber]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={guide.title}
      subtitle="프로세스 가이드"
      size="2xl"
      icon={
        <svg className={`w-6 h-6 ${statusColors.info.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      }
    >
      <div className="flex gap-6 -mx-6 -my-6">
        {/* 좌측 타임라인 */}
        <div className="w-52 bg-gray-50 border-r border-gray-200 py-4">
          <ProcessGuideTimeline
            steps={guide.steps}
            currentStepNumber={currentStepNumber}
            onStepClick={(stepNumber) => {
              stepRefs.current[stepNumber]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          />
        </div>

        {/* 우측 카드 목록 */}
        <div className="flex-1 py-4 pr-6 overflow-y-auto max-h-[65vh] space-y-4">
          {guide.steps.map((step) => {
            const status = step.stepNumber < currentStepNumber
              ? 'completed'
              : step.stepNumber === currentStepNumber
              ? 'current'
              : 'pending';

            return (
              <div
                key={step.stepNumber}
                ref={(el) => { stepRefs.current[step.stepNumber] = el; }}
              >
                <ProcessGuideStepCard
                  step={step}
                  status={status}
                  defaultExpanded={step.stepNumber === currentStepNumber}
                />
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};

export default ProcessGuideModal;
