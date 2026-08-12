'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import { PostBodyEditor } from '@/app/admin/posts/_components/PostBodyEditor';
import {
  createPost,
  getAdminPost,
  listAdminPostCategories,
  updatePost,
} from '@/app/lib/api/posts';
import { POST_IMAGE_SRC_PREFIXES } from '@/lib/constants/post-images';
import {
  cn,
  inputStyles,
  segmentedControlStyles,
  statusColors,
  textColors,
} from '@/lib/theme';
import type { AdminPostCategory, LocalizedText, PostType } from '@/lib/types/post';
import {
  POST_MAX_IMAGES,
  POST_MAX_TOTAL_BYTES,
  validatePostContent,
  type PostLanguage,
} from '@/lib/utils/validate-post-content';

interface PostEditorModalProps {
  type: PostType;
  /** undefined = 등록, number = 수정. */
  postId?: number;
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY: LocalizedText = { ko: '', en: '' };

const mib = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)}MB`;

export const PostEditorModal = ({ type, postId, onClose, onSaved }: PostEditorModalProps) => {
  const [lang, setLang] = useState<PostLanguage>('ko');
  const [titles, setTitles] = useState<LocalizedText>(EMPTY);
  const [contents, setContents] = useState<LocalizedText>(EMPTY);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categories, setCategories] = useState<AdminPostCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(postId === undefined);
  // Sizes of images uploaded in this session, so the byte counter is live
  // while writing. The server owns every size and re-checks on save.
  const [imageBytes, setImageBytes] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    listAdminPostCategories(type).then(setCategories).catch(() => setCategories([]));
  }, [type]);

  useEffect(() => {
    if (postId === undefined) return;
    getAdminPost(postId)
      .then((post) => {
        setTitles(post.titles);
        setContents(post.contents);
        setCategoryId(post.categoryId);
        setLoaded(true);
      })
      .catch(() => setError('게시글을 불러오지 못했습니다'));
  }, [postId]);

  // Same calculation the server runs on save, so the counter and the rejection
  // can never disagree about how full the post is.
  const check = useMemo(
    () => validatePostContent({
      contents,
      imageSrcPrefixes: POST_IMAGE_SRC_PREFIXES,
      imageBytesByUrl: imageBytes,
    }),
    [contents, imageBytes],
  );

  const overLimit = check.usage.imageCount > POST_MAX_IMAGES
    || check.usage.totalBytes > POST_MAX_TOTAL_BYTES;

  const setBody = useCallback(
    (html: string) => setContents((current) => ({ ...current, [lang]: html })),
    [lang],
  );

  const trackImage = useCallback(
    (url: string, bytes: number) =>
      setImageBytes((current) => new Map(current).set(url, bytes)),
    [],
  );

  const save = async () => {
    if (saving) return;
    setError(null);

    if (titles.ko.trim() === '' || titles.en.trim() === '') {
      setError('제목은 한국어 · 영어 모두 필요합니다');
      return;
    }
    if (!check.valid) {
      setError(check.errors[0].message);
      return;
    }

    setSaving(true);
    try {
      // PUT is a full replacement — every localized value goes back, including
      // the language that was not touched.
      if (postId === undefined) {
        await createPost({ type, categoryId, titles, contents });
      } else {
        await updatePost(postId, { categoryId, titles, contents });
      }
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={postId === undefined ? '게시글 등록' : '게시글 수정'}
      subtitle={type === 'NOTICE' ? '공지사항' : 'FAQ'}
      size="2xl"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className={segmentedControlStyles.container}>
            {(['ko', 'en'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setLang(value)}
                // nowrap: without it the flex row squeezes the inactive tab and
                // "한국어" breaks one syllable per line.
                className={cn(
                  segmentedControlStyles.item,
                  'whitespace-nowrap',
                  lang === value && segmentedControlStyles.itemActive,
                )}
              >
                {value === 'ko' ? '한국어' : 'English'}
              </button>
            ))}
          </div>

          <select
            value={categoryId ?? ''}
            onChange={(event) => setCategoryId(event.target.value ? Number(event.target.value) : null)}
            className={cn(inputStyles.base, 'w-48 py-2')}
          >
            <option value="">미분류</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>

          <span className="flex-1" />

          <span className={cn('text-xs tabular-nums', textColors.tertiary)}>
            이미지 {check.usage.imageCount}/{POST_MAX_IMAGES} · {mib(check.usage.totalBytes)}/{mib(POST_MAX_TOTAL_BYTES)}
          </span>
        </div>

        <input
          value={titles[lang]}
          onChange={(event) => setTitles({ ...titles, [lang]: event.target.value })}
          placeholder={lang === 'ko' ? '한국어 제목' : 'English title'}
          className={inputStyles.base}
        />

        {/* Keyed on language so switching tabs remounts the editor with that
            language's body. One instance swapping its own content needs sync
            logic in both directions; a remount needs none. `loaded` keeps an
            edit from mounting the editor on empty content and then having the
            fetch arrive — the editor would keep the empty document it started
            with and the first keystroke would save it. */}
        {loaded && (
          <PostBodyEditor
            key={lang}
            value={contents[lang]}
            onChange={setBody}
            onImageUploaded={trackImage}
            onError={setError}
            imagesFull={check.usage.imageCount >= POST_MAX_IMAGES}
          />
        )}

        {error && <p className={cn('text-sm', statusColors.error.textDark)}>{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button onClick={save} disabled={saving || overLimit}>
            {saving ? '저장 중…' : '저장'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
