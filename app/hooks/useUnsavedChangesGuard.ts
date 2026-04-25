'use client';

/**
 * Guide CMS — dirty navigation guard hook.
 *
 * Spec: docs/reports/guide-cms/wave-tasks/W3-b-editor.md §Step 5 +
 * design/guide-cms/interactions.md §4.1 / §4.2.
 *
 * Centralises the three guard surfaces that fire when the editor has
 * unsaved changes:
 *   1. in-page navigation (step row / provider tab) — `requestNavigation`
 *      stages the next destination behind a confirm modal.
 *   2. browser tab close / reload — `beforeunload` raises the native
 *      dialog. Listener is only registered while `dirty === true` so
 *      pages without edits do not pay the perf cost.
 *   3. confirm acceptance — `acceptPendingNavigation` runs the staged
 *      action, clears the pending slot, and resets `dirty`.
 *
 * Callers parametrise the navigation payload via the generic `T` so
 * "select-step" and "switch-provider" can flow through the same modal
 * without an unprincipled discriminated-union baked into this hook.
 */

import { useCallback, useEffect, useState } from 'react';

export interface UseUnsavedChangesGuardResult<T> {
  /** Whether the editor currently holds unsaved changes. */
  dirty: boolean;
  /** Modal visibility — true while a navigation is staged. */
  isModalOpen: boolean;
  /** Push fresh dirty state from the editor (called via `useEffect`). */
  setDirty: (next: boolean) => void;
  /**
   * Try to navigate. Returns `true` when the caller may proceed
   * immediately (clean state); `false` when a confirm modal is opening.
   */
  requestNavigation: (payload: T, perform: (payload: T) => void) => boolean;
  /** Run the staged navigation, then reset dirty + close the modal. */
  acceptPendingNavigation: () => void;
  /** Drop the staged navigation without performing it. */
  cancelPendingNavigation: () => void;
}

interface PendingNavigation<T> {
  payload: T;
  perform: (payload: T) => void;
}

export const useUnsavedChangesGuard = <T,>(): UseUnsavedChangesGuardResult<T> => {
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<PendingNavigation<T> | null>(null);

  const requestNavigation = useCallback(
    (payload: T, perform: (payload: T) => void): boolean => {
      if (!dirty) {
        perform(payload);
        return true;
      }
      setPending({ payload, perform });
      return false;
    },
    [dirty],
  );

  const acceptPendingNavigation = useCallback(() => {
    if (!pending) return;
    pending.perform(pending.payload);
    setDirty(false);
    setPending(null);
  }, [pending]);

  const cancelPendingNavigation = useCallback(() => {
    setPending(null);
  }, []);

  // Native tab-close / reload guard — only attached while dirty so a
  // clean page does not pay the listener cost.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      // Chrome requires `returnValue` to be set; the displayed string is
      // ignored by modern browsers.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  return {
    dirty,
    isModalOpen: pending !== null,
    setDirty,
    requestNavigation,
    acceptPendingNavigation,
    cancelPendingNavigation,
  };
};
