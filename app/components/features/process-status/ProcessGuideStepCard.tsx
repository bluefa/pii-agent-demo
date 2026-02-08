'use client';

import { useState } from 'react';
import { Badge } from '@/app/components/ui/Badge';
import { statusColors, cn } from '@/lib/theme';
import type { ProcessGuideStep } from '@/lib/types/process-guide';

export interface ProcessGuideStepCardProps {
  step: ProcessGuideStep;
  status: 'completed' | 'current' | 'pending';
  defaultExpanded?: boolean;
}

export const ProcessGuideStepCard = ({ step, status, defaultExpanded = false }: ProcessGuideStepCardProps) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const badgeVariant = status === 'completed' ? 'success' : status === 'current' ? 'info' : 'pending';
  const badgeLabel = status === 'completed' ? '완료' : status === 'current' ? '진행중' : '대기';

  const borderClass = status === 'current' ? cn('border-l-4', statusColors.info.border) : 'border-l-4 border-transparent';
  const shadowClass = status === 'current' ? 'shadow-md' : 'shadow-sm';

  return (
    <div className={cn('bg-white rounded-lg p-5 transition-all', borderClass, shadowClass)}>
      {/* 헤더 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className="w-full flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <span className={cn(
            'font-semibold',
            status === 'current' ? 'text-gray-900' : 'text-gray-600'
          )}>
            {step.stepNumber}. {step.label}
          </span>
          <Badge variant={badgeVariant} size="sm">
            {badgeLabel}
          </Badge>
        </div>
        <svg
          className={cn(
            'w-5 h-5 text-gray-400 transition-transform',
            isExpanded && 'rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 콘텐츠 */}
      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* 설명 */}
          <p className="text-sm text-gray-700">{step.description}</p>

          {/* 사전 조치 */}
          {step.prerequisites && step.prerequisites.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span className="text-sm font-semibold text-gray-900">사전 조치</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 ml-6">
                {step.prerequisites.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 수행 절차 */}
          {step.procedures && step.procedures.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-sm font-semibold text-gray-900">수행 절차</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600 ml-6">
                {step.procedures.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ol>
            </div>
          )}

          {/* 주의사항 */}
          {step.warnings && step.warnings.length > 0 && (
            <div className={cn('rounded-lg p-3', statusColors.warning.bg)}>
              <div className="flex items-center gap-2 mb-2">
                <svg className={cn('w-4 h-4', statusColors.warning.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className={cn('text-sm font-semibold', statusColors.warning.textDark)}>주의사항</span>
              </div>
              <ul className={cn('list-disc list-inside space-y-1 text-sm ml-6', statusColors.warning.textDark)}>
                {step.warnings.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 참고사항 */}
          {step.notes && step.notes.length > 0 && (
            <div className={cn('rounded-lg p-3', statusColors.info.bg)}>
              <div className="flex items-center gap-2 mb-2">
                <svg className={cn('w-4 h-4', statusColors.info.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className={cn('text-sm font-semibold', statusColors.info.textDark)}>참고사항</span>
              </div>
              <ul className={cn('list-disc list-inside space-y-1 text-sm ml-6', statusColors.info.textDark)}>
                {step.notes.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProcessGuideStepCard;
