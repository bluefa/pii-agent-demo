/**
 * Keyboard lifecycle of the drawer's dropdown. Tab fires no pointerdown, so before
 * the focusout close the panel stayed open behind whatever the next Enter opened —
 * and its captured Escape then ate that modal's first Escape (review 2026-08-17).
 */
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DrawerPicker } from '@/app/admin/pipelines/_detail/DrawerPicker';

const options = [
  { key: 'all', label: '전체 8' },
  { key: 'failed', tone: 'failed' as const, label: '실패 5' },
];

const setup = (onPick = vi.fn()) => {
  const view = render(
    <div>
      <DrawerPicker ariaLabel="Job 상태 필터" options={options} value="failed" onPick={onPick} />
      <button type="button">바깥</button>
    </div>,
  );
  return { view, onPick, trigger: screen.getByRole('button', { name: /Job 상태 필터/ }) };
};

describe('DrawerPicker', () => {
  it('names the trigger with the control AND the value it currently holds', () => {
    const { trigger } = setup();
    // An aria-label overrides the button's own text, so the value has to be in it.
    expect(trigger.getAttribute('aria-label')).toBe('Job 상태 필터: 실패 5');
  });

  it('closes when focus leaves, so nothing opened next inherits an open panel', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();

    const outside = screen.getByRole('button', { name: '바깥' });
    fireEvent.blur(trigger, { relatedTarget: outside });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('stays open while focus moves between the trigger and its own options', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    const option = screen.getByRole('menuitemradio', { name: /전체 8/ });
    fireEvent.blur(trigger, { relatedTarget: option });
    expect(screen.queryByRole('menu')).toBeTruthy();
  });

  it('gives focus back to the trigger after a pick, instead of dropping it on body', () => {
    const { trigger, onPick } = setup();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitemradio', { name: /전체 8/ }));

    expect(onPick).toHaveBeenCalledWith('all');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
