'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/components/ui/Button';
import { PostBodyEditor } from '@/app/admin/posts/_components/PostBodyEditor';
import {
  createPost,
  getAdminPost,
  listAdminPostCategories,
  updatePost,
} from '@/app/lib/api/posts';
import { POST_IMAGE_SRC_PREFIXES } from '@/lib/constants/post-images';
import { passRoutes } from '@/lib/routes';
import {
  cn,
  postFormStyles,
  postStyles,
  segmentedControlStyles,
  statusColors,
} from '@/lib/theme';
import type { AdminPostCategory, LocalizedText, PostType } from '@/lib/types/post';
import {
  POST_MAX_IMAGES,
  POST_MAX_TOTAL_BYTES,
  validatePostContent,
  type PostLanguage,
} from '@/lib/utils/validate-post-content';

interface PostEditorFormProps {
  /** 등록일 때의 유형. 수정에서는 불러온 게시글의 유형이 이긴다(type 변경 불가). */
  type: PostType;
  /** undefined = 등록, number = 수정. */
  postId?: number;
}

const EMPTY: LocalizedText = { ko: '', en: '' };

const mib = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)}MB`;

const LANG_LABEL: Record<PostLanguage, string> = { ko: '한국어', en: 'English' };

export const PostEditorForm = ({ type: initialType, postId }: PostEditorFormProps) => {
  const router = useRouter();
  const [type, setType] = useState<PostType>(initialType);
  const [lang, setLang] = useState<PostLanguage>('ko');
  const [titles, setTitles] = useState<LocalizedText>(EMPTY);
  const [contents, setContents] = useState<LocalizedText>(EMPTY);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categories, setCategories] = useState<AdminPostCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(postId === undefined);
  // 이번 세션에 올린 이미지의 크기. 서버가 모든 크기의 주인이고 저장 때 다시 검사한다.
  const [imageBytes, setImageBytes] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    listAdminPostCategories(type).then(setCategories).catch(() => setCategories([]));
  }, [type]);

  useEffect(() => {
    if (postId === undefined) return;
    getAdminPost(postId)
      .then((post) => {
        setType(post.type);
        setTitles(post.titles);
        setContents(post.contents);
        setCategoryId(post.categoryId);
        setLoaded(true);
      })
      .catch(() => setError('게시글을 불러오지 못했습니다'));
  }, [postId]);

  // 서버가 저장 때 돌리는 것과 같은 계산 — 카운터와 거부가 어긋날 수 없다.
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

  const written = (value: PostLanguage): boolean =>
    titles[value].trim() !== '' && contents[value].replace(/<[^>]*>/g, '').trim() !== '';

  const setBody = useCallback(
    (html: string) => setContents((current) => ({ ...current, [lang]: html })),
    [lang],
  );

  const trackImage = useCallback(
    (url: string, bytes: number) => setImageBytes((current) => new Map(current).set(url, bytes)),
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
      // PUT 은 전체 교체다 — 건드리지 않은 언어도 그대로 다시 보낸다.
      if (postId === undefined) {
        await createPost({ type, categoryId, titles, contents });
      } else {
        await updatePost(postId, { categoryId, titles, contents });
      }
      router.push(passRoutes.adminPosts);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '저장에 실패했습니다');
      setSaving(false);
    }
  };

  return (
    <div className={postStyles.page}>
      <div>
        <h1 className={postStyles.pageTitle}>
          {postId === undefined ? '게시글 등록' : '게시글 수정'}
        </h1>
        <p className={postStyles.pageSub}>
          {type === 'NOTICE' ? '공지사항' : 'FAQ'} · 한국어와 영어를 모두 작성해야 저장됩니다.
        </p>
      </div>

      <div className={postFormStyles.card}>
        <div className={postFormStyles.section}>
          <div className={postFormStyles.grid}>
            <span className={postFormStyles.label}>
              유형<span className={postFormStyles.required}>*</span>
            </span>
            {/* 수정에서는 유형을 바꿀 수 없다 — 계약이 type 변경을 지원하지 않는다. */}
            <div className={segmentedControlStyles.container}>
              {(['NOTICE', 'FAQ'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={postId !== undefined}
                  onClick={() => setType(value)}
                  className={cn(
                    segmentedControlStyles.item,
                    'whitespace-nowrap disabled:cursor-not-allowed',
                    type === value && segmentedControlStyles.itemActive,
                  )}
                >
                  {value === 'NOTICE' ? '공지사항' : 'FAQ'}
                </button>
              ))}
            </div>

            <span className={postFormStyles.label}>Category</span>
            <select
              value={categoryId ?? ''}
              onChange={(event) =>
                setCategoryId(event.target.value ? Number(event.target.value) : null)}
              className={cn(postFormStyles.input, 'w-60')}
            >
              <option value="">미분류</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={postFormStyles.section}>
          <div className="flex items-center gap-2.5">
            <div className={segmentedControlStyles.container}>
              {(['ko', 'en'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLang(value)}
                  // nowrap: 없으면 flex 행이 비활성 탭을 눌러 "한국어"가 음절마다 줄바꿈된다.
                  className={cn(
                    segmentedControlStyles.item,
                    'whitespace-nowrap',
                    lang === value && segmentedControlStyles.itemActive,
                  )}
                >
                  {LANG_LABEL[value]}
                </button>
              ))}
            </div>
            {(['ko', 'en'] as const).map((value) => (
              <span
                key={value}
                className={cn(
                  postFormStyles.langState,
                  written(value) ? postFormStyles.langDone : postFormStyles.langTodo,
                )}
              >
                {LANG_LABEL[value]} {written(value) ? '작성됨' : '미작성'}
              </span>
            ))}
          </div>
          <p className={postFormStyles.hint}>
            네 값(Title ko/en · 본문 ko/en)이 모두 채워져야 저장됩니다. 언어별 fallback은 없습니다.
          </p>
        </div>

        <div className={postFormStyles.section}>
          <div className={postFormStyles.grid}>
            <span className={postFormStyles.label}>
              Title ({LANG_LABEL[lang]})<span className={postFormStyles.required}>*</span>
            </span>
            <input
              value={titles[lang]}
              onChange={(event) => setTitles({ ...titles, [lang]: event.target.value })}
              className={postFormStyles.input}
            />
          </div>
        </div>

        <div className={postFormStyles.section}>
          <div className={postFormStyles.grid}>
            <span className={postFormStyles.label}>
              본문 ({LANG_LABEL[lang]})<span className={postFormStyles.required}>*</span>
            </span>
            <div>
              {/* 언어로 key 를 걸어 탭을 바꾸면 에디터가 그 언어의 본문으로 다시 마운트된다.
                  한 인스턴스가 내용을 스스로 갈아끼우면 양방향 동기화가 필요하지만
                  리마운트는 아무것도 필요 없다. */}
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
              <p className={postFormStyles.hint}>
                png · jpeg · webp / 파일 1개당 5MB 이하. 붙여넣기와 끌어놓기로도 올라갑니다.
                <br />
                정렬·크기 조절은 없습니다 — 조정할 수 있는 것은 문단 사이 <b>위치</b>뿐입니다.
                <br />
                이미지 {check.usage.imageCount}/{POST_MAX_IMAGES} · {mib(check.usage.totalBytes)}/{mib(POST_MAX_TOTAL_BYTES)}
              </p>
            </div>
          </div>
        </div>

        <div className={postFormStyles.foot}>
          {error && <span className={cn(postFormStyles.footWarn, statusColors.error.textDark)}>{error}</span>}
          <Button variant="secondary" onClick={() => router.push(passRoutes.adminPosts)}>
            취소
          </Button>
          <Button onClick={save} disabled={saving || overLimit}>
            {saving ? '저장 중…' : '저장'}
          </Button>
        </div>
      </div>
    </div>
  );
};
