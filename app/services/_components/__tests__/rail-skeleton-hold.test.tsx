// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';

const { getServicesPageMock, getProjectsMock, toastMock } = vi.hoisted(() => ({
  getServicesPageMock: vi.fn(),
  getProjectsMock: vi.fn(),
  toastMock: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), show: vi.fn() },
}));

vi.mock('@/app/lib/api', () => ({
  getServicesPage: getServicesPageMock,
  getProjects: getProjectsMock,
}));
vi.mock('@/app/components/ui/toast', () => ({ useToast: () => toastMock }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/app/components/features/ProjectCreateModal', () => ({
  ProjectCreateModal: () => null,
}));

import { SKELETON_MIN_MS } from '@/lib/min-duration';
import { ServiceManagementView } from '@/app/services/_components/ServiceManagementView';

const page = {
  content: [{ service_code: 'ADS', service_name: '광고' }],
  totalElements: 1,
  totalPages: 1,
  number: 0,
  size: 8,
};

/** 레일이 스켈레톤 중인지 — `ServiceSidebar` 가 `aria-busy` 로 표시한다. */
const railBusy = (root: HTMLElement) =>
  root.querySelector('[aria-busy="true"]') !== null;

describe('서비스 레일 스켈레톤 최소 노출', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * 목이 즉시 답하는 화면이 이 규칙이 존재하는 이유다. 붙잡지 않으면 스켈레톤이 한
   * 프레임 번쩍이고 사라져, 읽히지도 않으면서 레일만 흔들린 것처럼 보인다.
   */
  it('응답이 즉시 와도 500ms 는 스켈레톤을 유지한다', async () => {
    getServicesPageMock.mockResolvedValue(page);
    const { container } = render(<ServiceManagementView />);

    // 요청은 이미 끝났지만(마이크로태스크만 비움) 스켈레톤은 그대로여야 한다.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(railBusy(container)).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SKELETON_MIN_MS - 50);
    });
    expect(railBusy(container), '500ms 전에 걷히면 안 된다').toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });
    expect(railBusy(container)).toBe(false);
  });

  /**
   * 실패도 같은 시간을 쓴다. 빨리 실패했다고 스켈레톤이 깜빡이고 사라지면, 사용자는
   * 무엇이 일어났는지 보기 전에 화면만 흔들린 것으로 읽는다.
   */
  it('실패해도 500ms 를 채운 뒤에 스켈레톤을 걷는다', async () => {
    getServicesPageMock.mockRejectedValue(new Error('boom'));
    const { container } = render(<ServiceManagementView />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SKELETON_MIN_MS - 50);
    });
    expect(railBusy(container)).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });
    expect(railBusy(container)).toBe(false);
    // 레일이 영영 스켈레톤에 갇히지 않는다는 기존 규칙은 그대로다.
    expect(toastMock.error).toHaveBeenCalled();
  });

  /**
   * 느린 응답은 늦추지 않는다 — 최소 노출이지 고정 지연이 아니다. 이미 500ms 를 넘겼으면
   * `holdFor` 는 즉시 반환해야 하고, 아니면 모든 로딩에 0.5초가 더 붙는다.
   */
  it('이미 500ms 를 넘긴 응답에는 시간을 더 붙이지 않는다', async () => {
    getServicesPageMock.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(page), 900)),
    );
    const { container } = render(<ServiceManagementView />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(899);
    });
    expect(railBusy(container)).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2);
    });
    expect(railBusy(container), '응답 즉시 걷혀야 한다').toBe(false);
  });
});
