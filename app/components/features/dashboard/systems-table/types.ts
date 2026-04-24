import type { SystemDetail } from '@/app/components/features/dashboard/types';

export type SortDirection = 'asc' | 'desc' | 'none';

export interface ColumnDef {
  key: string;
  label: string;
  width: string;
  sortable: boolean;
  align?: 'left' | 'right';
  render: (row: SystemDetail) => React.ReactNode;
}
