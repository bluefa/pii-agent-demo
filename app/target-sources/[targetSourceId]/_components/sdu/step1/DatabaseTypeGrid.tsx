'use client';

import { useState, type KeyboardEvent } from 'react';
import { CheckIcon, CloseIcon } from '@/app/components/ui/icons';
import { cn, idcStyles, inputStyles, primaryColors } from '@/lib/theme';
import { SDU_DB_TYPE_MAX, SDU_DB_TYPE_MAXLEN, type SduCloud } from '@/lib/types/sdu';
import {
  SDU_DB_TYPE_DUPLICATE_MESSAGE,
  SDU_DB_TYPE_LEN_MESSAGE,
  SDU_DB_TYPE_MAX_MESSAGE,
  sduDbTypeChoices,
} from '@/app/target-sources/[targetSourceId]/_components/sdu/step1/model';
import {
  dbGridStyles,
  fieldStyles,
  tokenStyles,
} from '@/app/target-sources/[targetSourceId]/_components/sdu/step1/styles';

export interface DatabaseTypeGridProps {
  /** 어떤 이름들을 물을지 정하는 값 — 클라우드마다 갖는 Database 가 다르다. */
  cloud: SduCloud;
  values: readonly string[];
  onChange: (next: string[]) => void;
}

/**
 * Database Type — 자주 쓰는 여섯 개는 판에서 고르고, 나머지는 직접 친다.
 *
 * 판과 칩은 **한 목록의 두 얼굴**이다. 판의 타일은 그 이름이 목록에 있으면 켜지고(대소문자는
 * 무시한다 — `sduDraftDbTypeCount` 가 같은 이름을 한 종으로 세는 것과 같은 규칙이다), 칩은
 * 판이 이름을 갖고 있지 않은 값만 그린다. 그래서 한 값은 언제나 한 자리에만 나타나고, 어느
 * 쪽에서 지우든 같은 목록에서 빠진다.
 *
 * SDU 의 `database_types` 에는 열거형이 없으므로 판은 '있는 것'의 전부가 아니라 대신 쳐 주는
 * 자리다. 그래도 이름은 지어내지 않는다 — 판이 묻는 것은 그 클라우드의 백엔드 열거형이
 * 갖는 이름들이다(`sduDbTypeChoices`). 두 상한(20개 · 50자)은 여기서도 조용히 자르지 않는다.
 */
export const DatabaseTypeGrid = ({ cloud, values, onChange }: DatabaseTypeGridProps) => {
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const choices = sduDbTypeChoices(cloud);
  const full = values.length >= SDU_DB_TYPE_MAX;
  // 길이 초과는 살아 있는 판정이다 — Enter 를 눌러 봐야 알게 두면, 50자가 넘는 이름을
  // 다 친 뒤에 지우게 된다.
  const tooLong = text.trim().length > SDU_DB_TYPE_MAXLEN;

  const has = (name: string) => values.some((value) => value.toLowerCase() === name.toLowerCase());

  /** 판에서 끄든 칩에서 지우든 같은 문. 이름으로 지우므로 대소문자만 다른 값이 남지 않는다. */
  const removeName = (name: string) => {
    onChange(values.filter((value) => value.toLowerCase() !== name.toLowerCase()));
    setMessage(null);
  };

  const toggle = (name: string) => {
    if (has(name)) {
      removeName(name);
      return;
    }
    onChange([...values, name]);
    setMessage(null);
  };

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

  // 판이 이름을 가진 값은 타일이 이미 말하고 있다 — 칩으로 한 번 더 그리면 같은 값이
  // 두 자리를 차지하고, 20개 세기가 눈으로는 두 번 세어진다.
  //
  // 뒤집어 말하면, 클라우드를 바꿔 판에서 이름이 사라진 값은 여기로 내려와 칩이 된다.
  // 자유 입력이라 그 값은 여전히 유효하고, 고른 적 있는 것을 화면이 조용히 버리지 않는다.
  const named = choices.map((type) => type.toLowerCase());
  const custom = values.filter((value) => !named.includes(value.toLowerCase()));

  return (
    <div className={dbGridStyles.root}>
      <div className={dbGridStyles.head}>
        <span className={fieldStyles.label}>Database Type</span>
        <span className={full ? fieldStyles.counterFull : fieldStyles.counter}>
          {values.length} / {SDU_DB_TYPE_MAX}
        </span>
      </div>
      <p className={cn(fieldStyles.hint, 'flex-none')}>
        목록에 없는 타입은 직접 입력할 수 있어요. 한 대상당 최대 {SDU_DB_TYPE_MAX}개, 이름은{' '}
        {SDU_DB_TYPE_MAXLEN}자까지예요.
      </p>

      <div role="group" aria-label="자주 쓰는 Database Type" className={dbGridStyles.grid}>
        {choices.map((type) => {
          const selected = has(type);
          return (
            <button
              key={type}
              type="button"
              aria-pressed={selected}
              // 상한에 닿아도 켜져 있는 타일은 눌러야 한다 — 끄는 길까지 막으면 되돌릴
              // 방법이 없다.
              disabled={full && !selected}
              onClick={() => toggle(type)}
              className={cn(
                dbGridStyles.tile,
                selected ? dbGridStyles.tileOn : dbGridStyles.tileOff,
              )}
            >
              <span
                aria-hidden="true"
                className={cn(dbGridStyles.box, selected ? dbGridStyles.boxOn : dbGridStyles.boxOff)}
              >
                {selected && <CheckIcon className="h-3 w-3" />}
              </span>
              {type}
            </button>
          );
        })}
      </div>

      <div className={dbGridStyles.foot}>
        {custom.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {custom.map((value) => (
              <li key={value} className={tokenStyles.chip}>
                {value}
                <button
                  type="button"
                  aria-label={`${value} 제거`}
                  onClick={() => removeName(value)}
                  className={tokenStyles.remove}
                >
                  <CloseIcon className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {typing ? (
          <div className={dbGridStyles.customOpen}>
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
        ) : (
          <button
            type="button"
            aria-expanded={false}
            onClick={() => setTyping(true)}
            className={dbGridStyles.customRow}
          >
            목록에 없는 타입을 쓰고 계신가요?{' '}
            <span className={cn('font-semibold', primaryColors.textOnLight)}>직접 입력 →</span>
          </button>
        )}

        {(tooLong || full || message) && (
          <p className={fieldStyles.message}>
            {tooLong ? SDU_DB_TYPE_LEN_MESSAGE : full ? SDU_DB_TYPE_MAX_MESSAGE : message}
          </p>
        )}
      </div>
    </div>
  );
};
