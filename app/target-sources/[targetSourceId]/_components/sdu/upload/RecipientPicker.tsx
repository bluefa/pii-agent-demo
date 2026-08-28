'use client';

import { useState } from 'react';
import { getPermissions } from '@/app/lib/api';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import {
  borderColors,
  cn,
  primaryColors,
  stackGap,
  textColors,
  textStyles,
} from '@/lib/theme';
import type { SduRecipient } from '@/lib/types/sdu';

/**
 * `/services/{code}/authorized-users` answers with `id · name · email`, every field optional
 * in the generated schema. A row missing one of the three cannot be registered (the id is
 * what is written, the email is what tells two 김도현 apart), so it is dropped rather than
 * half-rendered.
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
  /** The service this target source belongs to — the list is its 담당자, nothing wider. */
  serviceCode: string;
  /** Already registered — they are struck from the list rather than offered twice. */
  chosen: readonly SduRecipient[];
  onAdd: (user: SduRecipient) => void;
}

/**
 * 수신자 선택. Nothing is typed by hand and nothing is searched: the candidates are exactly
 * the service's 담당자, so the whole set is drawn at once. A free-text email field would mail
 * the key to a typo and nobody would find out; a directory search would offer people who have
 * no business holding this service's key.
 */
export const RecipientPicker = ({ serviceCode, chosen, onAdd }: RecipientPickerProps) => {
  const [owners, setOwners] = useState<SduRecipient[] | null>(null);
  const [failed, setFailed] = useState(false);

  useAbortableEffect(
    (signal) => {
      // `getPermissions` takes no signal, so the response cannot be cancelled — it is
      // discarded instead.
      return getPermissions(serviceCode)
        .then((response) => {
          if (signal.aborted) return;
          setOwners(toRecipients(response.users));
        })
        .catch(() => {
          if (signal.aborted) return;
          // A failure drawn as "담당자가 없어요" would read as "이 서비스엔 아무도 없다" and
          // the owner would stop looking for someone who exists.
          setFailed(true);
          setOwners(null);
        });
    },
    [serviceCode],
  );

  const chosenIds = new Set(chosen.map((user) => user.id));
  const offered = (owners ?? []).filter((user) => !chosenIds.has(user.id));

  return (
    <div className={cn('flex flex-col', stackGap.related)}>
      <span className={cn(textStyles.captionStrong, textColors.secondary)}>서비스 담당자</span>

      <div className={cn('overflow-hidden rounded-lg border', borderColors.default)}>
        {failed ? (
          <p className={cn('px-4 py-3', textStyles.body, textColors.secondary)}>
            담당자를 불러오지 못했어요. 잠시 후 다시 시도해주세요.
          </p>
        ) : owners === null ? (
          <p aria-busy="true" className={cn('px-4 py-3', textStyles.body, textColors.tertiary)}>
            불러오는 중이에요
          </p>
        ) : offered.length === 0 ? (
          <p className={cn('px-4 py-3', textStyles.body, textColors.tertiary)}>
            {owners.length === 0 ? '등록된 담당자가 없어요' : '담당자를 모두 등록했어요'}
          </p>
        ) : (
          <div className="max-h-[220px] overflow-y-auto">
            {offered.map((user, index) => (
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
            ))}
          </div>
        )}
      </div>

      <p className={cn(textStyles.caption, textColors.tertiary)}>
        이 서비스의 담당자만 S3 Access Key를 받을 수 있어요. 담당자 추가는 접근 권한 화면에서 해주세요.
      </p>
    </div>
  );
};
