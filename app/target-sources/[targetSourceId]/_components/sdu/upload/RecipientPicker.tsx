'use client';

import { useState } from 'react';
import { searchUsers } from '@/app/lib/api';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { useDebounce } from '@/app/hooks/useDebounce';
import { SearchIcon } from '@/app/components/ui/icons';
import {
  borderColors,
  cn,
  getInputClass,
  primaryColors,
  stackGap,
  textColors,
  textStyles,
} from '@/lib/theme';
import type { SduRecipient } from '@/lib/types/sdu';

const SEARCH_DEBOUNCE_MS = 250;

/**
 * `/users/search` answers with `id · name · email`, every field optional in the generated
 * schema. A row missing one of the three cannot be registered (the id is what is written,
 * the email is what tells two 김도현 apart), so it is dropped rather than half-rendered.
 */
const toRecipients = (
  users: readonly { id?: string | null; name?: string | null; email?: string | null }[] | null | undefined,
): SduRecipient[] =>
  (users ?? []).flatMap((user) =>
    user.id && user.name && user.email
      ? [{ id: user.id, name: user.name, email: user.email }]
      : [],
  );

export interface RecipientPickerProps {
  /** Already registered — the contract's `excludeIds` exists exactly for this. */
  chosen: readonly SduRecipient[];
  onAdd: (user: SduRecipient) => void;
}

/**
 * 수신자 검색. Nothing is typed by hand: a free-text email field means the admin mails the
 * key to a typo and nobody finds out. An empty query shows nothing — this is a picker for
 * someone the owner already has in mind, not a directory browser.
 */
export const RecipientPicker = ({ chosen, onAdd }: RecipientPickerProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SduRecipient[] | null>(null);
  const [failed, setFailed] = useState(false);
  const debounced = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS);

  // Arrays are a new reference every render; the deps key is the CONTENT, and the request is
  // rebuilt from that same key so the two cannot drift apart.
  const excludeKey = chosen.map((user) => user.id).join(',');

  useAbortableEffect(
    (signal) => {
      if (!debounced) {
        setResults(null);
        setFailed(false);
        return;
      }
      setFailed(false);
      // `searchUsers` takes no signal, so the response cannot be cancelled — it is discarded
      // instead. Either way a stale answer never lands on a newer query.
      return searchUsers(debounced, excludeKey ? excludeKey.split(',') : [])
        .then((response) => {
          if (signal.aborted) return;
          setResults(toRecipients(response.users));
        })
        .catch(() => {
          if (signal.aborted) return;
          // A failure drawn as "결과 없음" would read as "그런 사람은 없다" and the owner
          // would stop looking for someone who exists.
          setFailed(true);
          setResults(null);
        });
    },
    [debounced, excludeKey],
  );

  return (
    <div className={cn('flex flex-col', stackGap.related)}>
      <div className="relative">
        <SearchIcon
          aria-hidden
          className={cn('pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2', textColors.quaternary)}
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="수신자 검색"
          placeholder="이름 또는 이메일로 검색"
          className={cn(getInputClass(), 'pl-11')}
        />
      </div>

      {debounced && (
        <div className={cn('overflow-hidden rounded-lg border', borderColors.default)}>
          {failed ? (
            <p className={cn('px-4 py-3', textStyles.body, textColors.secondary)}>
              검색에 실패했어요. 잠시 후 다시 시도해주세요.
            </p>
          ) : results === null ? (
            <p aria-busy="true" className={cn('px-4 py-3', textStyles.body, textColors.tertiary)}>
              찾는 중이에요
            </p>
          ) : results.length === 0 ? (
            <p className={cn('px-4 py-3', textStyles.body, textColors.tertiary)}>
              검색 결과가 없어요
            </p>
          ) : (
            results.map((user, index) => (
              <div
                key={user.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5',
                  index > 0 && cn('border-t', borderColors.light),
                )}
              >
                <span className={cn(textStyles.bodyStrong, textColors.primary)}>{user.name}</span>
                <span className={cn('min-w-0 flex-1 truncate', textStyles.caption, textColors.tertiary)}>
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={() => onAdd(user)}
                  className={cn(
                    'flex-shrink-0 rounded-md px-2 py-1 text-[12px] font-bold',
                    primaryColors.textOnLight,
                    primaryColors.bgLightActive,
                  )}
                >
                  추가
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <p className={cn(textStyles.caption, textColors.tertiary)}>
        이름 또는 이메일로 검색해주세요. 이미 등록한 분은 결과에 나오지 않아요.
      </p>
    </div>
  );
};
