'use client';

import { useCallback, useRef, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { PostImage } from '@/app/admin/pipelines/posts/_components/post-image-node';
import { uploadPostImage } from '@/app/lib/api/posts';
import {
  POST_IMAGE_ACCEPT,
  POST_IMAGE_MAX_BYTES,
  POST_IMAGE_MIME_TYPES,
} from '@/lib/constants/post-images';
import { bgColors, borderColors, cn, primaryColors, textColors } from '@/lib/theme';
import type { ImageUploadResponse } from '@/lib/types/post';

interface PostBodyEditorProps {
  /** Initial HTML. The parent remounts this component per language. */
  value: string;
  onChange: (html: string) => void;
  /** An image finished uploading — the parent tracks its size for the counter. */
  onImageUploaded: (url: string, bytes: number) => void;
  onError: (message: string | null) => void;
  /** Blocks the image controls once the post is at its image limit. */
  imagesFull: boolean;
}

/**
 * Post body editor.
 *
 * Uses the Tiptap already in package.json (it arrived for the Guide CMS editor,
 * whose CSS is in globals.css, but no component ever used it).
 *
 * The toolbar is the allow-list made visible: every StarterKit node the
 * contract does not permit is switched off, so the editor cannot produce
 * markup the save would reject. Strike and underline are off for that reason —
 * they are not in the allow-list — and headings are h4 only.
 */
export const PostBodyEditor = ({
  value,
  onChange,
  onImageUploaded,
  onError,
  imagesFull,
}: PostBodyEditorProps) => {
  const fileRef = useRef<HTMLInputElement>(null);
  // handlePaste/handleDrop are built once, before `editor` exists; the ref is
  // how they reach the live instance.
  const editorRef = useRef<Editor | null>(null);
  const [uploading, setUploading] = useState(false);

  /**
   * Rejects at the picker what the server would reject anyway — uploading 5MB
   * to be told no is worse than being stopped before the bytes leave.
   * Returns the URL, or null when the file did not qualify.
   */
  const upload = useCallback(async (file: File): Promise<ImageUploadResponse | null> => {
    if (!(POST_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
      onError('png / jpeg / webp 만 업로드할 수 있습니다');
      return null;
    }
    if (file.size > POST_IMAGE_MAX_BYTES) {
      onError('이미지 1개당 최대 5MB 입니다');
      return null;
    }

    setUploading(true);
    onError(null);
    try {
      const uploaded = await uploadPostImage(file);
      onImageUploaded(uploaded.url, file.size);
      return uploaded;
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : '이미지 업로드에 실패했습니다');
      return null;
    } finally {
      setUploading(false);
    }
  }, [onError, onImageUploaded]);

  const insertImage = useCallback(async (file: File, at?: number) => {
    const uploaded = await upload(file);
    const editor = editorRef.current;
    if (!uploaded || !editor) return;

    const chain = editor.chain().focus();
    // `at` comes from a drop — the picture lands where it was dropped rather
    // than wherever the caret happened to be.
    if (at !== undefined) chain.setTextSelection(at);
    chain.insertContent({
      type: 'postImage',
      // width/height are the upload's intrinsic size. They reserve the box
      // before the bytes arrive, which is why the reader's list does not jump
      // as images load; CSS still owns the displayed width.
      attrs: {
        src: uploaded.url,
        alt: file.name,
        width: uploaded.width,
        height: uploaded.height,
      },
    }).run();
  }, [upload]);

  const editor = useEditor({
    // Next renders this on the server first; without it Tiptap warns and can
    // mismatch hydration.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Off: not in the body allow-list (h4 p br ul ol li strong em code a img).
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        // h4 is the only heading the contract allows.
        heading: { levels: [4] },
        link: {
          openOnClick: false,
          // Matches the href rule: http(s), mailto, and site-relative only.
          protocols: ['http', 'https', 'mailto'],
        },
      }),
      PostImage,
    ],
    content: value,
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
    editorProps: {
      attributes: { class: 'prose-guide' },
      handlePaste: (_view, event) => {
        const file = [...(event.clipboardData?.files ?? [])][0];
        if (!file) return false;
        // A pasted screenshot is the common case — Cmd+Shift+4, Cmd+V.
        event.preventDefault();
        void insertImage(file);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        // `moved` means ProseMirror is relocating a node already in the
        // document — that is the drag-to-reposition path, and it must be left
        // alone. Only an external file drop is an upload.
        if (moved) return false;
        const dragEvent = event as DragEvent;
        const file = [...(dragEvent.dataTransfer?.files ?? [])][0];
        if (!file) return false;

        event.preventDefault();
        const at = view.posAtCoords({ left: dragEvent.clientX, top: dragEvent.clientY })?.pos;
        void insertImage(file, at);
        return true;
      },
    },
  });

  editorRef.current = editor;

  if (!editor) return <div className={cn('h-[340px] rounded-lg border', borderColors.default)} />;

  const toolButton = (label: string, isActive: boolean, onClick: () => void, title: string) => (
    <button
      key={label}
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'rounded-md px-2 py-1 text-xs font-medium transition-colors',
        isActive
          ? cn(primaryColors.bgLight, primaryColors.textOnLight)
          // 툴바가 `muted` 면이라 hover 도 한 칸 더 내려가야 보인다.
          : cn(textColors.secondary, bgColors.panelHover),
      )}
    >
      {label}
    </button>
  );

  return (
    <div className={cn('overflow-hidden rounded-lg border', borderColors.default)}>
      {/* 툴바는 글 쓰는 면이 아니다 — 면과 테두리로 그렇게 말한다. 투명한 채로
          두면 첫 줄 위에 글자 몇 개가 떠 있는 것으로 읽힌다. */}
      <div
        className={cn(
          'flex flex-wrap items-center gap-1 border-b px-2.5 py-2',
          borderColors.default,
          bgColors.muted,
        )}
      >
        {toolButton('제목', editor.isActive('heading', { level: 4 }),
          () => editor.chain().focus().toggleHeading({ level: 4 }).run(), '제목 (h4)')}
        {toolButton('B', editor.isActive('bold'),
          () => editor.chain().focus().toggleBold().run(), '굵게')}
        {toolButton('I', editor.isActive('italic'),
          () => editor.chain().focus().toggleItalic().run(), '기울임')}
        {toolButton('code', editor.isActive('code'),
          () => editor.chain().focus().toggleCode().run(), '코드')}

        <span className={cn('mx-1 h-4 w-px', bgColors.divider)} />

        {toolButton('• 목록', editor.isActive('bulletList'),
          () => editor.chain().focus().toggleBulletList().run(), '글머리 목록')}
        {toolButton('1. 목록', editor.isActive('orderedList'),
          () => editor.chain().focus().toggleOrderedList().run(), '번호 목록')}

        <span className={cn('mx-1 h-4 w-px', bgColors.divider)} />

        {toolButton('링크', editor.isActive('link'), () => {
          if (editor.isActive('link')) {
            editor.chain().focus().unsetLink().run();
            return;
          }
          const href = window.prompt('링크 주소 (http, https, mailto, /경로)');
          if (href) editor.chain().focus().setLink({ href }).run();
        }, '링크')}

        <span className={cn('mx-1 h-4 w-px', bgColors.divider)} />

        {/* 툴바 오른쪽 끝으로 밀지 않는다 — 본문 칸이 700px 을 넘으면 나머지
            서식과 한 화면 거리만큼 떨어져서 같은 줄에 있다는 것만으로는
            같은 도구로 읽히지 않는다. 흰 면과 테두리가 대신 구분한다. */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || imagesFull}
          className={cn(
            'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
            'disabled:cursor-not-allowed disabled:opacity-40',
            borderColors.default,
            bgColors.surface,
            primaryColors.textOnLight,
            bgColors.panelHover,
          )}
        >
          {uploading ? '업로드 중…' : '이미지'}
        </button>
      </div>

      {/* `.guide-editor-surface` already carries the min-height and the inline
          href display; it was written for this editor and never used.
          The text colour is declared here rather than inherited: `.prose-guide`
          only colours h4/strong/a, so body text left to inherit renders at
          whatever the modal passes down — which read as washed-out grey. */}
      <div
        className={cn(
          'guide-editor-surface max-h-[340px] overflow-y-auto px-4 py-3 text-sm',
          textColors.primary,
        )}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Only images are uploadable — `accept` and the server MIME check agree. */}
      <input
        ref={fileRef}
        type="file"
        accept={POST_IMAGE_ACCEPT}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void insertImage(file);
          event.target.value = '';
        }}
        className="hidden"
      />
    </div>
  );
};
