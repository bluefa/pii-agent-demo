'use client';

/**
 * 타일의 ⋮ 가 여는 드롭다운 — 할 수 있는 일(연결/변경·해제)을 바로 보여준다.
 *
 * 예전에는 모달을 열어 그 안에서 다시 메뉴를 골랐다: 모달 안에 상태 카드와 메뉴 목록이
 * 겹쳐 층이 하나 더 생겼고, 정작 하려는 일(입력·확인)은 두 번째 화면에 있었다. 드롭다운이
 * 메뉴를 맡으면 모달은 실제 동작 하나만 담는다.
 */
import { useEffect, useRef, type ReactElement } from 'react';
import { Icon, type IconName } from '@/app/admin/pipelines/_components/icons';

const menu = {
  panel:
    'absolute right-0 top-[30px] z-20 w-[220px] overflow-hidden rounded-[10px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] py-1 shadow-[0_8px_24px_rgba(17,24,39,0.10)]',
  item: 'flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] font-medium text-[var(--pl-text-strong)] transition-colors hover:bg-[var(--pl-gray-50)]',
  itemDanger:
    'flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] font-medium text-[var(--pl-err-text)] transition-colors hover:bg-[var(--pl-err-bg)]',
  icon: 'flex-none',
} as const;

export interface JiraTicketMenuProps {
  label: string;
  onClose: () => void;
  items: ReadonlyArray<{ icon: IconName; label: string; danger?: boolean; onSelect: () => void }>;
}

export function JiraTicketMenu({ label, onClose, items }: JiraTicketMenuProps): ReactElement {
  const ref = useRef<HTMLDivElement>(null);

  // 열리면 첫 항목으로, 닫히면 ⋮ 로 포커스를 돌려준다 — 키보드 사용자가 Escape 를 눌렀을 때
  // 포커스가 body 로 떨어지면 타일 격자에서 있던 자리를 잃는다.
  useEffect(() => {
    const trigger = ref.current?.parentElement?.querySelector('button');
    ref.current?.querySelector('button')?.focus();
    return () => {
      if (trigger instanceof HTMLElement && document.activeElement === document.body) {
        trigger.focus();
      }
    };
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      // 트리거(⋮)까지 포함해서 바깥이면 닫는다 — 트리거 자신이 토글을 맡는다.
      if (!ref.current?.parentElement?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div ref={ref} role="menu" aria-label={label} className={menu.panel}>
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            item.onSelect();
          }}
          className={item.danger ? menu.itemDanger : menu.item}
        >
          <Icon name={item.icon} size="sm" className={menu.icon} />
          {item.label}
        </button>
      ))}
    </div>
  );
}
