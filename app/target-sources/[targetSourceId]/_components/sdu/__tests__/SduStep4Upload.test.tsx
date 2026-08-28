// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, type RenderResult } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import type { SduDefinition, SduUpload } from '@/lib/types/sdu';

const api = vi.hoisted(() => ({
  getSduUpload: vi.fn(),
  getSduDefinition: vi.fn(),
  putSduFirewallAck: vi.fn(),
  putSduCommandsAck: vi.fn(),
  putSduRecipients: vi.fn(),
  getPermissions: vi.fn(),
  getProject: vi.fn(),
}));

vi.mock('@/app/lib/api/sdu', () => ({
  getSduUpload: api.getSduUpload,
  getSduDefinition: api.getSduDefinition,
  putSduFirewallAck: api.putSduFirewallAck,
  putSduCommandsAck: api.putSduCommandsAck,
  putSduRecipients: api.putSduRecipients,
}));
vi.mock('@/app/lib/api', () => ({
  getPermissions: api.getPermissions,
  getProject: api.getProject,
}));
// Slice C owns the body of 1단계 — this test only asks that Step 4 hands over to it, and in
// which mode.
vi.mock('@/app/target-sources/[targetSourceId]/_components/sdu/steps/SduStep1Define', () => ({
  SduStep1Define: ({ mode }: { mode?: string }) => <div>step1 대체 화면 · mode={mode}</div>,
}));

import { SduStep4Upload } from '@/app/target-sources/[targetSourceId]/_components/sdu/steps/SduStep4Upload';
import { SDU_GATE_TITLE } from '@/app/target-sources/[targetSourceId]/_components/sdu/upload/model';

const TARGET_SOURCE_ID = 1100;

const US_COMMAND = [
  'export http_proxy=http://proxy.bdc.com:8080',
  'export https_proxy=http://proxy.bdc.com:8080',
  'aws s3 ls s3://bdc-sdu-us-east-1/1100/ --recursive --human-readable',
].join('\n');
const EU_COMMAND = [
  'export http_proxy=http://proxy.bdc.com:8080',
  'export https_proxy=http://proxy.bdc.com:8080',
  'aws s3 ls s3://bdc-sdu-eu-west-1/1100/ --recursive --human-readable',
].join('\n');

const RECIPIENTS = [
  { id: 'user-3', name: '박지원', email: 'jiwon.park@bdc.com' },
  { id: 'user-4', name: '최민수', email: 'minsu.choi@bdc.com' },
  { id: 'user-5', name: '이서연', email: 'seoyeon.lee@bdc.com' },
];

const upload = (over: Partial<SduUpload> = {}): SduUpload => ({
  submittedAt: '2026-08-24T05:41:00Z',
  regions: ['us', 'eu'],
  firewall: {
    rows: [
      {
        region: 'us',
        s3Endpoint: 's3.us-east-1.amazonaws.com',
        port: 443,
        destinationIps: ['52.216.0.0/15', '54.231.0.0/16'],
      },
      {
        region: 'eu',
        s3Endpoint: 's3.eu-west-1.amazonaws.com',
        port: 443,
        destinationIps: ['52.218.0.0/17'],
      },
    ],
    // 1100's shape: the owner is on the firewall block, with no answer yet.
    acked: false,
  },
  recipients: { users: RECIPIENTS, updatedAt: '2026-08-24T07:41:00Z' },
  commands: {
    rows: [
      { region: 'us', command: US_COMMAND },
      { region: 'eu', command: EU_COMMAND },
    ],
    acked: false,
  },
  bdc: { status: 'NOT_STARTED', checkedAt: '2026-08-24T07:50:00Z', completedAt: null },
  invalidation: { addedRegions: [], uploadIpChanged: false },
  ...over,
});


