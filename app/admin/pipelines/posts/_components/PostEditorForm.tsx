'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/components/ui/Button';
import {
  PostBodyEditor,
  type LocalPostImage,
} from '@/app/admin/pipelines/posts/_components/PostBodyEditor';
import {
  createPost,
  getAdminPost,
  listAdminPostCategories,
  updatePost,
} from '@/app/lib/api/posts';
import { EDITOR_IMAGE_SRC_PREFIXES } from '@/lib/constants/post-images';
import { passRoutes } from '@/lib/routes';
import {
  cn,
  postFormStyles,
  postStyles,
  segmentedControlStyles,
  statusColors,
} from '@/lib/theme';
import type {
  AdminPostCategory,
  LocalizedText,
  PostImagePart,
  PostType,
} from '@/lib/types/post';
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
  // 본문 이미지의 크기. 로컬 이미지(blob:)는 고른 파일에서, 기존 이미지(URL)는 수정
  // 진입 응답의 `images` 에서 온다 — 기존 이미지 바이트는 그 응답만이 안다(§3.6).
  const [imageBytes, setImageBytes] = useState<Map<string, number>>(new Map());
  // 저장 전 이미지의 장부: blob URL → { cid 키, 파일 }. 문서에서 지워져도 장부에는
  // 남는데 무해하다 — 저장은 문서에 살아 있는 참조만 파트로 싣는다.
  const localImages = useRef(new Map<string, { key: string; file: File }>());

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
        setImageBytes(new Map(post.images.map((image) => [image.url, image.bytes])));
        setLoaded(true);
      })
      .catch(() => setError('게시글을 불러오지 못했습니다'));
  }, [postId]);

  // blob: 미리보기는 문서가 아니라 브라우저 메모리에 산다 — 화면을 떠날 때 걷는다.
  useEffect(() => {
    const registry = localImages.current;
    return () => {
      for (const url of registry.keys()) URL.revokeObjectURL(url);
    };
  }, []);

  // 서버가 저장 때 돌리는 것과 같은 계산 — 카운터와 거부가 어긋날 수 없다.
  // prefix 만 에디터용이다: 새 이미지는 저장 전까지 blob: 미리보기로 살아 있다.
  const check = useMemo(
    () => validatePostContent({
      contents,
      imageSrcPrefixes: EDITOR_IMAGE_SRC_PREFIXES,
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

  const trackLocalImage = useCallback(({ url, key, file }: LocalPostImage) => {
    localImages.current.set(url, { key, file });
    setImageBytes((current) => new Map(current).set(url, file.size));
  }, []);

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
      // 저장 직전에야 blob: 이 cid: 가 된다 (handoff §3.2). 문서에 살아 있는
      // 이미지만 파트로 실리고, 지웠거나 실행 취소로 사라진 이미지는 참조가 없어
      // 자연히 빠진다. 기존 이미지의 URL 은 그대로 나간다 — 서버가 소유로 판정한다.
      const parts = new Map<string, PostImagePart>();
      const toWire = (html: string): string =>
        html.replace(/src="(blob:[^"]+)"/g, (match, url: string) => {
          const local = localImages.current.get(url);
          if (!local) return match;
          parts.set(local.key, { key: local.key, file: local.file });
          return `src="cid:${local.key}"`;
        });
      const wire: LocalizedText = { ko: toWire(contents.ko), en: toWire(contents.en) };
      const files = [...parts.values()];

      // PUT 은 전체 교체다 — 건드리지 않은 언어도 그대로 다시 보낸다.
      if (postId === undefined) {
        await createPost({ type, categoryId, titles, contents: wire }, files);
      } else {
        await updatePost(postId, { categoryId, titles, contents: wire }, files);
      }
      router.push(passRoutes.adminPosts);
      router.refresh();
    } catch (cause) {
      // 실패해도 폼과 로컬 이미지는 그대로다 — 재시도가 바이트를 다시 보낸다.
      setError(cause instanceof Error ? cause.message : '저장에 실패했습니다');
      setSaving(false);
    }
  };

  return (
    <div className={postStyles.sectionPage}>
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
            {/* 수정에서는 유형을 바꿀 수 없다 — 계약이 type 변경을 지원하지 않는다.
                justify-self-start: grid 칸은 기본이 stretch 라 `inline-flex` 컨테이너가
                열 전체(700px+)로 늘어나고, 버튼 두 개가 그 안 왼쪽 끝에 몰린다. */}
            <div className={cn(segmentedControlStyles.container, 'justify-self-start')}>
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
              // max-w: `w-60` 은 `input` 의 `w-full` 과 같은 속성이라 클래스 순서가
              // 아니라 생성된 CSS 순서가 이기고, 늘 `w-full` 이 이겼다.
              className={cn(postFormStyles.input, 'max-w-60')}
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
                  onLocalImage={trackLocalImage}
                  onError={setError}
                  remainingImages={POST_MAX_IMAGES - check.usage.imageCount}
                />
              )}
              <p className={postFormStyles.hint}>
                png · jpeg · webp / 파일 1개당 5MB 이하. 붙여넣기와 끌어놓기로도 넣을 수
                있으며, 이미지는 저장할 때 함께 올라갑니다.
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
