/**
 * Tests for `useUnsavedChangesGuard` (W3-b §Step 5).
 *
 * Vitest runs in a node env (no jsdom), so we cannot exercise state
 * transitions through React's effect cycle. The hook's clean-path
 * behaviour (dirty=false → perform runs immediately) is observable on
 * the first render via a wrapper component, which is sufficient to
 * pin the contract surface that `GuidesPage` depends on.
 */

import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { useUnsavedChangesGuard } from '@/app/hooks/useUnsavedChangesGuard';

interface ProbePayload {
  destination: string;
}

interface ProbeProps {
  onMount: (api: {
    dirty: boolean;
    isModalOpen: boolean;
    requestNavigation: (
      payload: ProbePayload,
      perform: (payload: ProbePayload) => void,
    ) => boolean;
  }) => void;
}

const Probe = ({ onMount }: ProbeProps) => {
  const guard = useUnsavedChangesGuard<ProbePayload>();
  onMount({
    dirty: guard.dirty,
    isModalOpen: guard.isModalOpen,
    requestNavigation: guard.requestNavigation,
  });
  return null;
};

describe('useUnsavedChangesGuard — initial state', () => {
  it('starts dirty=false and modal closed', () => {
    let captured: { dirty: boolean; isModalOpen: boolean } | null = null;
    renderToStaticMarkup(
      <Probe
        onMount={(api) => {
          captured = { dirty: api.dirty, isModalOpen: api.isModalOpen };
        }}
      />,
    );
    expect(captured).toEqual({ dirty: false, isModalOpen: false });
  });
});

describe('useUnsavedChangesGuard — clean path', () => {
  it('runs `perform` immediately and returns true when not dirty', () => {
    const perform = vi.fn();
    let result: boolean | null = null;

    renderToStaticMarkup(
      <Probe
        onMount={(api) => {
          result = api.requestNavigation({ destination: '/guides/aws' }, perform);
        }}
      />,
    );

    expect(result).toBe(true);
    expect(perform).toHaveBeenCalledTimes(1);
    expect(perform).toHaveBeenCalledWith({ destination: '/guides/aws' });
  });
});
