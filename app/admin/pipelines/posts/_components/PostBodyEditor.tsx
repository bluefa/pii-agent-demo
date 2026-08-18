'use client';

import { useCallback, useRef, useState } from 'react';
import { getMarkRange } from '@tiptap/core';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import type { EditorState } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import { PostImage } from '@/app/admin/pipelines/posts/_components/post-image-node';
import { PostImageBubble } from '@/app/admin/pipelines/posts/_components/PostImageBubble';
import { PostLinkBubble } from '@/app/admin/pipelines/posts/_components/PostLinkBubble';
import { PostLinkModal } from '@/app/admin/pipelines/posts/_components/PostLinkModal';
import { uploadPostImage } from '@/app/lib/api/posts';
import {
  POST_IMAGE_ACCEPT,
  POST_IMAGE_MAX_BYTES,
  POST_IMAGE_MIME_TYPES,
} from '@/lib/constants/post-images';
import { bgColors, borderColors, cn, primaryColors, textColors } from '@/lib/theme';
import type { ImageUploadResponse } from '@/lib/types/post';

/**
 * 이 편집이 링크 글자를 건드리는가 — 그렇다면 막는다. 링크는 모달에서만 바뀐다.
 *
 * 링크 "전체"를 덮는 범위는 통과시킨다. 링크를 포함한 문장을 골라 지우는 것은 링크를
 * 고치는 게 아니라 버리는 것이고, 그것까지 막으면 지워지지 않는 글자가 생긴다.
 */
