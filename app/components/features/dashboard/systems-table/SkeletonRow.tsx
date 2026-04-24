'use client';

import { columns } from './columns';

export const SkeletonRow = () => (
  <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
    {columns.map((col) => (
      <td key={col.key} className="px-5 py-4">
        <div
          className="h-4 rounded animate-pulse"
          style={{ width: '60%', backgroundColor: '#f3f4f6' }}
        />
      </td>
    ))}
  </tr>
);
