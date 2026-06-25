/**
 * Typed shapes for `bff.confirm` methods (ADR-011).
 *
 * ADR-019: TS-CORE wire types migrated to zod-codegen (schemas.X); only the
 * approval request body type remains here (still used by APPROVAL domain).
 */
export type { ApprovalRequestCreateBody } from '@/lib/approval-bff';
