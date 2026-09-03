// @vitest-environment jsdom
/**
 * 확정 정보 삭제 모달 — 게이트 하나가 화면 넷을 가른다.
 *
 * 여기 테스트가 지키는 것은 배치가 아니라 **누를 수 있는 것**이다: 막힌 화면에는
 * 지우는 문이 아예 없어야 하고(입력조차 없다), 허용된 화면은 대상 id 를 친 뒤에만
 * 열리며, 상태를 못 읽었을 때는 사람이 직접 확인했다고 말하기 전에는 아무것도 열리지
 * 않는다. 모달은 건수만 말한다 — 지워질 것의 목록은 없다(오너 지시 09-04). 성공은
 * 프레임 없이 그대로 닫히고, 결과 프레임은 실패만 받는다.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfirmedIntegrationResponse, TerraformStatusResponse } from '@/app/lib/api';

const getTerraformStatus = vi.fn();
const deleteConfirmedResources = vi.fn();

vi.mock('@/app/lib/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/app/lib/api')>();
  return {
    ...mod,
    getTerraformStatus: (...args: unknown[]) => getTerraformStatus(...args),
    deleteConfirmedResources: (...args: unknown[]) => deleteConfirmedResources(...args),
  };
});

import { ConfirmDeleteModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/ConfirmDeleteModal';

const row = (index: number): ConfirmedIntegrationResponse['resource_infos'][number] => ({
  resource_id: `res-${index}`,
  resource_type: 'RDS',
  database_type: 'MYSQL',
  database_region: 'ap-northeast-2',
  resource_name: `confirmed-${index}`,
  port: 3306,
  host: `db-${index}.example.internal`,
  oracle_service_id: null,
  network_interface_id: null,
  ip_configuration: null,
  athena_region_resource_id: null,
  credential_id: 'cred-1',
});

const current = (count: number): ConfirmedIntegrationResponse => ({
  resource_infos: Array.from({ length: count }, (_, index) => row(index)),
});

const onOpenInfra = vi.fn();
const onClose = vi.fn();
const onDone = vi.fn();

/**
 * `terraform` 은 부모 탭이 이미 읽어 둔 상태다. 넘기면 첫 프레임이 그 상태로 서고,
 * 넘기지 않으면 조회부터 기다린다 — 두 경로가 이 파일에서 갈린다.
 */
const mount = (count = 2, overallState: string | null = null) =>
  render(
    <ConfirmDeleteModal
      targetSourceId={1642}
      provider="AWS"
      current={current(count)}
      terraform={
        overallState == null
          ? null
          : ({ overall_state: overallState } as TerraformStatusResponse)
      }
      onOpenInfra={onOpenInfra}
      onClose={onClose}
      onDone={onDone}
    />,
  );

const button = (name: string): HTMLButtonElement =>
  screen.getByRole('button', { name }) as HTMLButtonElement;

beforeEach(() => {
  vi.clearAllMocks();
  deleteConfirmedResources.mockResolvedValue({});
});

describe('APPLIED — 지우는 문이 없다', () => {
  beforeEach(() => {
    getTerraformStatus.mockResolvedValue({ overall_state: 'APPLIED' });
  });

  /**
   * 부모가 아는 상태로 **첫 렌더부터** 막힌 화면이 선다. 조회를 기다렸다가 그리면 첫
   * 프레임이 목록 + 입력(`checking`)이고, 상자가 그 높이로 고정된 뒤 짧은 본문이 도착해
   * 빈 칸이 남는다 — 이 단언은 `await` 없이 서야 그것을 잡는다.
   */
  it('부모가 아는 상태면 첫 렌더부터 막힌 화면이다', async () => {
    mount(2, 'APPLIED');

    expect(screen.getByText('지금은 삭제할 수 없습니다')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    // 확인 전에도 이동은 열려 있다 — 파괴적이지 않은 유일한 동작이다.
    expect(button('인프라 작업 탭으로').disabled).toBe(false);
    // 마운트 재조회가 정착하는 것까지 이 테스트 안에서 끝낸다 — 화면은 그대로다.
    expect(await screen.findByText('지금은 삭제할 수 없습니다')).toBeTruthy();
  });

  it('본문이 아예 없고, 누를 수 있는 것은 인프라 작업 탭으로 가는 길뿐이다', async () => {
    mount();

    expect(await screen.findByText('지금은 삭제할 수 없습니다')).toBeTruthy();
    // 지울 수 없는 화면에서 대상 id 를 치게 하는 것은 할 수 없는 동작을 준비시키는 일이다.
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: '삭제' })).toBeNull();
    // 막힌 화면의 본문은 사라졌다 — Terraform 상태 태그도 건수 칸도 없다.
    expect(screen.queryByText('적용 완료')).toBeNull();
    expect(screen.queryByText('2건')).toBeNull();

    fireEvent.click(button('인프라 작업 탭으로'));
    expect(onOpenInfra).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(deleteConfirmedResources).not.toHaveBeenCalled();
  });
});

