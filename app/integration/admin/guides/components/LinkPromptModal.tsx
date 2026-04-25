'use client';

/**
 * Guide CMS — link insertion modal for the editor toolbar.
 *
 * Spec: docs/reports/guide-cms/wave-tasks/W3-b-editor.md §Step 2 +
 * design/guide-cms/components.md §4.
 *
 * Mounted only while the prompt is open (toolbar gates with
 * `isOpen ? <LinkPromptModal /> : null`). That gives a fresh component
 * instance per open, so `useState(initialHref)` seeds lazily without a
 * "reset state inside an effect" anti-pattern.
 */

import { useEffect, useRef, useState } from 'react';

import { Button } from '@/app/components/ui/Button';
import { Modal } from '@/app/components/ui/Modal';
import { cn, inputStyles, textColors } from '@/lib/theme';

import { isAllowedLinkHref } from '@/app/integration/admin/guides/components/editor-link';

interface LinkPromptModalProps {
  initialHref: string;
  onSubmit: (href: string) => void;
  onUnset: () => void;
  onClose: () => void;
}

export const LinkPromptModal = ({
  initialHref,
  onSubmit,
  onUnset,
  onClose,
}: LinkPromptModalProps) => {
  const [value, setValue] = useState(initialHref);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input on mount. Modal's enter animation can steal focus
  // back to the dialog container — defer focus to the next macrotask.
  useEffect(() => {
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, []);

  const handleSubmit = (): void => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      onUnset();
      onClose();
      return;
    }
    if (!isAllowedLinkHref(trimmed)) {
      setError('https://, mailto:, 또는 /로 시작해야 합니다.');
      return;
    }
    onSubmit(trimmed);
    onClose();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="링크 삽입"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={handleSubmit}>확인</Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className={cn('block text-sm font-medium', textColors.secondary)}>
          URL
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="https://example.com"
            className={cn('mt-1', inputStyles.base, error && inputStyles.error)}
          />
        </label>
        {error && (
          <p className={cn('text-xs', textColors.tertiary)} role="alert">{error}</p>
        )}
        <p className={cn('text-xs', textColors.quaternary)}>
          빈 문자열로 저장하면 링크가 해제됩니다.
        </p>
      </div>
    </Modal>
  );
};
