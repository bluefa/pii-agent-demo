// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ConsoleTable, type ConsoleTableColumn } from '@/app/components/ui/ConsoleTable';
import type { ColumnResize } from '@/app/components/ui/useColumnResize';

const COLUMNS: ConsoleTableColumn[] = [
  { key: 'name', label: 'Resource Name', width: 100, headClassName: 'pl-[30px]' },
  { key: 'id', label: 'Resource ID', width: 200 },
  { key: 'region', label: 'Region', width: 60 },
];

const rows = (
  <tbody>
    <tr>
      <td>alpha</td>
      <td>arn:aws:rds:ap-northeast-2:1:db:alpha</td>
      <td>ap-northeast-2</td>
    </tr>
  </tbody>
);

const required = <T,>(value: T | null | undefined, what: string): T => {
  if (value === null || value === undefined) throw new Error(`missing ${what}`);
  return value;
};

/** A resize instance with no stored widths — a fresh identity on every call, which is
 *  exactly the signal a width change produces (the real hook memoizes on its widths). */
const resize = (widths: Record<string, number> = {}): ColumnResize => ({
  widthOf: (key) => (widths[key] === undefined ? undefined : { width: widths[key] }),
  handleProps: (key, label) => ({ role: 'separator', 'aria-label': `${label} 너비 조절` }),
  reset: () => {},
});

/** JSDOM has no layout — pin the column boundaries at x = 100, 200, … and the thead
 *  bottom at y = 40, the two measurements the tracer reads. */
const pinLayout = (wrap: HTMLElement) => {
  const ths = wrap.querySelectorAll('th');
  ths.forEach((th, index) => {
    th.getBoundingClientRect = () =>
      ({ right: (index + 1) * 100, bottom: 40 }) as unknown as DOMRect;
  });
  return ths;
};

const mount = (ui: React.ReactElement) => {
  const view = render(ui);
  const wrap = required(
    view.container.querySelector<HTMLDivElement>('.overflow-x-auto'),
    'the scroll container',
  );
  const tracer = required(
    view.container.querySelector<HTMLDivElement>('[data-seam-tracer]'),
    'the seam tracer band',
  );
  return { ...view, wrap, tracer };
};

describe('ConsoleTable — columns', () => {
  it('declares every column in order, at its own width, and sums them onto the table', () => {
    const { container } = render(<ConsoleTable columns={COLUMNS}>{rows}</ConsoleTable>);
    const ths = container.querySelectorAll('thead th');
    expect([...ths].map((th) => th.textContent)).toEqual([
      'Resource Name',
      'Resource ID',
      'Region',
    ]);
    expect([...ths].map((th) => (th as HTMLElement).style.width)).toEqual([
      '100px',
      '200px',
      '60px',
    ]);
    // The table's width IS the column sum, never w-full: under w-full the fixed layout
    // redistributes slack and every column silently renders wider than it declares.
    const table = required(container.querySelector('table'), 'the table');
    expect((table as HTMLElement).style.width).toBe('360px');
    expect(table.className).toContain('table-fixed');
    expect(table.className).not.toContain('w-full');
  });

  it('lets a dragged width override the default, in the cell and in the sum', () => {
    const { container } = render(
      <ConsoleTable columns={COLUMNS} resize={resize({ id: 260 })}>
        {rows}
      </ConsoleTable>,
    );
    const ths = container.querySelectorAll('thead th');
    expect((ths[1] as HTMLElement).style.width).toBe('260px');
    expect((required(container.querySelector('table'), 'the table') as HTMLElement).style.width)
      .toBe('420px');
  });

  it('renders a grab handle per column only when a resize instance is wired in', () => {
    const { container, rerender } = render(
      <ConsoleTable columns={COLUMNS}>{rows}</ConsoleTable>,
    );
    expect(container.querySelectorAll('[role="separator"]').length).toBe(0);
    rerender(
      <ConsoleTable columns={COLUMNS} resize={resize()}>
        {rows}
      </ConsoleTable>,
    );
    expect(container.querySelectorAll('[role="separator"]').length).toBe(3);
  });

  it('gives the drag its floor probe — a shrink-to-fit label box, not a block one', () => {
    // The hook reads this span's scrollWidth. A block span reports the th's width, which
    // froze every column at its current width — an actual bug, so it gets a test.
    const { container } = render(<ConsoleTable columns={COLUMNS}>{rows}</ConsoleTable>);
    const label = required(
      container.querySelector('[data-resize-label]'),
      'the resize label probe',
    );
    expect(label.className).toContain('inline-block');
    expect(label.className).toContain('max-w-full');
  });
});

