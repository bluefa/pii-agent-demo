'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { idcStyles } from '@/lib/theme';

/** 값이 아니라 말줄임표만 남기 시작하는 폭 — 이보다 좁아지면 열이 있으나 마나다. */
const MIN_COLUMN_WIDTH = 56;

/** 키보드 한 번에 움직이는 폭. 한 글자보다는 크고, 한 번에 열이 사라지지는 않는 정도. */
const KEY_STEP = 16;

export interface ColumnResizeOptions {
  /**
   * Cap expansion at the column's longest rendered value (owner decision, benchmark
   * round 3): widening past the content only manufactures blank space. Also arms
   * double-click on the handle to jump straight to that width — the "reveal
   * everything" gesture. The cap is measured from the live cells at gesture start,
   * so it follows whatever filtering/pagination currently shows.
   */
  clampToContent?: boolean;
  /**
   * Versioned localStorage key (e.g. `pii:colw:v1:confirmed-resources`). Widths
   * hydrate after mount — a lazy initializer would make server and client markup
   * disagree on every sized `<th>` — and each change is written back; `reset()`
   * clears both. Omit for modal tables whose widths may die with the modal.
   */
  storageKey?: string;
}

export interface ColumnResize {
  /** `<th>` 에 그대로 붙이는 style. 아직 건드리지 않은 열은 undefined — 기본 폭은 클래스가 소유한다. */
  widthOf: (key: string) => { width: number } | undefined;
  /** 헤더 오른쪽 끝 손잡이의 props. 감싸는 `<th>` 는 `relative` 나 `sticky` 여야 한다. */
  handleProps: (key: string, label: string) => HTMLAttributes<HTMLSpanElement>;
  /** Back to the class-owned defaults; clears the stored widths too. */
  reset: () => void;
}

/**
 * The width at which nothing in the column is ellipsized: the current width plus the
 * widest hidden overflow among the column's cells. A truncating descendant clips
 * itself, so the td's own scrollWidth cannot see the loss — the delta is read element
 * by element. When nothing is clipped this returns the current width, i.e. a fully
 * revealed column cannot grow further; the cap is a reveal limit, not an autofit
 * (it never asks a column to SHRINK to its content).
 */
const contentCap = (th: HTMLTableCellElement): number => {
  const table = th.closest('table');
  if (!table) return Number.POSITIVE_INFINITY;
  const index = th.cellIndex;
  let needed = MIN_COLUMN_WIDTH;
  for (const row of Array.from(table.rows)) {
    const cell = row.cells[index];
    // A spanning cell answers for several columns, so its overflow blames none of them.
    if (!cell || cell.colSpan !== 1) continue;
    let hidden = Math.max(0, cell.scrollWidth - cell.clientWidth);
    for (const el of Array.from(cell.querySelectorAll('*'))) {
      hidden = Math.max(hidden, el.scrollWidth - el.clientWidth);
    }
    needed = Math.max(needed, cell.offsetWidth + hidden + (hidden > 0 ? 1 : 0));
  }
  return needed;
};

/**
 * 열 폭을 드래그로 조절한다 — Azure 포털 리소스 표와 같은 문법으로, 헤더 오른쪽 끝의 경계를
 * 잡아 끈다. 값이 잘렸을 때의 해법을 hover(툴팁)로 두면 한 번에 한 행밖에 못 읽고, 여러 행을
 * 비교하려면 그 행 수만큼 hover 해야 한다. 폭 자체를 넓히면 비교가 눈으로 한 번에 끝난다.
 *
 * `table-fixed` 표 전용이다: 폭을 지정한 열은 그 값에 고정되고, 폭이 없는 열이 남는 공간을
 * 흡수한다 — 그래서 손잡이는 고정폭 열에만 달고, 흡수하는 열에는 달지 않는다.
 *
 * 시작 폭은 상태가 아니라 pointerdown 시점의 실제 렌더 폭(offsetWidth)에서 읽는다. 훅은
 * 기본값을 알 필요가 없고(클래스가 소유), 사용자가 건드린 열만 기억한다.
 */
