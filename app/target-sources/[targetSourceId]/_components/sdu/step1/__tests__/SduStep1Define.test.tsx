/**
 * Step 1 「연동 대상 정의」 — the gates this screen owes the user.
 *
 * Every claim here is one the SERVER also makes (lib/bff/mock/sdu.ts). That is exactly why
 * they are worth pinning on the client: a rule enforced only upstream reaches the user as a
 * 400 with a wire sentence in it, and by then the work is already typed.
 */
// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import type { SduDefinition } from '@/lib/types/sdu';

const getSduDefinition = vi.fn<() => Promise<SduDefinition>>();
const putSduDefinition = vi.fn<() => Promise<SduDefinition>>();
const submitSduDefinition = vi.fn<() => Promise<void>>();

vi.mock('@/app/lib/api/sdu', () => ({
  getSduDefinition: () => getSduDefinition(),
  putSduDefinition: () => putSduDefinition(),
  submitSduDefinition: () => submitSduDefinition(),
}));

vi.mock('@/app/lib/api', () => ({ getProject: vi.fn() }));

import { ToastProvider } from '@/app/components/ui/toast';
import { SduStep1Define } from '@/app/target-sources/[targetSourceId]/_components/sdu/steps/SduStep1Define';

const project: CloudTargetSource = {
  isTerraformExecutionGranted: false,
  id: 'sdu-1100',
  targetSourceId: 1100,
  projectCode: 'SDU-100',
  serviceCode: 'sdu',
  serviceName: '커머스광고플랫폼',
  processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
  createdAt: '2026-08-01T09:00:00Z',
  updatedAt: '2026-08-20T09:00:00Z',
  name: 'SDU 대상소스',
  description: '',
  isRejected: false,
  cloudProvider: 'AWS',
  isSduType: true,
};

const chinaProject: CloudTargetSource = { ...project, isChinaRegion: true };

const definition = (over: Partial<SduDefinition> = {}): SduDefinition => ({
  regionScope: 'GLOBAL',
  targets: [],
  updatedAt: null,
  ...over,
});

const twoTargets: SduDefinition = definition({
  targets: [
    {
      targetId: 'sdu-1100-1',
      cloud: 'GCP',
      region: 'us',
      uploadIp: '10.20.30.40',
      databaseTypes: ['MySQL', 'PostgreSQL'],
    },
    {
      targetId: 'sdu-1100-2',
      cloud: 'AWS',
      region: 'eu',
      uploadIp: '10.20.30.40',
      databaseTypes: ['MySQL', 'Tibero'],
    },
  ],
});

const button = (name: string): HTMLButtonElement =>
  screen.getByRole('button', { name }) as HTMLButtonElement;

const radio = (name: string): HTMLInputElement =>
  screen.getByRole('radio', { name }) as HTMLInputElement;

const renderStep = async (props: Partial<Parameters<typeof SduStep1Define>[0]> = {}) => {
  const view = render(
    <ToastProvider>
      <SduStep1Define project={project} onProjectUpdate={() => {}} {...props} />
    </ToastProvider>,
  );
  await screen.findByRole('heading', { name: '연동 대상' });
  return view;
};

beforeEach(() => {
  vi.clearAllMocks();
  getSduDefinition.mockResolvedValue(definition());
});

describe('연동 권역', () => {
  it('Global 대상소스는 네 Region 을 칩으로 묻고, 권역은 한 줄로만 말한다', async () => {
    await renderStep();

    // 고르는 자리가 아니다 — 권역은 대상소스가 가진 값이라 컨트롤이 없다.
    expect(screen.queryByRole('radiogroup', { name: '연동 권역' })).toBeNull();
    expect(
      screen.getByText('권역 Global · Region은 Asia · US · EU · CX 중에서 골라요'),
    ).toBeTruthy();

    fireEvent.click(button('대상 추가'));

    const regions = within(screen.getByRole('radiogroup', { name: 'Region' }));
    expect(regions.getAllByRole('radio').map((chip) => chip.textContent)).toEqual([
      'Asia',
      'US',
      'EU',
      'CX',
    ]);
  });

  it('China 대상소스는 Region 을 묻지 않고 확정된 값으로 보여준다', async () => {
    // 판단의 출처는 정의 응답이 아니라 대상소스의 is_china_region 이다.
    await renderStep({ project: chinaProject });

    expect(screen.getByText('권역 China · Region은 China로 고정돼요')).toBeTruthy();

    fireEvent.click(button('대상 추가'));

    // 칩 그룹 자체가 없다: 영영 누를 수 없는 칩을 남겨 두면 그 한 줄을 의심하게 된다.
    expect(screen.queryByRole('radiogroup', { name: 'Region' })).toBeNull();
    expect(screen.getByText('고정')).toBeTruthy();
    // 편집 행은 목록 위 한 줄과 같은 사실을 자기 자리에서 한 번 더 말한다 — 칩이 없는
    // 이유는 칩이 있어야 할 자리에서 읽혀야 한다.
    expect(screen.getByText(/대상마다 다르게 고를 수 없어요/)).toBeTruthy();
  });
});

