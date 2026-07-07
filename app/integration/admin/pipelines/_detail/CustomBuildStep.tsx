'use client';

/**
 * CustomBuildStep — LIN-22 §B2 builder body (PreviewModal step 'custom-build').
 * Adds tasks from the provider-scoped catalog (#12 — already-chosen entries
 * are hidden, so dedup lives in the UI), reorders with up/down buttons
 * (keyboard-reachable; LIN-22 keeps drag&drop out of scope), and attaches an
 * optional ≤100-char operator note per task with a live counter. Over-limit
 * rows flag the counter AND the row border (color-not-only: the counter text
 * itself reads 123/100). Pure list logic lives in customBuilder.ts; the
 * parent owns the chosen list and the [구성 확인] gating via canSubmit().
 */
import type { ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { Icon } from '@/app/integration/admin/pipelines/_components/icons';
import { PlButton } from '@/app/integration/admin/pipelines/_components/PlButton';
import { PlSelect } from '@/app/integration/admin/pipelines/_components/PlSelect';
import { TerraformLogo } from '@/app/integration/admin/pipelines/_components/brandMarks';
import { detailStyles } from '@/app/integration/admin/pipelines/_detail/detailStyles';
import {
  availableEntries,
  descriptionTooLong,
  moveTask,
  MAX_DESCRIPTION_LENGTH,
  type BuilderTask,
} from '@/app/integration/admin/pipelines/_detail/customBuilder';
import type { TaskCatalogEntry } from '@/lib/pipeline/types';

export interface CustomBuildStepProps {
  /** null = still loading (skeleton). */
  catalog: TaskCatalogEntry[] | null;
  catalogError: string | null;
  onRetry: () => void;
  chosen: BuilderTask[];
  onChange: (next: BuilderTask[]) => void;
}

export function CustomBuildStep({
  catalog,
  catalogError,
  onRetry,
  chosen,
  onChange,
}: CustomBuildStepProps): ReactElement {
  const b = detailStyles.builder;
  const pv = detailStyles.preview;

  if (catalogError) {
    return (
      <div>
        <div className={detailStyles.taskModal.degraded}>
          Task 카탈로그를 불러오지 못했습니다 — {catalogError}
        </div>
        <PlButton variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          재시도
        </PlButton>
      </div>
    );
  }

  if (!catalog) {
    return <div className={cn(detailStyles.skeleton, 'h-32')} aria-hidden="true" />;
  }

  const available = availableEntries(catalog, chosen);

  const add = (name: string): void => {
    const entry = catalog.find((e) => e.name === name);
    if (entry) onChange([...chosen, { entry, description: '' }]);
  };
  const remove = (index: number): void => {
    onChange(chosen.filter((_, i) => i !== index));
  };
  const setDescription = (index: number, description: string): void => {
    onChange(chosen.map((t, i) => (i === index ? { ...t, description } : t)));
  };

  return (
    <div>
      <div className={b.addRow}>
        <PlSelect
          value=""
          aria-label="Task 추가"
          disabled={!available.length}
          onChange={(e) => {
            if (e.target.value) add(e.target.value);
          }}
        >
          <option value="">{available.length ? 'Task 추가…' : '추가할 Task 없음'}</option>
          {available.map((e) => (
            <option key={e.name} value={e.name}>
              {e.display_name}
            </option>
          ))}
        </PlSelect>
        <span className={b.count}>Task {chosen.length}개</span>
      </div>

      {chosen.length ? (
        <div className={b.list}>
          {chosen.map((t, i) => {
            const over = descriptionTooLong(t);
            return (
              <div key={t.entry.name} className={over ? b.rowErr : b.row}>
                <span className={b.seq}>{i + 1}</span>
                {t.entry.kind === 'CONDITION_CHECK' ? (
                  <span className={pv.markCond} title="조건 확인 — 폴링">
                    <Icon name="clock" size="sm" />
                  </span>
                ) : (
                  <span className={pv.mark} title="Terraform">
                    <TerraformLogo />
                  </span>
                )}
                <span className={b.name} title={t.entry.description}>
                  {t.entry.display_name}
                </span>
                <input
                  className={b.input}
                  value={t.description}
                  placeholder="설명 (선택 · 100자 이내)"
                  aria-label={`${t.entry.display_name} 설명`}
                  onChange={(e) => setDescription(i, e.target.value)}
                />
                <span
                  className={over ? b.counterOver : b.counter}
                  title={over ? '설명은 100자 이내여야 합니다' : undefined}
                >
                  {t.description.length}/{MAX_DESCRIPTION_LENGTH}
                </span>
                <span className={b.ctrls}>
                  <PlButton
                    variant="ghost"
                    round
                    disabled={i === 0}
                    aria-label={`${t.entry.display_name} 위로 이동`}
                    onClick={() => onChange(moveTask(chosen, i, -1))}
                  >
                    <Icon name="chev-u" size="sm" />
                  </PlButton>
                  <PlButton
                    variant="ghost"
                    round
                    disabled={i === chosen.length - 1}
                    aria-label={`${t.entry.display_name} 아래로 이동`}
                    onClick={() => onChange(moveTask(chosen, i, 1))}
                  >
                    <Icon name="chev-d" size="sm" />
                  </PlButton>
                  <PlButton
                    variant="ghost"
                    round
                    aria-label={`${t.entry.display_name} 제거`}
                    onClick={() => remove(i)}
                  >
                    <Icon name="x" size="sm" />
                  </PlButton>
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={b.empty}>카탈로그에서 Task를 추가해 실행 순서를 구성하세요</div>
      )}
    </div>
  );
}
