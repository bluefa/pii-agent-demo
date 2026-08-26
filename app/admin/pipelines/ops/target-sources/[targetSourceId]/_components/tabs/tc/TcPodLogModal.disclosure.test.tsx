// @vitest-environment jsdom
/**
 * 행 디스클로저 — 접힘이 기본이고, 편 상태는 **필터 전 원본 인덱스**에 매인다.
 *
 * 이 두 가지가 화면에서 조용히 어긋난다: (1) 접힘을 놓치면 스택 트레이스 한 건이
 * 지면을 통째로 먹는데 테스트는 초록이고, (2) 편 상태를 필터된 배열의 인덱스로
 * 키잉하면 severity 칩을 누르는 순간 **다른 줄이 펴진다** — 에러도 빈 화면도 없이.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { TcPodLogModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcPodLogModal';

const TRACE = 'java.sql.SQLException: denied\n\tat com.pass.Probe.open(Probe.java:88)\n\t... 14 more';

vi.mock('@/app/lib/api/task-queue-tc', () => ({
  getTestConnectionPodLog: vi.fn(async () => ({
    podId: 'tc-pod-1',
    entries: [
      { severity: 'INFO', content: 'Starting connection test', timestamp: '2026-06-01T00:04:14.400Z' },
      { severity: 'ERROR', content: TRACE, timestamp: '2026-06-01T00:04:16.000Z' },
      { severity: 'INFO', content: 'Pod terminating', timestamp: '2026-06-01T00:04:20.000Z' },
    ],
  })),
}));

const open = async () => {
  render(
    <TcPodLogModal targetSourceId={2103} podId="tc-pod-1" resourceLabel="rds-1" onClose={() => {}} />,
  );
  await waitFor(() => expect(screen.getAllByRole('button', { expanded: false })).toHaveLength(3));
  return screen.getAllByRole('button', { expanded: false });
};

describe('TcPodLogModal — StackDriver 행 디스클로저', () => {
  it('모든 줄은 접힌 채로 서고, 누르면 그 줄만 펴진다', async () => {
    const rows = await open();
    // 접힌 본문은 한 줄로 잘린다 — 여러 줄짜리 트레이스여도 행 높이가 자라지 않도록.
    const clamped = rows[1].querySelector('.truncate');
    expect(clamped?.textContent).toBe(TRACE);
    // jsdom 은 레이아웃을 안 재므로 `truncate` 만으로는 잘림을 못 본다. 잘림을 실제로
    // 지탱하는 건 같은 박스의 `min-w-0` 다 — 없으면 flex 아이템이 콘텐츠 아래로 안 줄어들어
    // truncate 가 조용히 무력화되고 행이 트레이스 높이로 자란다.
    expect(clamped?.className).toContain('min-w-0');

    fireEvent.click(rows[1]);
    expect(rows[1].getAttribute('aria-expanded')).toBe('true');
    expect(rows[0].getAttribute('aria-expanded')).toBe('false');
    // 펴면 잘림만 풀린다 — 본문 전문이 감기고, 자른 자리가 사라진다.
    expect(rows[1].querySelector('.truncate')).toBeNull();
    expect(rows[1].querySelector('.whitespace-pre-wrap')?.textContent).toBe(TRACE);

    fireEvent.click(rows[1]);
    expect(rows[1].getAttribute('aria-expanded')).toBe('false');
  });

  it('행은 접힌 채로 날짜까지 싣고, 편다고 꼬리표가 붙지 않는다', async () => {
    const rows = await open();
    // 시각 칸은 날짜를 달고 선다 — 복사해 붙인 한 줄이 어느 날 것인지 혼자 말해야 한다.
    expect(rows[1].textContent).toContain('2026-06-01 09:04:16.000');

    fireEvent.click(rows[1]);
    // 종전의 `severity · 날짜 시각` 꼬리표는 오너가 걷어냈다(2026-08-26). 접힌 줄이 이미
    // 날짜까지 싣는데 편 줄이 같은 사실을 한 번 더 쓰면 두 번 읽힌다.
    expect(rows[1].textContent).not.toContain('ERROR ·');
    expect(rows[1].textContent).not.toContain('2026-06-01 09:04:16.0002026-06-01');
  });

  it('행 윤곽은 hover 가 아니라 쉴 때 서 있다', async () => {
    const rows = await open();
    // 경계가 hover 때만 나타나면, 여러 줄 트레이스를 펴 놓았을 때 어디서 한 행이 끝나는지
    // 바닥 색만으로는 안 읽힌다. 상시 ring 이어야 한다 — `hover:ring-…` 은 이걸 못 대신한다.
    for (const row of rows) {
      expect(row.className).toMatch(/(?<!hover:)ring-white\/20/);
    }
  });

  it('키보드로도 같은 자리에서 펴고, Tab 은 목록에서 한 번만 멈춘다', async () => {
    const rows = await open();
    // roving tabindex — 정거장은 하나. 300줄 캡처본이 포커스 트랩을 300칸으로 만들지 않게.
    expect(rows.map((row) => row.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);

    fireEvent.keyDown(rows[0], { key: 'Enter' });
    expect(rows[0].getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(rows[0], { key: ' ' });
    expect(rows[0].getAttribute('aria-expanded')).toBe('false');
    // 누르고 있는 Space 의 auto-repeat 는 한 번만 센다.
    fireEvent.keyDown(rows[0], { key: ' ' });
    fireEvent.keyDown(rows[0], { key: ' ', repeat: true });
    expect(rows[0].getAttribute('aria-expanded')).toBe('true');

    // 방향키가 정거장을 옮긴다.
    fireEvent.keyDown(rows[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rows[1]);
    expect(rows[1].getAttribute('tabindex')).toBe('0');
  });

  it('severity 로 거른 뒤에도 같은 줄이 펴진 채로 남고, 정거장도 남는다', async () => {
    const rows = await open();
    fireEvent.click(rows[2]); // 세 번째 줄(INFO)
    // 정거장을 곧 걸러질 줄(ERROR) 위에 올려 둔다 — fallback 이 없으면 필터가 그 줄을
    // 걷어내는 순간 tabIndex 0 인 행이 하나도 안 남는다.
    rows[1].focus();
    fireEvent.click(screen.getByRole('button', { name: /^INFO 2$/ }));

    const filtered = screen.getAllByRole('button', { expanded: false }).length;
    expect(filtered).toBe(1); // INFO 2건 중 안 편 쪽 하나
    expect(screen.getByRole('button', { expanded: true }).textContent).toContain('Pod terminating');

    // 필터가 정거장으로 서 있던 행을 걷어내도 정거장은 남아야 한다 — 0개가 되면 로그가
    // 키보드에서 통째로 사라진다. tabindex 만 보는 검사와 필터만 거는 검사는 이 자리에서
    // 만나야 잡힌다.
    const stops = screen
      .getAllByRole('button')
      .filter((el) => el.hasAttribute('aria-expanded') && el.getAttribute('tabindex') === '0');
    expect(stops).toHaveLength(1);
  });
});