describe('업로드 IP', () => {
  it('IPv4 가 아니면 말해 주고, 그 행은 저장되지 않는다', async () => {
    await renderStep();
    fireEvent.click(button('대상 추가'));

    const input = screen.getByLabelText('업로드 IP');
    fireEvent.change(input, { target: { value: '10.20.30.999' } });

    expect(screen.getByText('올바른 IPv4 주소가 아니에요')).toBeTruthy();
    expect(button('대상 저장').disabled).toBe(true);

    fireEvent.change(input, { target: { value: '10.20.30.40' } });
    expect(screen.queryByText('올바른 IPv4 주소가 아니에요')).toBeNull();
  });
});

describe('제출 게이트', () => {
  it('대상이 0건이면 제출할 수 없다', async () => {
    await renderStep();
    expect(button('제출하고 업로드 단계로').disabled).toBe(true);
  });

  it('대상이 있으면 제출할 수 있고, 푸터가 만들어질 업로드 경로 수를 센다', async () => {
    getSduDefinition.mockResolvedValue(twoTargets);
    await renderStep();

    expect(button('제출하고 업로드 단계로').disabled).toBe(false);
    expect(screen.getByText('대상 2건 · Region 2곳 → 업로드 경로 2개')).toBeTruthy();
  });
});

describe('4단계에서 돌아온 1단계', () => {
  const renderReturn = async () => {
    getSduDefinition.mockResolvedValue(twoTargets);
    const onReturn = vi.fn();
    await renderStep({ mode: 'return', onReturn });
    return { onReturn };
  };

  const deleteSecondRow = () =>
    fireEvent.click(within(screen.getAllByRole('listitem')[1]).getByRole('button', { name: '삭제' }));

  it('삭제는 행을 지우지 않고 표시만 한다 — 저장 전에는 되돌릴 수 있다', async () => {
    await renderReturn();
    deleteSecondRow();

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('삭제함')).toBeTruthy();
    expect(screen.getByRole('button', { name: '되돌리기' })).toBeTruthy();
  });

  it('없어지는 Region 을 푸터가 이름으로 말한다', async () => {
    await renderReturn();
    deleteSecondRow();

    expect(screen.getByText('EU가 없어져요 — 업로드 경로 2개 → 1개.')).toBeTruthy();
  });

  it('새로 생기는 Region 과 없어지는 Region 을 한 줄에 함께 말한다', async () => {
    await renderReturn();

    // 02(EU) 를 지우고 Asia 대상을 하나 더한다.
    deleteSecondRow();
    fireEvent.click(button('대상 추가'));
    fireEvent.click(radio('Asia'));
    fireEvent.change(screen.getByLabelText('업로드 IP'), { target: { value: '10.20.30.41' } });
    fireEvent.click(button('MySQL'));
    fireEvent.click(button('대상 저장'));

    // 수가 같아도 굳이 "2개 → 2개"라고 말한다: 경로 수가 같다고 같은 경로가 아니다.
    expect(
      screen.getByText('Asia가 새로 생기고 EU가 없어져요 — 업로드 경로 2개 → 2개.'),
    ).toBeTruthy();
    expect(screen.getByText('추가함')).toBeTruthy();
  });

  it('저장은 정의를 쓰기만 하고 제출하지 않는다 — 이미 4단계를 지나온 대상소스다', async () => {
    const { onReturn } = await renderReturn();
    putSduDefinition.mockResolvedValue(twoTargets);

    fireEvent.click(button('저장하고 4단계로 돌아가기'));

    await waitFor(() => expect(onReturn).toHaveBeenCalledTimes(1));
    expect(putSduDefinition).toHaveBeenCalledTimes(1);
    expect(submitSduDefinition).not.toHaveBeenCalled();
  });
});
