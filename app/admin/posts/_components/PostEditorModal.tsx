'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import { renderGuideAst } from '@/app/components/features/process-status/GuideCard/render-guide-ast';
import {
  createPost,
  getAdminPost,
  listAdminPostCategories,
  updatePost,
  uploadPostImage,
} from '@/app/lib/api/posts';
import {
  POST_IMAGE_ACCEPT,
  POST_IMAGE_MAX_BYTES,
  POST_IMAGE_MIME_TYPES,
  POST_IMAGE_SRC_PREFIXES,
} from '@/lib/constants/post-images';
import {
  borderColors,
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
  const [uploading, setUploading] = useState(false);
  // Sizes of images uploaded in this session, so the byte counter is live
  // while writing. The server owns every size and re-checks on save.
  const [imageBytes, setImageBytes] = useState<Map<string, number>>(new Map());

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const setBody = (value: string) => setContents({ ...contents, [lang]: value });

  /**
   * Inserts the image at the caret. Position within the body is the only
   * placement control an author has — the allow-list carries no class/style/
   * align, so alignment and sizing are not editable by design.
   */
  const insertAtCaret = (html: string) => {
    const textarea = bodyRef.current;
    const current = contents[lang];
    const at = textarea ? textarea.selectionStart : current.length;
    setContents({ ...contents, [lang]: `${current.slice(0, at)}${html}${current.slice(at)}` });
  };

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    setError(null);

    // Checked here as well as on the server: rejecting at the picker beats
    // uploading 5MB to be told no.
    if (!(POST_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
      setError('png / jpeg / webp 만 업로드할 수 있습니다');
      return;
    }
    if (file.size > POST_IMAGE_MAX_BYTES) {
      setError(`이미지 1개당 최대 ${mib(POST_IMAGE_MAX_BYTES)} 입니다`);
      return;
    }

    setUploading(true);
    try {
      const uploaded = await uploadPostImage(file);
      setImageBytes((current) => new Map(current).set(uploaded.url, file.size));
      insertAtCaret(
        `<img src="${uploaded.url}" alt="${file.name}" width="${uploaded.width}" height="${uploaded.height}" />`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '이미지 업로드에 실패했습니다');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

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

  const preview = check.valid ? check.asts[lang] : null;

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
        </div>

        <input
          value={titles[lang]}
          onChange={(event) => setTitles({ ...titles, [lang]: event.target.value })}
          placeholder={lang === 'ko' ? '한국어 제목' : 'English title'}
          className={inputStyles.base}
        />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={cn('text-xs font-medium', textColors.tertiary)}>본문 (HTML)</span>
              <div className="flex items-center gap-2">
                <span className={cn('text-xs tabular-nums', textColors.tertiary)}>
                  이미지 {check.usage.imageCount}/{POST_MAX_IMAGES} · {mib(check.usage.totalBytes)}/{mib(POST_MAX_TOTAL_BYTES)}
                </span>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || check.usage.imageCount >= POST_MAX_IMAGES}
                  className={cn(
                    'text-xs font-medium hover:underline disabled:cursor-not-allowed disabled:opacity-40',
                    textColors.secondary,
                  )}
                >
                  {uploading ? '업로드 중…' : '이미지 추가'}
                </button>
              </div>
            </div>
            <textarea
              ref={bodyRef}
              value={contents[lang]}
              onChange={(event) => setBody(event.target.value)}
              rows={16}
              placeholder="<p>본문</p>"
              className={cn(inputStyles.base, 'font-mono text-xs leading-relaxed')}
            />
            {/* Only images are uploadable; `accept` and the server MIME check
                agree, so nothing else can reach the body. */}
            <input
              ref={fileRef}
              type="file"
              accept={POST_IMAGE_ACCEPT}
              onChange={(event) => pickImage(event.target.files?.[0])}
              className="hidden"
            />
          </div>

          <div className="space-y-2">
            <span className={cn('text-xs font-medium', textColors.tertiary)}>미리보기</span>
            <div
              className={cn(
                'prose-guide h-[352px] overflow-y-auto rounded-lg border p-4 text-sm leading-relaxed',
                borderColors.default,
                textColors.secondary,
              )}
            >
              {preview ? renderGuideAst(preview) : (
                <p className={textColors.tertiary}>
                  허용되지 않은 태그가 있거나 본문이 비어 있습니다.
                </p>
              )}
            </div>
          </div>
        </div>

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
