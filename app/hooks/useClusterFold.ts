'use client';

import { useState } from 'react';

/** One cluster's fold: whether its member instances show, and the control that flips it. */
export interface ClusterFold {
  open: boolean;
  toggle: () => void;
}

/**
 * A per-key fold with a CALLER-SUPPLIED default, and a press that overrides it.
 *
 * The default is the caller's because each surface derives it differently, and they no longer
 * agree — the name is historical:
 *
 *   WaitingApprovalTable   `false`. Every cluster starts folded on steps 2·3·4·6·7 (owner,
 *                          2026-08-23); "open it if it is in the request" opened most of the
 *                          page, three member rows at a time.
 *   CloudResourceTable     `row.selected` — the original policy, kept for the admin queue.
 *   CandidateResourceTable Athena GROUPS, not clusters: open when a selection exists and some
 *                          selected row still owes an exclusion reason, so the CTA never names
 *                          a resource behind a shut disclosure.
 *
 * Each call site gets its own `useState`, so nothing is shared between them but the shape.
 * Pressing the chevron wins over whatever default was passed, per key, and survives that
 * default changing underneath.
 *
 * Call once per table, then per row:
 *
 *   const clusterFold = useClusterFold();
 *   const fold = clusterFold(rowKey, false);
 *   <button aria-expanded={fold.open} onClick={fold.toggle} … />
 */
export const useClusterFold = () => {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  return (key: string, included: boolean): ClusterFold => ({
    open: overrides[key] ?? included,
    // Flips what the UPDATER holds, not what this render closed over: two presses batched into
    // one commit would otherwise both write the same value and the second would be a no-op.
    toggle: () =>
      setOverrides((previous) => ({ ...previous, [key]: !(previous[key] ?? included) })),
  });
};
