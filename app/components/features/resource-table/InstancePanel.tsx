'use client';

import { useState } from 'react';
import { cn, statusColors, textColors, bgColors, borderColors } from '@/lib/theme';
import { Badge } from '@/app/components/ui/Badge';
import type { ClusterInstance } from '@/lib/types';

const COLLAPSE_THRESHOLD = 5;
const INITIAL_VISIBLE = 3;

interface InstancePanelProps {
  instances: ClusterInstance[];
  isEditMode: boolean;
  onInstanceToggle: (instanceId: string, checked: boolean) => void;
}

const sortInstances = (instances: ClusterInstance[]): ClusterInstance[] => {
  return [...instances].sort((a, b) => {
    if (a.role !== b.role) return a.role === 'WRITER' ? 1 : -1;
    return a.instanceId.localeCompare(b.instanceId);
  });
};

export const InstancePanel = ({ instances, isEditMode, onInstanceToggle }: InstancePanelProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const sorted = sortInstances(instances);
  const needsCollapse = sorted.length >= COLLAPSE_THRESHOLD;
  const visible = needsCollapse && !isExpanded ? sorted.slice(0, INITIAL_VISIBLE) : sorted;
  const hiddenCount = sorted.length - INITIAL_VISIBLE;

  return (
    <tr>
      <td colSpan={7} className="px-0 py-0">
        <div className="mx-6 my-3">
          <div className={cn('border rounded-lg overflow-hidden', borderColors.default, bgColors.muted)}>
            {/* Guide text */}
            <div className="px-4 py-3 flex items-center gap-2">
              <svg className={cn('w-4 h-4 flex-shrink-0', statusColors.info.text)} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className={cn('text-sm', textColors.secondary)}>
                연동할 Instance를 선택하세요
              </span>
              <span className={cn('text-xs', textColors.quaternary)}>
                Reader Instance 권장 · 1개 이상 선택 필수
              </span>
            </div>

            {/* Instance sub-table */}
            <table className="w-full">
              <thead>
                <tr className={cn('border-t text-left text-xs font-medium uppercase tracking-wider', borderColors.default, textColors.quaternary)}>
                  {isEditMode && <th className="px-4 py-2 w-10" />}
                  <th className="px-4 py-2">역할</th>
                  <th className="px-4 py-2">Instance ID</th>
                  <th className="px-4 py-2">Availability Zone</th>
                </tr>
              </thead>
              <tbody className={cn('divide-y', 'divide-gray-100')}>
                {visible.map((inst) => (
                  <tr key={inst.instanceId} className="transition-colors">
                    {isEditMode && (
                      <td className="px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={inst.isSelected}
                          onChange={(e) => onInstanceToggle(inst.instanceId, e.target.checked)}
                          className={cn('w-4 h-4 rounded', statusColors.pending.border)}
                        />
                      </td>
                    )}
                    <td className="px-4 py-2.5">
                      <Badge variant={inst.role === 'READER' ? 'info' : 'warning'} size="sm">
                        {inst.role === 'READER' ? 'Reader' : 'Writer'}
                      </Badge>
                    </td>
                    <td className={cn('px-4 py-2.5 font-mono text-sm', textColors.tertiary)}>
                      {inst.instanceId}
                    </td>
                    <td className={cn('px-4 py-2.5 text-sm', textColors.secondary)}>
                      {inst.availabilityZone}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Expand/Collapse toggle */}
            {needsCollapse && (
              <div className={cn('px-4 py-2 border-t text-center', borderColors.default)}>
                <button
                  onClick={() => setIsExpanded((prev) => !prev)}
                  className={cn('text-sm font-medium transition-colors', statusColors.info.textDark, 'hover:underline')}
                >
                  {isExpanded ? '접기' : `${hiddenCount}개 더 보기`}
                </button>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
};