describe('ConsoleTable — the seam', () => {
  it('deepens the nearest seam only inside its 8px zone, as a band on the boundary', () => {
    const { wrap, tracer } = mount(<ConsoleTable columns={COLUMNS}>{rows}</ConsoleTable>);
    // Not a line: the resting 10px shadow ramp deepened blue, right edge ON the seam.
    expect(tracer.className).toContain('w-[10px]');
    expect(tracer.className).toContain('linear-gradient(to_left');
    expect(tracer.className).toContain('opacity-0');
    pinLayout(wrap);

    fireEvent.mouseMove(wrap, { clientX: 104 });
    expect(tracer.style.opacity).toBe('1');
    // 100 (seam) − 10 (band) — the band hangs left of the boundary, not centred on it.
    expect(tracer.style.transform).toBe('translateX(90px)');
    // Body only: the header keeps its line grammar, so the band starts under the rule.
    expect(tracer.style.top).toBe('40px');

    // Between seams, and at the table's outer right edge, which is not a seam.
    fireEvent.mouseMove(wrap, { clientX: 150 });
    expect(tracer.style.opacity).toBe('0');
    fireEvent.mouseMove(wrap, { clientX: 300 });
    expect(tracer.style.opacity).toBe('0');

    fireEvent.mouseMove(wrap, { clientX: 104 });
    fireEvent.mouseLeave(wrap);
    expect(tracer.style.opacity).toBe('0');
  });

  it('douses the band while a button is held — a drag must not trail its ghost', () => {
    // During a resize drag the compat mousemoves arrive with buttons=1 and stale layout;
    // repositioning then paints a band trailing the moving boundary.
    const { wrap, tracer } = mount(<ConsoleTable columns={COLUMNS}>{rows}</ConsoleTable>);
    pinLayout(wrap);
    fireEvent.mouseMove(wrap, { clientX: 104 });
    expect(tracer.style.opacity).toBe('1');
    fireEvent.mouseMove(wrap, { clientX: 104, buttons: 1 });
    expect(tracer.style.opacity).toBe('0');
  });

  it('douses the band on a width change, until the pointer leaves the seam zone', () => {
    // After a drag ends the cursor is parked AT the boundary — without the latch the
    // band relights there immediately and reads as residue of the gesture.
    const { wrap, tracer, rerender } = mount(
      <ConsoleTable columns={COLUMNS} resize={resize()}>
        {rows}
      </ConsoleTable>,
    );
    pinLayout(wrap);
    fireEvent.mouseMove(wrap, { clientX: 104 });
    expect(tracer.style.opacity).toBe('1');

    rerender(
      <ConsoleTable columns={COLUMNS} resize={resize()}>
        {rows}
      </ConsoleTable>,
    );
    expect(tracer.style.opacity).toBe('0');
    // Still parked in the zone: latched dark.
    fireEvent.mouseMove(wrap, { clientX: 104 });
    expect(tracer.style.opacity).toBe('0');
    // Leaving the zone once re-arms discovery.
    fireEvent.mouseMove(wrap, { clientX: 150 });
    fireEvent.mouseMove(wrap, { clientX: 104 });
    expect(tracer.style.opacity).toBe('1');
  });
});
