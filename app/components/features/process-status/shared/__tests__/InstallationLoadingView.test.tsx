// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InstallationLoadingView } from '@/app/components/features/process-status/shared/InstallationLoadingView';

// The rail is the first child of the 2-column grid; its children are the rows.
const railRowCount = (container: HTMLElement): number =>
  container.querySelector('[aria-busy="true"] > div > div')?.children.length ?? -1;

describe('InstallationLoadingView', () => {
  /**
   * The rail count was hardcoded to 5 while the real counts are AWS 4/5 (by
   * install mode), Azure 5, GCP 4, IDC 4 — so the card resized when the data
   * landed, the one thing the skeleton exists to prevent. Nothing else in the
   * suite fails if `railRows` stops being honoured.
   */
  it.each([
    ['IDC / GCP', 4],
    ['Azure / AWS auto', 5],
  ])('draws exactly railRows rail rows (%s)', (_label, railRows) => {
    const { container } = render(<InstallationLoadingView provider="Azure" railRows={railRows} />);
    expect(railRowCount(container)).toBe(railRows);
  });

  it('announces itself as busy for assistive tech', () => {
    const { container } = render(<InstallationLoadingView provider="IDC" railRows={4} />);
    const region = container.querySelector('[aria-busy="true"]');
    expect(region?.getAttribute('aria-label')).toBe('IDC 설치 상태 확인 중');
  });
});