describe('NEVER_APPLIED — 대상 id 를 친 뒤에만 열린다', () => {
  beforeEach(() => {
    getTerraformStatus.mockResolvedValue({ overall_state: 'NEVER_APPLIED' });
  });

  it('입력이 맞아야 삭제가 열리고, 성공하면 모달이 스스로 닫히며 뒤 화면이 갱신된다', async () => {
    mount();

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await waitFor(() => expect(input.disabled).toBe(false));
    expect(screen.getByText(/확정 정보 2건을 삭제할까요\?/)).toBeTruthy();
    // 본문은 입력 하나다 — 지워질 것의 이름은 어디에도 없다.
    expect(screen.queryByText('confirmed-0')).toBeNull();
    expect(screen.queryByText('confirmed-1')).toBeNull();
    expect(button('삭제').disabled).toBe(true);

    fireEvent.change(input, { target: { value: '99' } });
    expect(button('삭제').disabled).toBe(true);

    fireEvent.change(input, { target: { value: '1642' } });
    expect(button('삭제').disabled).toBe(false);

    fireEvent.click(button('삭제'));
    await waitFor(() => expect(deleteConfirmedResources).toHaveBeenCalledWith(1642, 'AWS'));

    // 성공 프레임은 없다 — 뒤 화면이 기록이라 모달은 저 혼자 닫히고 탭이 다시 읽는다.
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('확정 정보를 삭제했습니다')).toBeNull();
  });

  it('실패는 결과 프레임이 받는다 — 닫기와 다시 요청하기가 선다', async () => {
    deleteConfirmedResources.mockRejectedValue(new Error('boom'));
    mount();

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await waitFor(() => expect(input.disabled).toBe(false));
    fireEvent.change(input, { target: { value: '1642' } });
    fireEvent.click(button('삭제'));

    expect(await screen.findByText('삭제하지 못했습니다')).toBeTruthy();
    expect(button('다시 요청하기')).toBeTruthy();
    expect(button('닫기')).toBeTruthy();
    // 서버를 바꾸지 못했으므로 뒤 화면을 다시 읽을 일이 없다.
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('확인이 끝나기 전 — 아는 것은 말하되 아무것도 열지 않는다', () => {
  it('부모가 준 값이 없으면 조회 중이라고 말하고, 실행도 입력도 닫혀 있다', () => {
    getTerraformStatus.mockReturnValue(new Promise(() => {}));
    mount();

    expect(screen.getByText('확정 정보 2건을 삭제할까요?')).toBeTruthy();
    expect(screen.getByText(/Terraform 상태를 확인하는 중입니다\./)).toBeTruthy();
    expect((screen.getByRole('textbox') as HTMLInputElement).disabled).toBe(true);
    expect(button('삭제').disabled).toBe(true);
  });

  it('아는 상태로 서더라도 허용 화면은 Terraform 을 말하지 않는다', () => {
    getTerraformStatus.mockReturnValue(new Promise(() => {}));
    mount(2, 'NEVER_APPLIED');

    // 지울 수 있는 화면이 하는 말은 삭제의 결과뿐이다 — Terraform 문장은 막힌 화면 몫이다.
    expect(screen.getByText(/삭제하면 재승인 절차를 처음부터 다시 진행해야 합니다\./)).toBeTruthy();
    expect(screen.queryByText(/철거할 인프라가 없습니다/)).toBeNull();
    expect((screen.getByRole('textbox') as HTMLInputElement).disabled).toBe(true);
    expect(button('삭제').disabled).toBe(true);
  });
});

describe('조회 실패 — 사람이 직접 확인했다고 말하기 전에는 열리지 않는다', () => {
  beforeEach(() => {
    getTerraformStatus.mockRejectedValue(new Error('boom'));
  });

  it('체크박스를 켜야 입력이 살아난다', async () => {
    mount();

    expect(await screen.findByText('Terraform 상태를 확인하지 못했습니다')).toBeTruthy();
    expect(screen.getByRole('button', { name: '다시 확인' })).toBeTruthy();

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.disabled).toBe(true);

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(input.disabled).toBe(false);
    expect(button('삭제').disabled).toBe(true);

    fireEvent.change(input, { target: { value: '1642' } });
    expect(button('삭제').disabled).toBe(false);
  });
});
