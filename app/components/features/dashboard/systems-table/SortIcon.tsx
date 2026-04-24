'use client';

import type { SortDirection } from './types';

// TODO(wave15-H1): migrate inline SVG to icons module
export const SortIcon = ({ direction }: { direction: SortDirection }) => {
  if (direction === 'none') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="ml-1">
        <path d="M6 2L9 5H3L6 2Z" fill="#d1d5db" />
        <path d="M6 10L3 7H9L6 10Z" fill="#d1d5db" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="ml-1">
      {direction === 'asc' ? (
        <path d="M6 2L9 7H3L6 2Z" fill="#0064FF" />
      ) : (
        <path d="M6 10L3 5H9L6 10Z" fill="#0064FF" />
      )}
    </svg>
  );
};
