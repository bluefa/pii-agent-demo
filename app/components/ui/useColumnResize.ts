'use client';

import {
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { idcStyles } from '@/lib/theme';

/** 값이 아니라 말줄임표만 남기 시작하는 폭 — 이보다 좁아지면 열이 있으나 마나다. */
const MIN_COLUMN_WIDTH = 56;

/** 키보드 한 번에 움직이는 폭. 한 글자보다는 크고, 한 번에 열이 사라지지는 않는 정도. */
const KEY_STEP = 16;

export interface ColumnResize {
  /** `<th>` 에 그대로 붙이는 style. 아직 건드리지 않은 열은 undefined — 기본 폭은 클래스가 소유한다. */
  widthOf: (key: string) => { width: number } | undefined;
  /** 헤더 오른쪽 끝 손잡이의 props. 감싸는 `<th>` 는 `relative` 나 `sticky` 여야 한다. */
  handleProps: (key: string, label: string) => HTMLAttributes<HTMLSpanElement>;
}

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
 *
 * ponytail: 폭은 모달이 닫히면 사라진다. 세션을 넘겨 기억해야 하면 그때 localStorage 를 붙인다.
 */
export const useColumnResize = (): ColumnResize => {
  const [widths, setWidths] = useState<Readonly<Record<string, number>>>({});
  /**
   * 진행 중인 드래그를 끝내는 함수. window 리스너는 이 훅 밖에서 살아 있으므로, 드래그
   * 도중에 표가 사라지면(모달을 닫으면) 아무도 그것을 떼어 주지 않는다 — 언마운트가
   * 마지막 책임자다.
   */
  const teardownRef = useRef<(() => void) | null>(null);
  useEffect(() => () => teardownRef.current?.(), []);

  const resize = (key: string, from: number, delta: number) =>
    setWidths((prev) => ({ ...prev, [key]: Math.max(MIN_COLUMN_WIDTH, from + delta) }));

  /** 손잡이가 속한 열의 지금 렌더 폭 — 조절한 적 없는 열도 여기서 실제 값을 얻는다. */
  const currentWidth = (target: HTMLElement): number | null =>
    target.closest('th')?.offsetWidth ?? null;

  const onPointerDown = (key: string) => (event: ReactPointerEvent<HTMLSpanElement>) => {
    // 헤더는 정렬 버튼이기도 하다 — 손잡이를 잡은 것이 정렬로도 읽히면 안 된다.
    event.preventDefault();
    event.stopPropagation();
    // 앞선 드래그가 어떤 이유로든 살아 있으면 먼저 끊는다: 두 벌의 pointermove 가 같은
    // 열을 서로 다른 기준폭으로 밀면 폭이 손을 따라오지 않고 튄다.
    teardownRef.current?.();
    const from = currentWidth(event.currentTarget);
    if (from === null) return;
    const startX = event.clientX;
    const pointerId = event.pointerId;

    // 포인터가 손잡이 밖으로 나가도 드래그는 이어져야 하므로 window 가 듣는다 — 손잡이에
    // 걸면 폭 8px 를 벗어나는 순간 이벤트가 끊긴다.
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      resize(key, from, moveEvent.clientX - startX);
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
    const from = currentWidth(event.currentTarget);
    if (from !== null) resize(key, from, step);
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
      className: idcStyles.table.resizeHandle,
    }),
  };
};
