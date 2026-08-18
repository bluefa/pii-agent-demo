import { Node } from '@tiptap/core';

/**
 * Body image node for the post editor.
 *
 * Not `@tiptap/extension-image`: that extension is not installed, and the
 * allow-list here is four attributes wide (`src` `alt` `width` `height`) —
 * anything it added would have to be configured back off. The allow-list is
 * the spec, so the node is written to it directly.
 *
 * `draggable` is what lets an author move a picture: ProseMirror drags a
 * draggable node to a new position in the document. Position within the body
 * is the only placement control the contract gives an author — there is no
 * `class`/`style`/`align` for alignment or resizing, by design.
 */
export const PostImage = Node.create({
  name: 'postImage',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: '' },
      // Intrinsic pixel size from the upload response. Kept so the box is
      // reserved before the bytes arrive; display width belongs to CSS.
      width: { default: null },
      height: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'img[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', HTMLAttributes];
  },
});
