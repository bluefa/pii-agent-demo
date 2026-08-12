'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import {
  createPostCategory,
  deletePostCategory,
  listAdminPostCategories,
} from '@/app/lib/api/posts';
import { borderColors, cn, inputStyles, statusColors, textColors } from '@/lib/theme';
import type { AdminPostCategory, PostType } from '@/lib/types/post';

interface CategoryModalProps {
  type: PostType;
  onClose: () => void;
  /** Categories changed — the editor's select needs to reload. */
  onChanged: () => void;
}

/**
 * Category 관리.
 *
 * Creation lives in a modal rather than inline on the board: it is a rare
 * action, and the board's job is the post list.
 */
export const CategoryModal = ({ type, onClose, onChanged }: CategoryModalProps) => {
  const [categories, setCategories] = useState<AdminPostCategory[] | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = () => {
    listAdminPostCategories(type)
      .then(setCategories)
      .catch(() => setCategories([]));
  };

  useEffect(reload, [type]);

  const submit = async () => {
    if (name.trim() === '' || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createPostCategory({ type, name: name.trim() });
      setName('');
      reload();
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Category 생성에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (category: AdminPostCategory) => {
    setError(null);
    try {
      await deletePostCategory(category.id);
      reload();
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Category 삭제에 실패했습니다');
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Category 관리"
      subtitle={type === 'NOTICE' ? '공지사항' : 'FAQ'}
      size="md"
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') void submit(); }}
            placeholder="새 Category 이름"
            className={cn(inputStyles.base, 'flex-1')}
          />
          <Button onClick={submit} disabled={busy || name.trim() === ''}>
            추가
          </Button>
        </div>

        {error && <p className={cn('text-sm', statusColors.error.textDark)}>{error}</p>}

        <ul className={cn('divide-y rounded-lg border', borderColors.default)}>
          {categories?.length === 0 && (
            <li className={cn('px-4 py-6 text-center text-sm', textColors.tertiary)}>
              등록된 Category 가 없습니다.
            </li>
          )}
          {categories?.map((category) => (
            <li key={category.id} className="flex items-center gap-3 px-4 py-3">
              <span className={cn('flex-1 text-sm font-medium', textColors.primary)}>
                {category.name}
              </span>
              <span className={cn('text-xs tabular-nums', textColors.tertiary)}>
                게시글 {category.postCount}
              </span>
              {/* Deletion needs zero remaining posts — hidden ones count too,
                  so hiding everything does not unlock the button. */}
              <button
                type="button"
                onClick={() => remove(category)}
                disabled={category.postCount > 0}
                title={category.postCount > 0 ? '잔여 게시글이 있어 삭제할 수 없습니다' : '삭제'}
                className={cn(
                  'text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40',
                  textColors.tertiary,
                  'hover:underline',
                )}
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
};