const editsLinkText = (state: EditorState, from: number, to: number): boolean => {
  if (from < 0 || to > state.doc.content.size) return false;
  const range = getMarkRange(state.doc.resolve(from), state.schema.marks.link);
  if (!range) return false;
  // 끼워 넣기는 안쪽일 때만 막는다 — 경계(링크 앞/뒤)에 치는 글자는 링크가 아니다.
  if (from === to) return range.from < from && from < range.to;
  return range.from <= from && to <= range.to && !(from === range.from && to === range.to);
};

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
  const [linkModal, setLinkModal] = useState(false);

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
          // 자동 링크는 끈다. 두 가지가 걸려 있다. 하나는 눈에 보이는 것 —
          // 도메인처럼 생긴 글자를 치면 링크가 저절로 생겨서, 모달 밖에서 링크가
          // 만들어진다. 다른 하나는 안 보이는 쪽인데 이게 더 크다: Link 마크의
          // `inclusive` 가 이 옵션을 그대로 돌려준다(`inclusive() { return
          // this.options.autolink }`). 켜져 있으면 마크가 포함형이라 링크 끝에
          // 이어 친 글자가 링크 안으로 빨려 들어간다.
          autolink: false,
        },
      }),
      PostImage,
    ],
    content: value,
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
    editorProps: {
      attributes: { class: 'prose-guide' },
      // Cmd/Ctrl+K — 링크를 다루는 자리에서 손이 먼저 가는 키다.
      handleKeyDown: (view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
          event.preventDefault();
          setLinkModal(true);
          return true;
        }
        // 지우는 방향에 따라 없어질 글자가 다르다. 캐럿이 링크 바로 뒤에 있을 때의
        // Backspace 는 링크의 마지막 글자를 먹고, 링크 바로 앞에서의 Delete 는
        // 첫 글자를 먹는다 — 둘 다 캐럿 자신은 링크 밖에 있다.
        const { empty, from, to } = view.state.selection;
        if (event.key === 'Backspace') {
          return editsLinkText(view.state, empty ? from - 1 : from, to);
        }
        if (event.key === 'Delete') {
          return editsLinkText(view.state, from, empty ? to + 1 : to);
        }
        return false;
      },
      handleTextInput: (view, from, to) => editsLinkText(view.state, from, to),
      handlePaste: (view, event) => {
        const { from, to } = view.state.selection;
        if (editsLinkText(view.state, from, to)) return true;

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

  /**
   * 툴바가 켜져 보여야 하는 것들.
   *
   * v3 의 `useEditor` 는 트랜잭션마다 다시 그리지 않는다(v2 에서 뒤집힌 기본값). 그래서
   * `editor.isActive(...)` 를 렌더 중에 그냥 읽으면 마운트 시점의 답이 그대로 굳는다 —
   * 굵은 글씨 안에 캐럿을 놓아도 B 가 켜지지 않는다. 반대로 `shouldRerenderOnTransaction`
   * 을 켜면 BubbleMenu 가 렌더마다 위치 갱신 트랜잭션을 날리므로 렌더→디스패치→렌더로
   * 무한 루프가 난다(실제로 "Maximum update depth exceeded" 로 화면이 죽었다).
   * 값이 바뀔 때만 다시 그리는 이 구독이 두 함정을 다 피한다.
   */
  const active = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      heading: instance?.isActive('heading', { level: 4 }) ?? false,
      bold: instance?.isActive('bold') ?? false,
      italic: instance?.isActive('italic') ?? false,
      code: instance?.isActive('code') ?? false,
      bulletList: instance?.isActive('bulletList') ?? false,
      orderedList: instance?.isActive('orderedList') ?? false,
      link: instance?.isActive('link') ?? false,
    }),
  });

  editorRef.current = editor;

  if (!editor || !active) {
    return <div className={cn('h-[340px] rounded-lg border', borderColors.default)} />;
  }

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
        {toolButton('제목', active.heading,
          () => editor.chain().focus().toggleHeading({ level: 4 }).run(), '제목 (h4)')}
        {toolButton('B', active.bold,
          () => editor.chain().focus().toggleBold().run(), '굵게')}
        {toolButton('I', active.italic,
          () => editor.chain().focus().toggleItalic().run(), '기울임')}
        {toolButton('code', active.code,
          () => editor.chain().focus().toggleCode().run(), '코드')}

        <span className={cn('mx-1 h-4 w-px', bgColors.divider)} />

        {toolButton('• 목록', active.bulletList,
          () => editor.chain().focus().toggleBulletList().run(), '글머리 목록')}
        {toolButton('1. 목록', active.orderedList,
          () => editor.chain().focus().toggleOrderedList().run(), '번호 목록')}

        <span className={cn('mx-1 h-4 w-px', bgColors.divider)} />

        {/* 링크 위에서 눌러도 해제가 아니라 편집이다 — 같은 버튼이 두 가지 일을
            하면 주소를 고치려던 사람이 링크를 잃는다. 해제는 버블 안에 있다. */}
        {toolButton('링크', active.link, () => setLinkModal(true), '링크 (⌘K)')}

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
        {/* 모달이 떠 있는 동안은 띠를 걷는다 — 안 그러면 백드롭 뒤에 흐릿하게 남아
            떠다닌다. `shouldShow` 를 false 로 돌리는 걸로는 사라지지 않는다:
            BubbleMenu 는 선택이나 문서가 바뀐 트랜잭션에서만 그걸 다시 부른다. */}
        {!linkModal && <PostLinkBubble editor={editor} onEdit={() => setLinkModal(true)} />}
        <PostImageBubble editor={editor} />
      </div>

      {linkModal && (
        <PostLinkModal
          editor={editor}
          onClose={() => {
            setLinkModal(false);
            // 모달이 떨어져 나가면서 focus 가 body 로 떨어진다 — 링크 하나 넣을 때마다
            // 본문을 다시 클릭하게 된다. React 가 언마운트를 커밋한 뒤라야 도로
            // 가져올 수 있어서 매크로태스크로 미룬다. `editor.commands.focus()` 는
            // `view.hasFocus()` 면 그냥 반환하는데, 그 판정이 이 순간과 엇갈린다.
            window.setTimeout(() => editor.view.focus(), 0);
          }}
        />
      )}

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
