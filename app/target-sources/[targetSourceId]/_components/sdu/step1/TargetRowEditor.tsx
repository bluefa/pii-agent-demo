'use client';

import { LockIcon } from '@/app/components/ui/icons';
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
import {
  isSduDraftComplete,
  SDU_CLOUD_LABEL,
  SDU_IP_INVALID_MESSAGE,
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
  const regions = SDU_REGIONS_BY_SCOPE[scope];
  const ipTouched = draft.uploadIp.trim().length > 0;
  const ipInvalid = ipTouched && !isValidIdcIp(draft.uploadIp);

  const patch = (part: Partial<SduTargetDraft>) => onChange({ ...draft, ...part });

  return (
    <div className={listStyles.editorFrame}>
      <div className={listStyles.editorHead}>
        <span className={listStyles.indexBare}>{String(index).padStart(2, '0')}</span>
        <span className={listStyles.editorTag}>편집 중</span>
      </div>

      <div className="mt-4 space-y-5">
        <div>
          <p className={fieldStyles.label}>데이터가 있는 클라우드</p>
          <p className={fieldStyles.hint}>
            업로드할 데이터가 원래 어디에서 운영되고 있는지예요. 연동 타입(SDU)과는 별개예요.
          </p>
          <div role="radiogroup" aria-label="클라우드" className="mt-2 flex flex-wrap gap-1.5">
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
                  {SDU_CLOUD_LABEL[cloud]}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className={fieldStyles.label}>Region</p>
          {/* China 권역의 선택지는 하나뿐이다. 답이 하나인 질문을 칩으로 그리면 담당자는
              "다른 답도 있나" 하고 한 번 멈추므로, 고르는 자리를 지우고 확정된 값을 보여준다.
              누를 수 없는 칩을 남기지 않는 이유이기도 하다 — 목록 위 한 줄이 이미 어느
              권역인지 말했는데, 영영 못 누르는 칩이 그 말을 의심하게 만든다. */}
          {regions.length === 1 ? (
            <>
              <p className={fieldStyles.hint}>
                China 권역이라 Region은 China로 고정돼요. 대상마다 다르게 고를 수 없어요.
              </p>
              <p className={cn(choiceChipStyles.base, choiceChipStyles.on, 'mt-2 gap-1.5')}>
                {SDU_REGION_LABEL[regions[0]]}
                <LockIcon className="h-3.5 w-3.5" />
                <span className="text-[12px] font-semibold">고정</span>
              </p>
            </>
          ) : (
            <>
              <p className={fieldStyles.hint}>
                업로드 경로가 갈리는 축이에요. 같은 Region을 고른 대상들은 같은 S3 경로 하나를
                함께 써요.
              </p>
              <div role="radiogroup" aria-label="Region" className="mt-2 flex flex-wrap gap-1.5">
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
            업로드 IP
          </label>
          <p className={fieldStyles.hint}>
            S3에 데이터를 올릴 때 나가는 IP 주소예요. 이 주소에서만 업로드가 허용돼요.
          </p>
          <input
            id={`sdu-upload-ip-${draft.key}`}
            value={draft.uploadIp}
            placeholder="예: 10.20.30.40"
            onChange={(event) => patch({ uploadIp: event.target.value })}
            className={cn(
              inputStyles.base,
              'mt-2 max-w-[260px]',
              numericFeatures.tabular,
              ipInvalid && inputStyles.error,
            )}
          />
          {ipInvalid && <p className={fieldStyles.message}>{SDU_IP_INVALID_MESSAGE}</p>}
        </div>

        <DatabaseTypeTagInput
          values={draft.databaseTypes}
          onChange={(databaseTypes) => patch({ databaseTypes })}
        />
      </div>

      <div className={listStyles.editorFoot}>
        <button type="button" onClick={onCancel} className={idcStyles.triggerBtn.ghostSm}>
          취소
        </button>
        <button
          type="button"
          disabled={!isSduDraftComplete(draft)}
          onClick={onSave}
          className={idcStyles.triggerBtn.primarySm}
        >
          대상 저장
        </button>
      </div>
    </div>
  );
};
