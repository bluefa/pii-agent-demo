'use client';

import { useEffect, useRef, useState } from 'react';
import { cn, mgmtGroupStyles } from '@/lib/theme';

interface ManagementSplitButtonProps {
  onPrimary: () => void;
  onViewDetail: () => void;
  onDelete: () => void;
}

const GEAR_ICON = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
  </svg>
);

const KEBAB_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="19" r="1" />
  </svg>
);

export const ManagementSplitButton = ({
  onPrimary,
  onViewDetail,
  onDelete,
}: ManagementSplitButtonProps) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const handlePrimary = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPrimary();
  };

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((prev) => !prev);
  };

  const handleViewDetail = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    onViewDetail();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    onDelete();
  };

  return (
    <div ref={wrapRef} className="relative inline-flex items-stretch">
      <button
        type="button"
        onClick={handlePrimary}
        className={cn(
          mgmtGroupStyles.primary,
          'px-3.5 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity',
        )}
      >
        {GEAR_ICON}
        관리
      </button>
      <button
        type="button"
        onClick={handleToggleMenu}
        aria-label="관리 메뉴 열기"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          mgmtGroupStyles.more,
          'px-2 py-1.5 inline-grid place-items-center hover:opacity-90 transition-opacity',
        )}
      >
        {KEBAB_ICON}
      </button>
      {open && (
        <div role="menu" className={cn(mgmtGroupStyles.menu, 'p-1 text-left')}>
          <button
            type="button"
            role="menuitem"
            onClick={handleViewDetail}
            className="block w-full text-left px-3 py-2 text-xs font-medium text-gray-700 rounded-md hover:bg-gray-50"
          >
            상세 보기
          </button>
          <div className="h-px bg-gray-100 my-1" />
          <button
            type="button"
            role="menuitem"
            onClick={handleDelete}
            className="block w-full text-left px-3 py-2 text-xs font-medium text-red-600 rounded-md hover:bg-red-50"
          >
            인프라 삭제
          </button>
        </div>
      )}
    </div>
  );
};
