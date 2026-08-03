// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';

import {
  ResourceStatTiles,
  ResourceToolbar,
  type FilterGroup,
} from '@/app/admin/pipelines/queue/requests/_components/ResourceFilterBar';

const group = (over: Partial<FilterGroup> = {}): FilterGroup => ({
  key: 'dbType',
  label: 'Database Type',
  value: '',
  onChange: () => {},
  options: ['MySQL', 'Oracle'],
  ...over,
});

const toolbar = (groups: FilterGroup[]) =>
  render(
    <ResourceToolbar
      searchValue=""
      onSearchChange={() => {}}
      searchPlaceholder="검색"
      groups={groups}
    />,
  );

describe('ResourceStatTiles', () => {
  it('renders the three counts as filter buttons', () => {
    const onFilterChange = vi.fn();
    render(
      <ResourceStatTiles
        counts={{ all: 44, target: 35, excluded: 9 }}
        filter="all"
        onFilterChange={onFilterChange}
      />,
    );

    expect(screen.getByRole('button', { name: /전체 요청\s*44/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /연동 요청 제외대상\s*9/ }));
    expect(onFilterChange).toHaveBeenCalledWith('excluded');
  });
});

describe('ResourceToolbar filter menu', () => {
  it('opens the popover with a radio group per condition', () => {
    toolbar([group()]);
    fireEvent.click(screen.getByRole('button', { name: '필터' }));

    expect(screen.getByRole('radiogroup', { name: 'Database Type 필터' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '전체' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Oracle' })).toBeTruthy();
  });

  /** IDC rows carry no region, and a request may be single-DB — a lone 전체 is not a choice. */
  it('drops a group that offers nothing to choose between', () => {
    toolbar([
      group(),
      group({ key: 'axis', label: 'Region', options: [] }),
      group({ key: 'kind', label: '구분', options: ['IP'] }),
    ]);
    fireEvent.click(screen.getByRole('button', { name: '필터' }));

    expect(screen.getByRole('radiogroup', { name: 'Database Type 필터' })).toBeTruthy();
    expect(screen.queryByRole('radiogroup', { name: 'Region 필터' })).toBeNull();
    expect(screen.queryByRole('radiogroup', { name: '구분 필터' })).toBeNull();
  });

  /** …unless it is the group holding the active value, or there would be no control left to clear it. */
  it('keeps a one-option group whose value is set', () => {
    toolbar([group({ options: ['MySQL'], value: 'MySQL' })]);
    fireEvent.click(screen.getByRole('button', { name: '필터' }));

    expect(screen.getByRole('radio', { name: 'MySQL' }).getAttribute('aria-checked')).toBe('true');
  });

  it('renders no trigger at all when every group was dropped', () => {
    toolbar([group({ options: [] })]);
    expect(screen.queryByRole('button', { name: '필터' })).toBeNull();
  });

  it('labels options through formatOption (IDC HOST → Host)', () => {
    toolbar([
      group({ key: 'axis', label: '구분', options: ['HOST', 'IP'], formatOption: (v) => (v === 'HOST' ? 'Host' : 'IP') }),
    ]);
    fireEvent.click(screen.getByRole('button', { name: '필터' }));

    expect(screen.getByRole('radio', { name: 'Host' })).toBeTruthy();
  });
});
