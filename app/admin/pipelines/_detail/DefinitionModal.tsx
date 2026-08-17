/**
 * 정의·계약 modal — the task's definition rows and judgment policy, opened from
 * the last row of the task drawer (design-benchmark 2026-08-16 시안 B).
 *
 * This was a fold at the foot of the drawer body, and measured 425px of the
 * panel's 1,054px expanded height — 40% of it — for values that do not change
 * between runs and never answer "why did this fail". Evicting it is what lets
 * the panel be 400px wide and gives the Job list its floor back.
 *
 * Grammar copied from TerraformStatusModal, which promoted an inline disclosure
 * to a modal for the same reason: ModalShell `task` (600px, body scrolls) +
 * pipelineStyles.modal.title/desc/body/foot.
 */
import { type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { DefinitionTab } from '@/app/admin/pipelines/_detail/execTabs';
import type { TaskDetail } from '@/lib/pipeline/types';

const TITLE_ID = 'pl-task-definition-title';

export function DefinitionModal({
  detail,
  displayName,
  onClose,
}: {
  detail: TaskDetail;
  displayName: string;
  onClose: () => void;
}): ReactElement {
  return (
    <ModalShell open onClose={onClose} variant="task" labelledBy={TITLE_ID}>
      <h3 id={TITLE_ID} className={pipelineStyles.modal.title}>
        정의·계약
      </h3>
      <p className={pipelineStyles.modal.desc}>
        {displayName} 태스크에 적용된 카탈로그 정의와 판정 규칙입니다. 실행마다 달라지지 않습니다.
      </p>

      {/* gap-6 — the spacing the fold gave the rows/policy pair (`defBody`). */}
      <div className={cn(pipelineStyles.modal.body, 'flex flex-col gap-6')}>
        <DefinitionTab detail={detail} displayName={displayName} />
      </div>

      <div className={pipelineStyles.modal.foot}>
        <PlButton variant="secondary" onClick={onClose}>
          닫기
        </PlButton>
      </div>
    </ModalShell>
  );
}
