'use client';

import { useState } from 'react';
import { CloseIcon } from '@/app/components/ui/icons';
import { RecipientPicker } from '@/app/target-sources/[targetSourceId]/_components/sdu/upload/RecipientPicker';
import {
  borderColors,
  cn,
  getButtonClass,
  stackGap,
  textColors,
  textStyles,
} from '@/lib/theme';
import type { SduRecipient } from '@/lib/types/sdu';

export interface RecipientsBlockProps {
  /** 후보 명단의 출처 — 이 대상 소스가 속한 서비스. */
  serviceCode: string;
  recipients: readonly SduRecipient[];
  onSave: (userIds: string[]) => Promise<void>;
}

const sameIds = (a: readonly SduRecipient[], b: readonly SduRecipient[]): boolean =>
  a.length === b.length && a.every((user, index) => user.id === b[index].id);

/**
 * 4-2 S3 Access Key 수신자.
 *
 * This block registers a LIST, it does not send anything. The system knows who *should*
 * receive the key, never who did — the admin mails it. That is why there is no 발송, no
 * 재발송, no 발급 이력 here: a button that claims an act the system cannot observe would be
 * the screen lying about the world.
 */
export const RecipientsBlock = ({ serviceCode, recipients, onSave }: RecipientsBlockProps) => {
  const [chosen, setChosen] = useState<SduRecipient[]>([...recipients]);
  const [saving, setSaving] = useState(false);

  const dirty = !sameIds(chosen, recipients);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(chosen.map((user) => user.id));
    } catch {
      // Reported by the card above; the local list stays as the owner left it so the edit is
      // not lost along with the request.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn('flex flex-col', stackGap.group)}>
      <p className={cn(textStyles.body, textColors.secondary)}>
        업로드에 사용할 S3 Access Key를 받으실 분을 등록해주세요. 여러 명을 등록할 수 있어요.
      </p>

      <div className={cn('flex flex-col', stackGap.related)}>
        <span className={cn(textStyles.captionStrong, textColors.secondary)}>
          수신자 {chosen.length}명
        </span>
        {chosen.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {chosen.map((user) => (
              <li
                key={user.id}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg border bg-white py-1 pl-3 pr-1.5',
                  borderColors.default,
                )}
              >
                <span className={cn(textStyles.bodyStrong, textColors.primary)}>{user.name}</span>
                {/* 이름만으로는 동명이인이 갈리지 않는다 — 칩이 이메일을 함께 진다. */}
                <span className={cn(textStyles.caption, textColors.tertiary)}>{user.email}</span>
                <button
                  type="button"
                  aria-label={`${user.name} 제거`}
                  onClick={() => setChosen((prev) => prev.filter((item) => item.id !== user.id))}
                  className={cn(
                    'inline-grid h-6 w-6 place-items-center rounded-md',
                    textColors.tertiary,
                  )}
                >
                  <CloseIcon className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <RecipientPicker
        serviceCode={serviceCode}
        chosen={chosen}
        onAdd={(user) =>
          setChosen((prev) => (prev.some((item) => item.id === user.id) ? prev : [...prev, user]))
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className={getButtonClass('primary', 'sm')}
        >
          {saving ? '저장 중...' : '수신자 저장'}
        </button>
        <span className={cn(textStyles.caption, textColors.tertiary)}>
          등록된 분들께 관리자가 메일로 S3 Access Key를 직접 전달해요. 이 화면에서 보내지는 않아요.
        </span>
      </div>
    </div>
  );
};
