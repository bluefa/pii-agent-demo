// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import type { Ec2Instance } from '@/app/lib/api/ec2';

const { searchEc2Instances } = vi.hoisted(() => ({ searchEc2Instances: vi.fn() }));

vi.mock('@/app/lib/api/ec2', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/lib/api/ec2')>()),
  searchEc2Instances,
}));

import { Ec2AddModal } from '@/app/target-sources/[targetSourceId]/_components/aws/Ec2AddModal';

const SEARCH_DEBOUNCE_MS = 500;

const instance = (overrides: Partial<Ec2Instance> = {}): Ec2Instance => ({
  instanceId: 'i-0a1b2c3d4e5f67890',
  privateIpAddress: '10.10.1.24',
  privateDnsName: 'ip-10-10-1-24.ap-northeast-2.compute.internal',
  ...overrides,
});

const renderModal = (onAdd = vi.fn()) => {
  render(
    <Ec2AddModal
      targetSourceId={1}
      addedInstanceIds={new Set<string>()}
      editing={undefined}
      onAdd={onAdd}
      onClose={() => {}}
    />,
  );
  return onAdd;
};

/** 검색어를 넣고 디바운스를 넘겨, 결과가 그려질 때까지 진행시킨다. */
const search = async (value: string) => {
  const field = screen.getByLabelText('Instance ID 검색');
  await act(async () => {
    // React 는 값이 실제로 달라졌을 때만 onChange 를 부르므로(input value tracking),
    // 네이티브 setter 로 값을 먼저 바꾼 뒤 한 번만 알린다.
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!
      .set!.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => { vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS); });
  await act(async () => {});
};

describe('Ec2AddModal — 검색 결과', () => {
  beforeEach(() => {
    searchEc2Instances.mockReset();
    vi.useFakeTimers();
  });

  // 가짜 타이머는 파일이 아니라 워커 단위로 남는다 — 되돌리지 않으면 뒤이어 도는 스위트가
  // 이 파일 때문에 멈춘 시계 위에서 돌아간다.
  afterEach(() => {
    vi.useRealTimers();
  });

  it('접속 주소가 있는 결과는 추가할 수 있다', async () => {
    searchEc2Instances.mockResolvedValue([instance()]);
    renderModal();
    await search('i-0');

    // 질의와 일치한 앞부분은 별도 span 으로 강조되므로, 뒤쪽 조각으로 행을 집는다.
    expect(screen.getByText(/a1b2c3d4e5f67890/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^추가$/ })).toBeTruthy();
    expect(screen.queryByText('주소 없음')).toBeNull();
  });

  // 접속 주소가 곧 Private IP 다. 설정 단계는 그 값을 읽기 전용으로 보여줄 뿐이라 사용자가
  // 채울 방법이 없는데도 추가 완료가 열려 있었고, host 가 빠진 채 승인 요청에 실렸다.
  // 목 픽스처는 전부 IP 를 갖고 있어 화면으로는 재현되지 않는 경로다.
  it('Private IP 가 없는 결과는 담을 수 없다', async () => {
    searchEc2Instances.mockResolvedValue([instance({ privateIpAddress: '' })]);
    renderModal();
    await search('i-0');

    // 질의와 일치한 앞부분은 별도 span 으로 강조되므로, 뒤쪽 조각으로 행을 집는다.
    expect(screen.getByText(/a1b2c3d4e5f67890/)).toBeTruthy();
    expect(screen.getByText('주소 없음')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^추가$/ })).toBeNull();
  });

  // 타이핑이 이전 질의를 무효로 만든 순간 끊어야 한다 — 늦게 도착한 답이 'ready' 로
  // 그려지면, 계속 치고 있는 동안 지난 질의의 결과가 확정된 답처럼 화면에 남는다.
  it('이전 질의의 요청을 다음 타이핑 시점에 끊는다', async () => {
    const signals: AbortSignal[] = [];
    searchEc2Instances.mockImplementation((_id: number, _q: string, opts?: { signal?: AbortSignal }) => {
      if (opts?.signal) signals.push(opts.signal);
      return new Promise(() => {});
    });
    renderModal();

    await search('i-0a');
    expect(signals).toHaveLength(1);
    expect(signals[0].aborted).toBe(false);

    await search('i-0abcdef');
    expect(signals[0].aborted).toBe(true);
  });
});