export const useColumnResize = (options?: ColumnResizeOptions): ColumnResize => {
  const { clampToContent = false, storageKey } = options ?? {};
  const [widths, setWidths] = useState<Readonly<Record<string, number>>>({});
  /**
   * 진행 중인 드래그를 끝내는 함수. window 리스너는 이 훅 밖에서 살아 있으므로, 드래그
   * 도중에 표가 사라지면(모달을 닫으면) 아무도 그것을 떼어 주지 않는다 — 언마운트가
   * 마지막 책임자다.
   */
  const teardownRef = useRef<(() => void) | null>(null);
  useEffect(() => () => teardownRef.current?.(), []);

  // Hydrate a task AFTER mount, then write back on change. Deferred on purpose: the
  // server and the first client paint agree on the class-owned defaults (no hydration
  // mismatch on sized <th>s), and the stored widths land right after. setTimeout, not
  // requestAnimationFrame — rAF never fires in a hidden tab, so a table loaded in the
  // background would sit on defaults until the tab is looked at.
  // The guard keeps the initial `{}` from clobbering a stored value first.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!storageKey) return;
    const timer = window.setTimeout(() => {
      hydratedRef.current = true;
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return;
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return;
        const entries = Object.entries(parsed as Record<string, unknown>).flatMap(
          ([key, value]) =>
            typeof value === 'number' && Number.isFinite(value)
              ? [[key, Math.max(MIN_COLUMN_WIDTH, Math.round(value))] as [string, number]]
              : [],
        );
        if (entries.length === 0) return;
        // A width the user managed to drag inside this first frame outranks the stored one.
        setWidths((prev) => ({ ...Object.fromEntries(entries), ...prev }));
      } catch {
        // Storage can be absent or blocked (private windows) — defaults are the fallback.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);
  useEffect(() => {
    if (!storageKey || !hydratedRef.current) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(widths));
    } catch {
      // Best effort — resizing still works for the session.
    }
  }, [widths, storageKey]);

  // Memoized so a memo()'d table taking this as a prop only re-renders when a width
  // actually changes, not on every render of the hook's host.
  return useMemo<ColumnResize>(() => {
    const resize = (key: string, from: number, delta: number, cap?: number) =>
      setWidths((prev) => ({
        ...prev,
        [key]: Math.min(
          cap ?? Number.POSITIVE_INFINITY,
          Math.max(MIN_COLUMN_WIDTH, from + delta),
        ),
      }));

    /** 손잡이가 속한 열. */
    const ownerTh = (target: HTMLElement): HTMLTableCellElement | null => target.closest('th');

    const onPointerDown = (key: string) => (event: ReactPointerEvent<HTMLSpanElement>) => {
      // 헤더는 정렬 버튼이기도 하다 — 손잡이를 잡은 것이 정렬로도 읽히면 안 된다.
      event.preventDefault();
      event.stopPropagation();
      // 앞선 드래그가 어떤 이유로든 살아 있으면 먼저 끊는다: 두 벌의 pointermove 가 같은
      // 열을 서로 다른 기준폭으로 밀면 폭이 손을 따라오지 않고 튄다.
      teardownRef.current?.();
      const th = ownerTh(event.currentTarget);
      if (!th) return;
      const from = th.offsetWidth;
      // The cap is priced once, at gesture start — reading every cell on every
      // pointermove would pay the DOM walk at 60Hz for a value that cannot change mid-drag.
      const cap = clampToContent ? contentCap(th) : undefined;
      const startX = event.clientX;
      const pointerId = event.pointerId;

      // 포인터가 손잡이 밖으로 나가도 드래그는 이어져야 하므로 window 가 듣는다 — 손잡이에
      // 걸면 폭 8px 를 벗어나는 순간 이벤트가 끊긴다.
      const move = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        resize(key, from, moveEvent.clientX - startX, cap);
      };
      // pointercancel 도 끝이다 — 브라우저가 제스처를 가져가면 pointerup 은 오지 않고,
      // 그때 떼지 않으면 move 리스너가 영영 window 에 남아 다음 클릭마다 폭을 움직인다.
      const end = (endEvent?: PointerEvent) => {
        if (endEvent && endEvent.pointerId !== pointerId) return;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
        teardownRef.current = null;
      };
      teardownRef.current = end;
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
    };

    const onKeyDown = (key: string) => (event: ReactKeyboardEvent<HTMLSpanElement>) => {
      const step = event.key === 'ArrowRight' ? KEY_STEP : event.key === 'ArrowLeft' ? -KEY_STEP : 0;
      if (!step) return;
      event.preventDefault();
      const th = ownerTh(event.currentTarget);
      if (!th) return;
      resize(key, th.offsetWidth, step, clampToContent ? contentCap(th) : undefined);
    };

    /** Double-click = jump to the cap: the one-gesture "uncover this column" move. */
    const onDoubleClick = (key: string) => (event: ReactMouseEvent<HTMLSpanElement>) => {
      const th = ownerTh(event.currentTarget);
      if (!th) return;
      resize(key, contentCap(th), 0);
    };

    return {
      widthOf: (key) => (widths[key] === undefined ? undefined : { width: widths[key] }),
      handleProps: (key, label) => ({
        role: 'separator',
        'aria-orientation': 'vertical',
        'aria-label': `${label} 열 너비 조절`,
        tabIndex: 0,
        onPointerDown: onPointerDown(key),
        // 헤더 전체가 정렬 버튼인 표가 있다 — 손잡이에서 올라간 클릭은 정렬이 아니다.
        onClick: (event) => event.stopPropagation(),
        onKeyDown: onKeyDown(key),
        ...(clampToContent ? { onDoubleClick: onDoubleClick(key) } : {}),
        className: idcStyles.table.resizeHandle,
      }),
      reset: () => {
        setWidths({});
        if (storageKey) {
          try {
            localStorage.removeItem(storageKey);
          } catch {
            // Nothing to clear is fine.
          }
        }
      },
    };
  }, [widths, clampToContent, storageKey]);
};
