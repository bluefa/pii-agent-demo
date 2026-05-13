'use client';

import { useCallback } from 'react';
import {
  bgColors,
  borderColors,
  cardStyles,
  cn,
  primaryColors,
  tableStyles,
  textColors,
} from '@/lib/theme';
import { useModal } from '@/app/hooks/useModal';
import { useToast } from '@/app/components/ui/toast';
import { LogicalDbModalLoader } from '@/app/integration/target-sources/[targetSourceId]/_components/logical-db/LogicalDbModalLoader';
import { useConfirmedIntegration } from '@/app/integration/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';

interface LogicalDbModalTarget {
  resourceId: string;
  resourceName: string;
}

/**
 * Step 5 (WAITING_CONNECTION_TEST) sibling section that exposes the per-row
 * "논리 DB 확인" trigger. The modal is UI-only: save fires a toast informing
 * the reviewer that persistence lands with the BFF endpoint.
 */
export const LogicalDbSlot = () => {
  const { state } = useConfirmedIntegration();
  const modal = useModal<LogicalDbModalTarget>();
  const toast = useToast();

  const handleSave = useCallback(() => {
    toast.info('논리 DB 정보 저장은 BFF 연동 후 활성화됩니다.');
    modal.close();
  }, [modal, toast]);

  if (state.status !== 'ready' || state.data.length === 0) {
    return null;
  }

  return (
    <div data-testid="logical-db">
      <section className={cn(cardStyles.base, 'overflow-hidden')}>
        <header className={cardStyles.header}>
          <h2 className={cn('text-[15px] font-semibold', textColors.primary)}>
            논리 DB 확인
          </h2>
          <p className={cn('mt-1 text-xs', textColors.tertiary)}>
            연동 대상 리소스별로 논리 DB의 연동/제외 설정을 확인합니다.
          </p>
        </header>
        <table className="w-full text-sm">
          <thead className={bgColors.muted}>
            <tr>
              <th
                className={cn(
                  tableStyles.headerCell,
                  'text-left text-xs font-medium',
                  textColors.tertiary,
                )}
              >
                리소스 ID
              </th>
              <th
                className={cn(
                  tableStyles.headerCell,
                  'text-left text-xs font-medium',
                  textColors.tertiary,
                )}
              >
                DB 타입
              </th>
              <th
                className={cn(
                  tableStyles.headerCell,
                  'text-right text-xs font-medium',
                  textColors.tertiary,
                )}
              >
                작업
              </th>
            </tr>
          </thead>
          <tbody className={tableStyles.body}>
            {state.data.map((resource) => (
              <tr key={resource.resourceId} className={tableStyles.row}>
                <td
                  className={cn(
                    tableStyles.cell,
                    'font-mono text-xs',
                    textColors.secondary,
                  )}
                >
                  {resource.resourceId}
                </td>
                <td
                  className={cn(
                    tableStyles.cell,
                    'text-xs',
                    textColors.tertiary,
                  )}
                >
                  {resource.databaseType ?? '-'}
                </td>
                <td className={cn(tableStyles.cell, 'text-right')}>
                  <button
                    type="button"
                    onClick={() =>
                      modal.open({
                        resourceId: resource.resourceId,
                        resourceName: resource.resourceId,
                      })
                    }
                    className={cn(
                      'text-[12.5px] rounded-md border px-2.5 py-1 transition-colors',
                      borderColors.default,
                      primaryColors.text,
                      'hover:underline',
                    )}
                  >
                    논리 DB 확인
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {modal.data && (
        <LogicalDbModalLoader
          open={modal.isOpen}
          resourceId={modal.data.resourceId}
          resourceName={modal.data.resourceName}
          onSave={handleSave}
          onClose={modal.close}
        />
      )}
    </div>
  );
};
