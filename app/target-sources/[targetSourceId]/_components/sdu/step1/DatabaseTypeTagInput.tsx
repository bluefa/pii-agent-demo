'use client';

import { useState, type KeyboardEvent } from 'react';
import { CloseIcon } from '@/app/components/ui/icons';
import { cn, idcStyles, inputStyles } from '@/lib/theme';
import { SDU_DB_TYPE_MAX, SDU_DB_TYPE_MAXLEN } from '@/lib/types/sdu';
import {
  SDU_DB_TYPE_DUPLICATE_MESSAGE,
  SDU_DB_TYPE_LEN_MESSAGE,
  SDU_DB_TYPE_MAX_MESSAGE,
  SDU_QUICK_DB_TYPES,
} from '@/app/target-sources/[targetSourceId]/_components/sdu/step1/model';
import {
  fieldStyles,
  tokenStyles,
} from '@/app/target-sources/[targetSourceId]/_components/sdu/step1/styles';

export interface DatabaseTypeTagInputProps {
  values: readonly string[];
  onChange: (next: string[]) => void;
}

/**
 * Database Type — 전부 자유 입력이다. 계약에 열거형이 없으므로 화면도 "목록에 있는 것"과
 * "지어낸 것"을 구분하지 않는다: 자주 쓰는 타입 줄은 고르는 자리가 아니라 **대신 쳐 주는**
 * 자리라, 들어간 값은 직접 친 값과 같은 토큰이 된다.
 *
 * 두 상한(20개 · 50자)은 조용히 자르지 않고 말한다. 서버도 같은 규칙으로 400 을 돌려주지만
 * (lib/bff/mock/sdu.ts), 자유 입력을 허용한 순간 오타로 만든 이름이 목록을 채우기 때문에
 * 사용자는 저장을 눌러 보기 전에 상한에 닿았다는 사실과 지울 수 있는 상태를 함께 봐야 한다.
 */
export const DatabaseTypeTagInput = ({ values, onChange }: DatabaseTypeTagInputProps) => {
  const [text, setText] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const full = values.length >= SDU_DB_TYPE_MAX;
  // 길이 초과는 살아 있는 판정이다 — Enter 를 눌러 봐야 알게 두면, 50자가 넘는 이름을
  // 다 친 뒤에 지우게 된다.
  const tooLong = text.trim().length > SDU_DB_TYPE_MAXLEN;

  /**
   * 후보들을 한 번에 받는다. 한 건씩 `onChange` 를 부르면 두 번째 호출이 첫 번째가
   * 만든 배열이 아니라 이 렌더의 `values` 위에 쌓여, 쉼표로 붙여 넣은 값 중 마지막
   * 하나만 남는다.
   *
   * 거절된 값은 입력칸으로 돌려보낸다 — 무엇이 거절됐는지는 사유 한 줄만으로는
   * 알 수 없고, 다시 치게 만들 이유도 없다.
   */
  const addAll = (candidates: readonly string[]) => {
    const next = [...values];
    const rejected: string[] = [];
    let error: string | null = null;

    for (const candidate of candidates) {
      const value = candidate.trim();
      if (!value) continue;
      const reason =
        value.length > SDU_DB_TYPE_MAXLEN
          ? SDU_DB_TYPE_LEN_MESSAGE
          : next.length >= SDU_DB_TYPE_MAX
            ? SDU_DB_TYPE_MAX_MESSAGE
            : next.some((existing) => existing.toLowerCase() === value.toLowerCase())
              ? SDU_DB_TYPE_DUPLICATE_MESSAGE
              : null;
      if (reason) {
        error ??= reason;
        rejected.push(value);
        continue;
      }
      next.push(value);
    }

    if (next.length !== values.length) onChange(next);
    setMessage(error);
    return rejected;
  };

  const commitTyped = () => setText(addAll(text.split(',')).join(', '));

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' && event.key !== ',') return;
    event.preventDefault();
    commitTyped();
  };

  const remove = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
    setMessage(null);
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className={fieldStyles.label}>Database Type</span>
        <span className={full ? fieldStyles.counterFull : fieldStyles.counter}>
          {values.length} / {SDU_DB_TYPE_MAX}
        </span>
      </div>
      <p className={fieldStyles.hint}>
        목록에 없는 타입은 직접 입력할 수 있어요. 한 대상당 최대 {SDU_DB_TYPE_MAX}개, 이름은{' '}
        {SDU_DB_TYPE_MAXLEN}자까지예요.
      </p>

      {values.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {values.map((value, index) => (
            <li key={value} className={tokenStyles.chip}>
              {value}
              <button
                type="button"
                aria-label={`${value} 제거`}
                onClick={() => remove(index)}
                className={tokenStyles.remove}
              >
                <CloseIcon className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2.5 flex items-center gap-2">
        <input
          value={text}
          disabled={full}
          aria-label="Database Type 직접 입력"
          placeholder="직접 입력 (예: CUBRID)"
          onChange={(event) => {
            setText(event.target.value);
            setMessage(null);
          }}
          onKeyDown={onKeyDown}
          className={cn(
            inputStyles.base,
            'max-w-[260px] disabled:cursor-not-allowed disabled:opacity-60',
            tooLong && inputStyles.error,
          )}
        />
        <button
          type="button"
          disabled={full || tooLong || !text.trim()}
          onClick={commitTyped}
          className={idcStyles.triggerBtn.ghostSm}
        >
          추가
        </button>
        {text.trim().length > 0 && (
          <span className={tooLong ? fieldStyles.counterFull : fieldStyles.counter}>
            {text.trim().length} / {SDU_DB_TYPE_MAXLEN}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={tokenStyles.quickLabel}>자주 쓰는 타입</span>
        {SDU_QUICK_DB_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            disabled={full || values.some((value) => value.toLowerCase() === type.toLowerCase())}
            onClick={() => addAll([type])}
            className={tokenStyles.quickChip}
          >
            {type}
          </button>
        ))}
      </div>

      {(tooLong || full || message) && (
        <p className={fieldStyles.message}>
          {tooLong ? SDU_DB_TYPE_LEN_MESSAGE : full ? SDU_DB_TYPE_MAX_MESSAGE : message}
        </p>
      )}
    </div>
  );
};
