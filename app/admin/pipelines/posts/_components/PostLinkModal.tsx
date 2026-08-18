'use client';

import { useState } from 'react';
import { getMarkRange } from '@tiptap/core';
import type { Editor } from '@tiptap/react';
import { Button } from '@/app/components/ui/Button';
import { Modal } from '@/app/components/ui/Modal';
import { cn, postFormStyles, statusColors, textColors } from '@/lib/theme';
import { isAllowedHref, normalizeHref } from '@/lib/utils/validate-guide-html';

interface PostLinkModalProps {
  editor: Editor;
  onClose: () => void;
}

/**
 * 링크가 바뀌는 유일한 자리.
 *
 * 링크에는 값이 둘이다 — 화면에 보이는 글자와 주소. 그런데 본문에서는 글자만 만질 수
 * 있고 주소는 보이지도 않아서, 둘을 맞추려면 한쪽은 본문에서 고치고 한쪽은 다른 데서
 * 고쳐야 했다. 두 값을 한 칸씩 나란히 놓으면 그 왕복이 사라진다.
 *
 * 본문 쪽 링크 글자는 잠겨 있다(`PostBodyEditor` 의 입력 가드). 그래서 이 모달이
 * 링크를 바꾸는 유일한 경로다.
 */
export const PostLinkModal = ({ editor, onClose }: PostLinkModalProps) => {
  // 열릴 때 한 번만 읽는다. 모달이 떠 있는 동안 본문은 아무도 건드리지 않으므로
  // 여기서 잡아 둔 범위는 닫을 때까지 유효하다.
  const [target] = useState(() => {
    const { state } = editor;
    // 캐럿이 링크 안이면 그 링크 전체가 대상이다 — 글자 일부만 바꾸는 편집은 없다.
    const range = getMarkRange(state.selection.$from, state.schema.marks.link);
    const from = range?.from ?? state.selection.from;
    const to = range?.to ?? state.selection.to;
    return {
      from,
      to,
      text: state.doc.textBetween(from, to),
      href: String(editor.getAttributes('link').href ?? ''),
    };
  });

  const [text, setText] = useState(target.text);
  const [href, setHref] = useState(target.href);
  const [error, setError] = useState<string | null>(null);

  const apply = () => {
    if (href.trim() === '') {
      setError('주소를 입력해 주세요');
      return;
    }
    const value = normalizeHref(href);
    if (!isAllowedHref(value)) {
      setError('http · https · mailto · /경로 만 넣을 수 있습니다');
      return;
    }
    // 글자를 비워 두면 주소가 곧 글자다 — 빈 링크는 누를 수도, 볼 수도 없다.
    const label = text.trim() === '' ? value : text;
    editor
      .chain()
      .focus()
      .insertContentAt(
        { from: target.from, to: target.to },
        { type: 'text', text: label, marks: [{ type: 'link', attrs: { href: value } }] },
      )
      .run();
    onClose();
  };

  const field = (
    label: string,
    value: string,
    onChange: (next: string) => void,
    placeholder: string,
    autoFocus: boolean,
  ) => (
    <label className="flex flex-col gap-2">
      <span className={postFormStyles.label}>{label}</span>
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => {
          onChange(event.target.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            apply();
          }
        }}
        placeholder={placeholder}
        className={postFormStyles.input}
      />
    </label>
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="링크"
      subtitle={target.href === '' ? '새 링크' : '링크 수정'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={apply}>적용</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* 글자가 먼저다 — 읽는 사람이 보는 것이 글자고, 주소는 그 뒤에 숨는다. */}
        {field('링크 텍스트', text, setText, '예: 릴리스 노트', target.text === '')}
        {field('주소', href, setHref, 'https://… 또는 /경로', target.text !== '')}

        {error ? (
          <p role="alert" className={cn('text-sm', statusColors.error.textDark)}>
            {error}
          </p>
        ) : (
          <p className={cn('text-sm', textColors.tertiary)}>
            본문에서는 링크 글자를 고칠 수 없습니다. 이 창이 링크를 바꾸는 유일한 곳입니다.
          </p>
        )}
      </div>
    </Modal>
  );
};
