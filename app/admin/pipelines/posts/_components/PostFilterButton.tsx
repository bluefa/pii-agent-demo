'use client';

import { useEffect, useRef, useState } from 'react';
import { cn, postStyles } from '@/lib/theme';

/** 노출 상태 필터. `undefined` = 전체. */
export type VisibilityFilter = 'visible' | 'hidden' | undefined;

interface PostFilterButtonProps {
  categories: string[];
  category: string | undefined;
  visibility: VisibilityFilter;
  onCategory: (value: string | undefined) => void;
  onVisibility: (value: VisibilityFilter) => void;
}

/**
 * 필터 아이콘 + 팝오버 (`design/notice-faq/notice-faq-screens.html` `.icon-btn` / `.filter-pop`).
 *
 * 아이콘만으로는 "지금 뭔가 걸려 있다"를 말할 수 없어서 활성 개수를 닷으로 얹는다.
 */
export const PostFilterButton = ({
  categories,
  category,
  visibility,
  onCategory,
  onVisibility,
}: PostFilterButtonProps) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const activeCount = (category ? 1 : 0) + (visibility ? 1 : 0);

  // 바깥 클릭으로 닫는다. pointerdown 인 이유: click 은 팝오버 안의 칩을 누른 뒤에
  // 올라오기도 해서, 고르자마자 닫히는 순서 문제가 생긴다.
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  const chip = (label: string, on: boolean, onClick: () => void) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      className={cn(postStyles.filterChip, on && postStyles.filterChipOn)}
    >
      {label}
    </button>
  );

  return (
    <div ref={wrapRef} className="contents">
      <button
        type="button"
        aria-expanded={open}
        aria-label="필터"
        onClick={() => setOpen((value) => !value)}
        className={cn(postStyles.iconBtn, open && postStyles.iconBtnOn)}
      >
        <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5" fill="none"
             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3Z" />
        </svg>
        {activeCount > 0 && <span className={postStyles.iconBtnDot}>{activeCount}</span>}
      </button>

      {open && (
        <div className={postStyles.filterPop}>
          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-bold tracking-[0.02em] text-[#4E5968]">Category</span>
            <div className="flex flex-wrap gap-1.5">
              {chip('전체', category === undefined, () => onCategory(undefined))}
              {categories.map((name) => chip(name, category === name, () => onCategory(name)))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-bold tracking-[0.02em] text-[#4E5968]">노출 상태</span>
            <div className="flex flex-wrap gap-1.5">
              {chip('전체', visibility === undefined, () => onVisibility(undefined))}
              {chip('노출', visibility === 'visible', () => onVisibility('visible'))}
              {chip('숨김', visibility === 'hidden', () => onVisibility('hidden'))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
