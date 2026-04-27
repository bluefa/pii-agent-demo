/**
 * Guide CMS — visible-text predicate for the save gate.
 *
 * Mirrors the BFF rule that `validateGuideHtml` enforces: an entry counts
 * as "has content" only when at least one allow-listed node carries
 * visible text. Tiptap serializes an empty editor as `<p></p>`, which a
 * naive `html.trim().length > 0` would treat as filled — sending such a
 * request to the BFF results in `GUIDE_CONTENT_INVALID` (EMPTY_CONTENT).
 *
 * Other validation errors (e.g. DISALLOWED_TAG from a paste) leave the
 * caller free to attempt save and surface the BFF's specific error —
 * this helper only answers "is the body non-empty?".
 */
import { validateGuideHtml } from '@/lib/utils/validate-guide-html';

export const hasGuideContent = (html: string): boolean => {
  const result = validateGuideHtml(html);
  if (result.valid) return true;
  return !result.errors.some((err) => err.code === 'EMPTY_CONTENT');
};
