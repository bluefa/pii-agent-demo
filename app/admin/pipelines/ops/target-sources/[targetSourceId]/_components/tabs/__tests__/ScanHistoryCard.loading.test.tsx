// @vitest-environment jsdom
/**
 * 「스캔 이력」 표의 대기 프레임.
 *
 * 종전의 대기 갈래는 h-10 막대 다섯이었다 — 표의 자국이라 부르면서 열 머리를 하나도
 * 그리지 않았다. 그 일곱 이름은 조회가 아니라 이 화면이 이미 아는 고정 문자열이라,
 * 값이 도착하는 순간 머리 한 줄이 새로 서면서 표 전체가 그만큼 아래로 밀렸다.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ScanHistoryCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/ScanHistoryCard';

const HEAD = ['실행 일시', '완료 일시', '상태', '버전', '발견 리소스', '소요 시간', '오류'];

describe('ScanHistoryCard — 대기 프레임', () => {
  it('이력을 기다리는 동안 열 머리를 실물로 세운다', () => {
    const { container } = render(
      <ScanHistoryCard
        rows={[]}
        page={0}
        totalPages={1}
        loading
        failed={false}
        onPage={vi.fn()}
        onRowOpen={vi.fn()}
      />,
    );

    const busy = container.querySelector('[aria-busy]');
    expect(busy).not.toBeNull();
    // 머리는 실물, 값만 막대 — 정착본과 같은 `<thead>` 를 쓰므로 열이 바뀌면 같이 바뀐다.
    for (const label of HEAD) expect(screen.getByText(label)).toBeTruthy();
    expect(busy?.querySelectorAll('tbody tr').length).toBe(5);
    expect(busy?.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    // 비어 있는 것과 아직 안 온 것은 다르다.
    expect(screen.queryByText('스캔 이력이 없습니다.')).toBeNull();
  });
});
