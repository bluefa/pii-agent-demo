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

/** `COLUMNS` with the middle one absorbing the slack — same sum, so the floor is the 360
 *  the other spec uses as its width, which keeps the two modes directly comparable. */
const FLEX_COLUMNS: ConsoleTableColumn[] = [
  COLUMNS[0],
  { ...COLUMNS[1], flex: true },
  COLUMNS[2],
];

/** Two flex columns — the shape every real caller uses. The LAST one is the sink; the
 *  first takes a percentage share and stands ready to inherit the role. */
const TWO_FLEX_COLUMNS: ConsoleTableColumn[] = [
  { ...COLUMNS[0], flex: true },
  { ...COLUMNS[1], flex: true },
  COLUMNS[2],
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
const resize = (
  widths: Record<string, number> = {},
  lastResizedKey: string | null = null,
): ColumnResize => ({
  lastResizedKey,
  widthOf: (key) => (widths[key] === undefined ? undefined : { width: widths[key] }),
  handleProps: (key, label) => ({ role: 'separator', 'aria-label': `${label} 너비 조절` }),
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
    // With every column sized the table's width IS the column sum, never w-full: under
    // w-full the fixed layout redistributes the slack across all of them and every column
    // silently renders wider than it declares. (A flex column changes this — see below.)
    const table = required(container.querySelector('table'), 'the table');
    expect((table as HTMLElement).style.width).toBe('360px');
    expect(table.className).toContain('table-fixed');
    expect(table.className).not.toContain('w-full');
  });

  it('gives the slack to a flex column, and its width becomes the table floor', () => {
    const { container } = render(
      <ConsoleTable columns={FLEX_COLUMNS}>{rows}</ConsoleTable>,
    );
    const ths = container.querySelectorAll('thead th');
    // Only the flex column goes auto. The sized ones must keep their declared px — that is
    // the whole point: a wider screen shows more Resource ID, not a wider everything.
    expect([...ths].map((th) => (th as HTMLElement).style.width)).toEqual([
      '100px',
      'auto',
      '60px',
    ]);
    const table = required(container.querySelector('table'), 'the table');
    expect(table.className).toContain('w-full');
    expect((table as HTMLElement).style.width).toBe('');
    expect((table as HTMLElement).style.minWidth).toBe('360px');
  });

  it('splits the fill between flex columns — a share each, auto for the last', () => {
    // Round 19 had one absorber, so a wide screen poured 100% of the slack into it and the
    // column ballooned while its neighbours sat at their declared px. A share spreads the
    // growth over every column whose values actually run long.
    const { container } = render(
      <ConsoleTable columns={TWO_FLEX_COLUMNS}>{rows}</ConsoleTable>,
    );
    const ths = container.querySelectorAll('thead th');
    expect([...ths].map((th) => (th as HTMLElement).style.width)).toEqual([
      // 100 / 360 — its own floor's share of the floor sum, so at the floor the column
      // lands exactly on 100px and above it grows in proportion.
      '27.7778%',
      'auto',
      '60px',
    ]);
    const table = required(container.querySelector('table'), 'the table');
    expect(table.className).toContain('w-full');
    expect((table as HTMLElement).style.minWidth).toBe('360px');
  });

  it('hands the sink to the OTHER flex column, so the dragged one keeps its width', () => {
    // THE round-19 defect. Dragging the sink must move the role rather than delete it, or
    // the table stops following the container for the rest of the visit with nothing on
    // screen saying why — and the dragged column would not follow the pointer either,
    // because a sink is filled, not sized.
    const { container } = render(
      <ConsoleTable columns={TWO_FLEX_COLUMNS} resize={resize({ id: 500 }, 'id')}>
        {rows}
      </ConsoleTable>,
    );
    const ths = container.querySelectorAll('thead th');
    expect([...ths].map((th) => (th as HTMLElement).style.width)).toEqual([
      'auto', // name inherits the sink
      '500px', // exactly what the user dragged — no redistribution
      '60px',
    ]);
    const table = required(container.querySelector('table'), 'the table');
    expect(table.className).toContain('w-full');
    // The pinned width raises the floor, so the table scrolls instead of crushing the sink.
    expect((table as HTMLElement).style.minWidth).toBe('660px');
    expect((table as HTMLElement).style.width).toBe('');
  });

  it('keeps filling once EVERY flex column has been dragged — the role never goes vacant', () => {
    // THE round-20 defect, and the one the owner hit: Name and ID are the two columns
    // anyone drags, and pinning both dropped the table to the column sum for the rest of
    // the visit. Whichever one was touched last is the one being sized; the other holds
    // the slack, and its own pinned width survives as part of the floor.
    const { container } = render(
      <ConsoleTable columns={TWO_FLEX_COLUMNS} resize={resize({ name: 150, id: 500 }, 'name')}>
        {rows}
      </ConsoleTable>,
    );
    const ths = container.querySelectorAll('thead th');
    expect([...ths].map((th) => (th as HTMLElement).style.width)).toEqual([
      '150px', // the column under the pointer follows it exactly
      'auto', // …and the other one goes back to absorbing
      '60px',
    ]);
    const table = required(container.querySelector('table'), 'the table');
    expect(table.className).toContain('w-full');
    expect((table as HTMLElement).style.minWidth).toBe('710px');
    expect((table as HTMLElement).style.width).toBe('');
  });

  it('lets a lone flex column stay the sink even while it is the one being dragged', () => {
    // Nothing else can absorb, so the fill outranks the gesture: the dragged width becomes
    // the table's floor and the column soft-floors at the fill width (Cloudscape's rule).
    // Going to width=sum here would be the round-20 defect again, one column smaller.
    const { container } = render(
      <ConsoleTable columns={FLEX_COLUMNS} resize={resize({ id: 500 }, 'id')}>
        {rows}
      </ConsoleTable>,
    );
    const ths = container.querySelectorAll('thead th');
    expect((ths[1] as HTMLElement).style.width).toBe('auto');
    const table = required(container.querySelector('table'), 'the table');
    expect(table.className).toContain('w-full');
    expect((table as HTMLElement).style.minWidth).toBe('660px');
    expect((table as HTMLElement).style.width).toBe('');
  });

  it('keeps a grab handle on the flex column', () => {
    // Its right edge is a seam like any other, and the tracer lights there — a boundary
    // that lights up but cannot be grabbed reads as a gap in the grammar.
    const { container } = render(
      <ConsoleTable columns={FLEX_COLUMNS} resize={resize()}>
        {rows}
      </ConsoleTable>,
    );
    const ths = container.querySelectorAll('thead th');
    expect([...ths].map((th) => !!th.querySelector('[role="separator"]'))).toEqual([
      true,
      true,
      true,
    ]);
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

  // A structural gutter (a checkbox or chevron column) declares `resizable: false`: its
  // width is a layout constant, not a reader decision, so it gets no handle — and its th
  // is marked so the seam tracer can skip its edge (see the seam suite).
  it('skips the handle on a resizable:false column and marks its th', () => {
    const { container } = render(
      <ConsoleTable
        columns={[{ key: 'select', label: '선택', width: 40, resizable: false }, ...COLUMNS]}
        resize={resize()}
      >
        {rows}
      </ConsoleTable>,
    );
    const ths = container.querySelectorAll('thead th');
    expect(ths[0].hasAttribute('data-static-col')).toBe(true);
    expect(ths[0].querySelector('[role="separator"]')).toBeNull();
    // The data columns keep theirs — the flag is per column, not per table.
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

  it('never advertises a static column’s edge — the tracer skips data-static-col', () => {
    const { wrap, tracer } = mount(
      <ConsoleTable
        columns={[{ key: 'select', label: '선택', width: 40, resizable: false }, ...COLUMNS]}
        resize={resize()}
      >
        {rows}
      </ConsoleTable>,
    );
    pinLayout(wrap);
    // x=104: the nearest edge (100) belongs to the static gutter — no gesture lives
    // there, so the discovery band must not show.
    fireEvent.mouseMove(wrap, { clientX: 104 });
    expect(tracer.style.opacity).toBe('0');
    // x=204: a data column's seam — the band shows as usual.
    fireEvent.mouseMove(wrap, { clientX: 204 });
    expect(tracer.style.opacity).toBe('1');
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
