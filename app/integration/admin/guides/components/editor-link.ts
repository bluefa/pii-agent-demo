/**
 * Guide CMS — link helpers shared by the editor toolbar and prompt modal.
 *
 * Mirrors the URL scheme allow-list in `lib/utils/validate-guide-html.ts`.
 * Kept as a local module (not imported across `lib/`) so the dynamic
 * import of the editor surface from `page.tsx` keeps Tiptap chunked.
 */

import type { Editor } from '@tiptap/core';

export const LINK_HREF_SCHEME_RE = /^(https?:\/\/|mailto:|\/(?!\/))/;

export const isAllowedLinkHref = (href: string): boolean =>
  LINK_HREF_SCHEME_RE.test(href);

/**
 * Reads the `href` attribute of the link mark at the current selection.
 * Returns an empty string when nothing is linked or the value is not a
 * string — guards against the `unknown` shape Tiptap exposes for marks.
 */
export const getSelectedLinkHref = (editor: Editor | null): string => {
  if (!editor) return '';
  const attrs: Record<string, unknown> = editor.getAttributes('link');
  const href = attrs.href;
  return typeof href === 'string' ? href : '';
};