const definition: SduDefinition = {
  regionScope: 'GLOBAL',
  updatedAt: '2026-08-24T05:40:00Z',
  targets: [
    {
      targetId: 't1',
      cloud: 'AWS',
      region: 'us',
      uploadIp: '10.20.30.40',
      databaseTypes: ['MySQL'],
    },
    {
      targetId: 't2',
      cloud: 'GCP',
      region: 'us',
      uploadIp: '10.20.30.40',
      databaseTypes: ['PostgreSQL'],
    },
    {
      targetId: 't3',
      cloud: 'AZURE',
      region: 'eu',
      uploadIp: '10.20.30.41',
      databaseTypes: ['MySQL'],
    },
  ],
};

const project: CloudTargetSource = {
  isTerraformExecutionGranted: false,
  id: 'sdu-1',
  targetSourceId: TARGET_SOURCE_ID,
  projectCode: 'SDU-001',
  serviceCode: 'SERVICE-A',
  serviceName: 'Service A',
  processStatus: ProcessStatus.WAITING_APPROVAL,
  createdAt: '2026-08-20T09:00:00Z',
  updatedAt: '2026-08-24T14:00:00Z',
  name: 'SDU Platform',
  description: 'desc',
  isRejected: false,
  cloudProvider: 'AWS',
};

const FIREWALL_QUESTION = '모든 Region의 방화벽 결재 내역을 확인하셨습니까?';
const RECIPIENTS_INTRO =
  '업로드에 사용할 S3 Access Key를 받으실 분을 등록해주세요. 여러 명을 등록할 수 있어요.';
const COMMANDS_INTRO_HEAD = /관리자가 메일로 전달한 S3 Access Key로 데이터를 업로드해주세요/;
const BDC_HERO = 'BDC측에서 설치를 위해 리소스를 생성하고 있습니다';

const renderStep = async (
  onProjectUpdate: (next: CloudTargetSource) => void = vi.fn(),
): Promise<RenderResult> => {
  let view: RenderResult | null = null;
  await act(async () => {
    view = render(<SduStep4Upload project={project} onProjectUpdate={onProjectUpdate} />);
  });
  if (!view) throw new Error('render produced no view');
  return view;
};

beforeEach(() => {
  vi.clearAllMocks();
  api.getSduUpload.mockResolvedValue(upload());
  api.getSduDefinition.mockResolvedValue(definition);
  api.putSduFirewallAck.mockResolvedValue(undefined);
  api.putSduCommandsAck.mockResolvedValue(undefined);
  api.putSduRecipients.mockResolvedValue(undefined);
  api.getPermissions.mockResolvedValue({ users: [] });
  api.getProject.mockResolvedValue({ ...project, processStatus: ProcessStatus.WAITING_CONNECTION_TEST });
});

