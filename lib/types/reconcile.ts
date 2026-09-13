/**
 * One row's answer when the approval snapshot and the confirmed record are read as one list.
 *
 * It lives here, not beside the screen that computes it: the two tables that render the
 * column are shared surfaces (`WaitingApprovalTable`, the admin `IdcResourceTable`), and a
 * shared component may not import a type out of one feature folder to describe a cell.
 */
export type ReconcileVerdict =
  /** In the approval AND in the confirmed record. */
  | 'match'
  /** Approved (selected) but absent from the confirmed record. */
  | 'missingConfirmed'
  /** Confirmed but absent from the approved selection. */
  | 'missingApproved';
