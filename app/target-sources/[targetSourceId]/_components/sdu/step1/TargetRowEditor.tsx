'use client';

import { LockIcon } from '@/app/components/ui/icons';
import { useLocale } from '@/app/components/LocaleProvider';
import { cn, idcStyles, inputStyles, numericFeatures } from '@/lib/theme';
import {
  SDU_CLOUDS,
  SDU_REGION_LABEL,
  SDU_REGIONS_BY_SCOPE,
  type SduCloud,
  type SduRegionScope,
} from '@/lib/types/sdu';
import { isValidIdcIp } from '@/lib/constants/idc';
import { DatabaseTypeTagInput } from '@/app/target-sources/[targetSourceId]/_components/sdu/step1/DatabaseTypeTagInput';
import { SDU_COPY } from '@/app/target-sources/[targetSourceId]/_components/sdu/copy';
import {
  isSduDraftComplete,
  sduCloudLabels,
  type SduTargetDraft,
} from '@/app/target-sources/[targetSourceId]/_components/sdu/step1/model';
import {
  choiceChipStyles,
  fieldStyles,
  listStyles,
} from '@/app/target-sources/[targetSourceId]/_components/sdu/step1/styles';

export interface TargetRowEditorProps {
  draft: SduTargetDraft;
  scope: SduRegionScope;
  /** 1-based 목록 번호 — 접힌 행과 같은 자리를 쓴다. */
  index: number;
  onChange: (draft: SduTargetDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * 대상 한 건의 네 값. 접힌 행이 한 줄에 네 값을 다 보여주므로, 펼친 행은 그 네 값을
 * **고치는 자리**이지 다시 요약하는 자리가 아니다.
 */
export const TargetRowEditor = ({
  draft,
  scope,
  index,
  onChange,
  onSave,
  onCancel,
}: TargetRowEditorProps) => {
  const { locale } = useLocale();
  const t = SDU_COPY[locale].define;
  const cloudLabel = sduCloudLabels(t);
  const regions = SDU_REGIONS_BY_SCOPE[scope];
  const ipTouched = draft.uploadIp.trim().length > 0;
  const ipInvalid = ipTouched && !isValidIdcIp(draft.uploadIp);

  const patch = (part: Partial<SduTargetDraft>) => onChange({ ...draft, ...part });

  return (
    <div className={listStyles.editorFrame}>
      <div className={listStyles.editorHead}>
        <span className={listStyles.indexBare}>{String(index).padStart(2, '0')}</span>
        <span className={listStyles.editorTag}>{t.editing}</span>
      </div>

      <div className="mt-4 space-y-5">
        <div>
          <p className={fieldStyles.label}>{t.cloudLabel}</p>
          <p className={fieldStyles.hint}>{t.cloudHint}</p>
          <div role="radiogroup" aria-label={t.cloudAria} className="mt-2 flex flex-wrap gap-1.5">
            {SDU_CLOUDS.map((cloud: SduCloud) => {
              const selected = draft.cloud === cloud;
              return (
                <button
                  key={cloud}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => patch({ cloud })}
                  className={cn(
                    choiceChipStyles.base,
                    selected ? choiceChipStyles.on : choiceChipStyles.off,
                  )}
                >
                  {cloudLabel[cloud]}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className={fieldStyles.label}>{t.regionLabel}</p>
          {/* China 권역의 선택지는 하나뿐이다. 답이 하나인 질문을 칩으로 그리면 담당자는
              "다른 답도 있나" 하고 한 번 멈추므로, 고르는 자리를 지우고 확정된 값을 보여준다.
              누를 수 없는 칩을 남기지 않는 이유이기도 하다 — 목록 위 한 줄이 이미 어느
              권역인지 말했는데, 영영 못 누르는 칩이 그 말을 의심하게 만든다. */}
          {regions.length === 1 ? (
            <>
              <p className={fieldStyles.hint}>{t.regionFixedHint}</p>
              <p className={cn(choiceChipStyles.base, choiceChipStyles.on, 'mt-2 gap-1.5')}>
                {SDU_REGION_LABEL[regions[0]]}
                <LockIcon className="h-3.5 w-3.5" />
                <span className="text-[12px] font-semibold">{t.regionFixed}</span>
              </p>
            </>
          ) : (
            <>
              <p className={fieldStyles.hint}>{t.regionHint}</p>
              <div
                role="radiogroup"
                aria-label={t.regionAria}
                className="mt-2 flex flex-wrap gap-1.5"
              >
                {regions.map((region) => {
                  const selected = draft.region === region;
                  return (
                    <button
                      key={region}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => patch({ region })}
                      className={cn(
                        choiceChipStyles.base,
                        selected ? choiceChipStyles.on : choiceChipStyles.off,
                      )}
                    >
                      {SDU_REGION_LABEL[region]}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div>
          <label htmlFor={`sdu-upload-ip-${draft.key}`} className={fieldStyles.label}>
            {t.uploadIpLabel}
          </label>
          <p className={fieldStyles.hint}>{t.uploadIpHint}</p>
          <input
            id={`sdu-upload-ip-${draft.key}`}
            value={draft.uploadIp}
            placeholder={t.uploadIpPlaceholder}
            onChange={(event) => patch({ uploadIp: event.target.value })}
            className={cn(
              inputStyles.base,
              'mt-2 max-w-[260px]',
              numericFeatures.tabular,
              ipInvalid && inputStyles.error,
            )}
          />
          {ipInvalid && <p className={fieldStyles.message}>{t.ipInvalid}</p>}
        </div>

        <DatabaseTypeTagInput
          cloud={draft.cloud}
          values={draft.databaseTypes}
          onChange={(databaseTypes) => patch({ databaseTypes })}
        />
      </div>

      <div className={listStyles.editorFoot}>
        <button type="button" onClick={onCancel} className={idcStyles.triggerBtn.ghostSm}>
          {t.cancel}
        </button>
        <button
          type="button"
          disabled={!isSduDraftComplete(draft)}
          onClick={onSave}
          className={idcStyles.triggerBtn.primarySm}
        >
          {t.saveTarget}
        </button>
      </div>
    </div>
  );
};