describe('SduStep4Upload', () => {
  it('opens only the block the owner is on, and folds the rest', async () => {
    await renderStep();

    expect(screen.getByText('2단계')).toBeTruthy();
    // The tag and the heading have to name the same step. Indexing the title map by a
    // literal survives a renumbering with a clean type-check and prints 「2단계 완료」.
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('데이터 업로드');
    expect(screen.getByText(FIREWALL_QUESTION)).toBeTruthy();
    expect(screen.queryByText(RECIPIENTS_INTRO)).toBeNull();
    expect(screen.queryByText(COMMANDS_INTRO_HEAD)).toBeNull();
    expect(screen.queryByText(BDC_HERO)).toBeNull();

    // A folded, finished block announces itself as a closed disclosure.
    const recipientsHead = screen.getByRole('button', { name: /S3 Access Key 수신자/ });
    expect(recipientsHead.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByText('4개 중 1개 완료')).toBeTruthy();
  });

  it('leaves a summary on the folded block and reopens it on demand', async () => {
    await renderStep();

    const recipientsHead = screen.getByRole('button', { name: /S3 Access Key 수신자/ });
    expect(recipientsHead.textContent).toContain('3명 등록함 · 박지원 외 2명');

    await act(async () => {
      fireEvent.click(recipientsHead);
    });

    expect(screen.getByText(RECIPIENTS_INTRO)).toBeTruthy();
    // The gate the owner is on folds while a finished one is being revisited — one open block.
    expect(screen.queryByText(FIREWALL_QUESTION)).toBeNull();
    expect(
      screen.getByRole('button', { name: /S3 Access Key 수신자/ }).getAttribute('aria-expanded'),
    ).toBe('true');
    // ...and the folded firewall row names the Regions its one answer covers. 두 블록이 같은
    // 문장을 쓰므로 어느 줄인지까지 짚는다 — 화면 어딘가에 있다는 것만으로는 부족하다.
    // 미답 블록의 머리는 눌리지 않아 button 이 아니다 — 제목에서 그 줄로 올라간다.
    const firewallRow = screen.getByText(SDU_GATE_TITLE.firewall).closest('div');
    expect(firewallRow?.textContent).toContain('미확인 · US · EU');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /S3 Access Key 수신자/ }));
    });
    expect(screen.getByText(FIREWALL_QUESTION)).toBeTruthy();
  });

  it('names every current Region in the open firewall block, one row each', async () => {
    await renderStep();
    // 답은 하나지만 질문은 Region 전부를 덮는다 — 표가 그 전부를 세운다.
    expect(screen.getByText(/US · EU 2곳입니다/)).toBeTruthy();
    // The 대상 column counts 1단계's targets in that Region (2 in US, 1 in EU).
    expect(screen.getByText('2건')).toBeTruthy();
    expect(screen.getByText('1건')).toBeTruthy();
  });

  it('answers 예 for every current Region at once, under the block’s own kind', async () => {
    await renderStep();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '예' }));
    });

    expect(api.putSduFirewallAck).toHaveBeenCalledWith(TARGET_SOURCE_ID, true);
    // A write is followed by a re-read: the gates are the server's computation.
    expect(api.getSduUpload).toHaveBeenCalledTimes(2);
  });

  it('아니오 records the answer and says the next block stays shut', async () => {
    await renderStep();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '아니오' }));
    });

    expect(api.putSduFirewallAck).toHaveBeenCalledWith(TARGET_SOURCE_ID, false);
    expect(screen.getByText('확인 후 예를 눌러주세요. 다음 블록은 열리지 않아요.')).toBeTruthy();
  });

  it('offers the service owners, minus the ones already registered', async () => {
    api.getPermissions.mockResolvedValue({
      users: [
        { id: 'user-9', name: '김도현', email: 'dohyun.kim@bdc.com' },
        // Already registered — the same person must not be offered a second time.
        { id: 'user-3', name: '박지원', email: 'jiwon.park@bdc.com' },
      ],
    });
    await renderStep();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /S3 Access Key 수신자/ }));
    });

    // 이 서비스의 담당자만 후보다 — 전체 사용자 검색이 아니다.
    await waitFor(() => expect(api.getPermissions).toHaveBeenCalledWith('SERVICE-A'));
    expect(await screen.findByText('김도현')).toBeTruthy();
    // 이름만으로는 동명이인이 갈리지 않는다 — 후보 행은 이메일을 함께 진다.
    expect(screen.getByText('dohyun.kim@bdc.com')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '박지원 제거' })).toBeTruthy();
    // 등록된 박지원은 칩으로만 서 있고 후보 줄에는 없다 — 「추가」는 김도현 하나뿐이다.
    expect(screen.getAllByRole('button', { name: '추가' }).length).toBe(1);
  });

  it('renders each Region’s three lines verbatim and copies that same string', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    api.getSduUpload.mockResolvedValue(
      upload({ firewall: { ...upload().firewall, acked: true } }),
    );

    const { container } = await renderStep();

    expect(screen.getByText(COMMANDS_INTRO_HEAD)).toBeTruthy();
    const pres = Array.from(container.querySelectorAll('pre'));
    expect(pres.map((node) => node.textContent)).toEqual([US_COMMAND, EU_COMMAND]);
    // ONE text node per block: the screen may not split or parse the string. The moment it
    // reads `s3://` out of it, the wire format becomes a screen contract.
    expect(pres.map((node) => node.childNodes.length)).toEqual([1, 1]);

    fireEvent.click(screen.getByRole('button', { name: 'US 업로드 확인 명령 복사' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(US_COMMAND));
  });

  it('writes the UPLOAD ack from the 데이터 업로드 확인 block', async () => {
    api.getSduUpload.mockResolvedValue(
      upload({ firewall: { ...upload().firewall, acked: true } }),
    );
    await renderStep();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '예' }));
    });

    expect(api.putSduCommandsAck).toHaveBeenCalledWith(TARGET_SOURCE_ID, true);
    // 방화벽 확인은 건드리지 않는다 — 경로가 다르면 답도 다르다.
    expect(api.putSduFirewallAck).not.toHaveBeenCalled();
  });

  it('hands the refreshed project up when BDC finishes building', async () => {
    vi.useFakeTimers();
    try {
      const running = upload({
        firewall: { ...upload().firewall, acked: true },
        commands: { ...upload().commands, acked: true },
        bdc: { status: 'IN_PROGRESS', checkedAt: '2026-08-24T07:50:00Z', completedAt: null },
      });
      api.getSduUpload.mockResolvedValue(running);
      const onProjectUpdate = vi.fn();
      await renderStep(onProjectUpdate);

      // No resource list, no counts, no refresh button — "돌고 있다" is the whole fact, and
      // the only thing that proves it is a number moving on its own.
      const bdcBlock = screen.getByText(BDC_HERO).closest('section');
      expect(bdcBlock).not.toBeNull();
      expect(bdcBlock?.querySelectorAll('button').length).toBe(0);
      expect(onProjectUpdate).not.toHaveBeenCalled();

      api.getSduUpload.mockResolvedValue(
        upload({
          firewall: { ...upload().firewall, acked: true },
          commands: { ...upload().commands, acked: true },
          bdc: {
            status: 'COMPLETED',
            checkedAt: '2026-08-24T07:51:00Z',
            completedAt: '2026-08-24T07:51:00Z',
          },
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(api.getProject).toHaveBeenCalledWith(TARGET_SOURCE_ID);
      expect(onProjectUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ processStatus: ProcessStatus.WAITING_CONNECTION_TEST }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('tells the owner what the last 1단계 edit invalidated', async () => {
    api.getSduUpload.mockResolvedValue(
      upload({
        invalidation: { addedRegions: ['asia'], uploadIpChanged: true },
      }),
    );
    await renderStep();

    expect(
      screen.getByText('Asia가 추가되어 방화벽 확인과 업로드 확인을 다시 해야 해요'),
    ).toBeTruthy();
    expect(screen.getByText('업로드 IP가 바뀌어 방화벽 확인을 다시 해야 해요')).toBeTruthy();
  });

  it('says nothing when the definition has not changed', async () => {
    await renderStep();
    expect(screen.queryByText(/다시 해야 해요/)).toBeNull();
    expect(screen.queryByText(/추가되어/)).toBeNull();
  });

  it('drops the previous target source’s answers the moment the id changes', async () => {
    let view: RenderResult | null = null;
    await act(async () => {
      view = render(<SduStep4Upload project={project} onProjectUpdate={vi.fn()} />);
    });
    expect(screen.getByText(FIREWALL_QUESTION)).toBeTruthy();

    // The layout renders this card without a key, so a target switch is a prop change.
    api.getSduUpload.mockReturnValue(new Promise(() => undefined));
    await act(async () => {
      view?.rerender(
        <SduStep4Upload
          project={{ ...project, targetSourceId: 1101 }}
          onProjectUpdate={vi.fn()}
        />,
      );
    });
    expect(screen.queryByText(FIREWALL_QUESTION)).toBeNull();
    expect(screen.queryByText('US는 확인하셨어요. EU가 남았어요.')).toBeNull();
  });

  it('swaps the card for 1단계 in return mode', async () => {
    await renderStep();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '연동 대상 수정' }));
    });

    expect(screen.getByText('step1 대체 화면 · mode=return')).toBeTruthy();
    expect(screen.queryByText(FIREWALL_QUESTION)).toBeNull();
  });
});
