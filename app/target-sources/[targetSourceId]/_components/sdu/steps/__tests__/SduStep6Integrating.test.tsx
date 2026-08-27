// @vitest-environment jsdom

/**
 * Step 6 is the screen with nothing on it to press, so the only behaviour it HAS is the
 * poll. If that stops working the card does not look broken — it looks like BDC is slow,
 * and the owner waits on a target that finished hours ago.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import { INSTALL_POLL_INTERVAL_MS } from '@/app/hooks/useInstallationStatus';

const getProject = vi.fn<(id: number) => Promise<CloudTargetSource>>();
const getSduUpload = vi.fn<(id: number, init?: { signal?: AbortSignal }) => Promise<unknown>>();
/** Typed, so the assertions below read a real `processStatus` rather than an implicit any. */
const updateSpy = () => vi.fn<(next: CloudTargetSource) => void>();

vi.mock('@/app/lib/api', () => ({ getProject: (id: number) => getProject(id) }));
vi.mock('@/app/lib/api/sdu', () => ({
  getSduUpload: (id: number, init?: { signal?: AbortSignal }) => getSduUpload(id, init),
}));

import { SduStep6Integrating } from '@/app/target-sources/[targetSourceId]/_components/sdu/steps/SduStep6Integrating';

const project = (processStatus: ProcessStatus): CloudTargetSource => ({
  id: 'sdu-1',
  targetSourceId: 4242,
  projectCode: 'SDU-001',
  serviceCode: 'SERVICE-A',
  serviceName: 'Service A',
  processStatus,
  createdAt: '2026-08-20T09:00:00Z',
  updatedAt: '2026-08-25T09:00:00Z',
  name: 'SDU target',
  description: '',
  isRejected: false,
  cloudProvider: 'AWS',
  isTerraformExecutionGranted: false,
  isSduType: true,
});

const UPLOAD = {
  submittedAt: '2026-08-24T05:02:00Z',
  regions: ['us', 'eu'],
  firewall: { queriedAt: '2026-08-24T05:10:00Z', rows: [], ackedRegions: [] },
  recipients: {
    users: [
      { id: 'u1', name: '박지원', email: 'a@example.com' },
      { id: 'u2', name: '김하늘', email: 'b@example.com' },
    ],
    updatedAt: null,
  },
  commands: { rows: [], ackedRegions: [] },
  bdc: {
    status: 'IN_PROGRESS',
    checkedAt: '2026-08-25T00:31:00Z',
    completedAt: null,
  },
  invalidation: { addedRegions: [], removedRegions: [], uploadIpChanged: false },
};

/** Let the mount fetches settle — two independent promises, so drain the queue twice. */
const settle = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  getProject.mockReset();
  getSduUpload.mockReset().mockResolvedValue(UPLOAD);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SduStep6Integrating — the poll', () => {
  it('hands the finished project up once it leaves step 6', async () => {
    getProject
      .mockResolvedValueOnce(project(ProcessStatus.WAITING_CONNECTION_TEST))
      .mockResolvedValue(project(ProcessStatus.INSTALLATION_COMPLETE));
    const update = updateSpy();

    render(
      <SduStep6Integrating
        project={project(ProcessStatus.WAITING_CONNECTION_TEST)}
        onProjectUpdate={update}
      />,
    );
    await settle();
    // The mount answer still says step 6 — nothing to report yet.
    expect(update).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(INSTALL_POLL_INTERVAL_MS);
    });
    await settle();

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].processStatus).toBe(
      ProcessStatus.INSTALLATION_COMPLETE,
    );
  });

  it('also reports a target that was reset back to step 1', async () => {
    // ⛔ The predicate is 「left step 6」, not 「reached 완료」. An admin can reset the
    // target, and a card that only watched for completion would keep the owner staring at
    // a step their target is no longer on.
    getProject
      .mockResolvedValueOnce(project(ProcessStatus.CONNECTION_VERIFIED))
      .mockResolvedValue(project(ProcessStatus.WAITING_TARGET_CONFIRMATION));
    const update = updateSpy();

    render(
      <SduStep6Integrating
        project={project(ProcessStatus.CONNECTION_VERIFIED)}
        onProjectUpdate={update}
      />,
    );
    await settle();
    await act(async () => {
      vi.advanceTimersByTime(INSTALL_POLL_INTERVAL_MS);
    });
    await settle();

    expect(update.mock.calls[0][0].processStatus).toBe(
      ProcessStatus.WAITING_TARGET_CONFIRMATION,
    );
  });

  it('stops polling once it has reported', async () => {
    getProject
      .mockResolvedValueOnce(project(ProcessStatus.WAITING_CONNECTION_TEST))
      .mockResolvedValue(project(ProcessStatus.INSTALLATION_COMPLETE));

    render(
      <SduStep6Integrating
        project={project(ProcessStatus.WAITING_CONNECTION_TEST)}
        onProjectUpdate={updateSpy()}
      />,
    );
    await settle();
    await act(async () => {
      vi.advanceTimersByTime(INSTALL_POLL_INTERVAL_MS);
    });
    await settle();
    const afterSettling = getProject.mock.calls.length;

    await act(async () => {
      vi.advanceTimersByTime(INSTALL_POLL_INTERVAL_MS * 3);
    });
    await settle();

    expect(getProject.mock.calls.length).toBe(afterSettling);
  });
});

describe('SduStep6Integrating — what the card says', () => {
  beforeEach(() => {
    getProject.mockResolvedValue(project(ProcessStatus.WAITING_CONNECTION_TEST));
  });

  it('states the cadence, and offers no control to beat it', async () => {
    render(
      <SduStep6Integrating
        project={project(ProcessStatus.WAITING_CONNECTION_TEST)}
        onProjectUpdate={updateSpy()}
      />,
    );
    await settle();

    // The number in the copy is derived from the interval the poll actually runs at —
    // a promise the screen keeps by construction rather than by a reviewer noticing.
    expect(screen.getByText(/30초마다 자동 확인/)).toBeTruthy();
    // ⛔ No 새로고침 / 다시 확인 button. There is nothing the owner can do to make BDC
    // finish sooner, so the only effect such a control could have is to reset the number
    // beside it.
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('recaps what is already done, and prints no completion time it does not have', async () => {
    render(
      <SduStep6Integrating
        project={project(ProcessStatus.WAITING_CONNECTION_TEST)}
        onProjectUpdate={updateSpy()}
      />,
    );
    await settle();

    expect(screen.getByText('2곳 · US · EU')).toBeTruthy();
    expect(screen.getByText('2명')).toBeTruthy();
    // BDC has not finished, so `completedAt` is null. ⛔ Never a '-' here: an em-dash
    // beside 「리소스 생성 완료」 reads as work that failed, not as work still running.
    expect(screen.queryByText('리소스 생성 완료')).toBeNull();
  });

  it('says so when the recap cannot be read, rather than showing an empty one', async () => {
    // 실패는 빈 결과가 아니다 — silence here would let the card claim the owner opened no
    // Regions and named no recipients.
    getSduUpload.mockRejectedValue(new Error('boom'));

    render(
      <SduStep6Integrating
        project={project(ProcessStatus.WAITING_CONNECTION_TEST)}
        onProjectUpdate={updateSpy()}
      />,
    );
    await settle();

    expect(screen.getByText('업로드 요약 정보를 불러오지 못했어요.')).toBeTruthy();
  });
});
