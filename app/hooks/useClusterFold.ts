'use client';

import { useState } from 'react';

/** One cluster's fold: whether its member instances show, and the control that flips it. */
export interface ClusterFold {
  open: boolean;
  toggle: () => void;
}

/**
 * RDS cluster member lists — the fold policy every surface shares.
 *
 * A cluster that IS part of the request opens: which instance the agent connects through is
 * part of reviewing it. A cluster left OUT of the request starts folded — its members are not
 * being installed, so the list is reference, not review, and three rows of it push the rows
 * that still need a decision down the page. Pressing the chevron wins over both: an override
 * is per cluster and survives the selection changing under it.
 *
 * Call once per table, then per cluster row:
 *
 *   const clusterFold = useClusterFold();
 *   const fold = clusterFold(rowKey, resource.selected);
 *   <button aria-expanded={fold.open} onClick={fold.toggle} … />
 */
export const useClusterFold = () => {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  return (key: string, included: boolean): ClusterFold => {
    const open = overrides[key] ?? included;
    return {
      open,
      toggle: () => setOverrides((previous) => ({ ...previous, [key]: !open })),
    };
  };
};
