// @vitest-environment jsdom
/**
 * 확정 정보 삭제 모달 — 화면은 하나다.
 *
 * 여기 테스트가 지키는 것은 배치가 아니라 **누를 수 있는 것**이다: 입력은 처음부터 살아
 * 있고, 지우는 문은 대상 id 를 친 뒤에만 열린다. Terraform 은 더 이상 아무것도 막지
 * 않는다(오너 결정 09-04) — `APPLIED` 면 경고 한 문장이 붙을 뿐이고, 그 상태에서도
 * 삭제는 끝까지 간다. 그 문장은 부모가 준 값으로만 쓰므로 모달은 제 조회를 하지 않는다.
 * 모달은 건수만 말한다 — 지워질 것의 목록은 없다(오너 지시 09-04). 성공은 프레임 없이
 * 그대로 닫히고, 결과 프레임은 실패만 받는다.
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

const onClose = vi.fn();
const onDone = vi.fn();

/** `terraform` 은 부모 탭이 이미 읽어 둔 상태다 — 이 모달이 쓰는 것은 경고 문장 하나뿐이다. */
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
      onClose={onClose}
      onDone={onDone}
    />,
  );

const button = (name: string): HTMLButtonElement =>
  screen.getByRole('button', { name }) as HTMLButtonElement;

const TERRAFORM_SENTENCE = /Terraform 이 이 확정 정보로 인프라를 올린 상태입니다\./;

beforeEach(() => {
  vi.clearAllMocks();
  deleteConfirmedResources.mockResolvedValue({});
});

describe('한 화면 — 대상 id 를 친 뒤에만 열린다', () => {
  it('입력은 처음부터 살아 있고, 성공하면 모달이 스스로 닫히며 뒤 화면이 갱신된다', async () => {
    mount();

    // 확인을 기다리는 잠금은 없다 — 첫 프레임부터 칠 수 있다.
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.disabled).toBe(false);
    expect(screen.getByText('확정 정보 2건을 삭제할까요?')).toBeTruthy();
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

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '1642' } });
    fireEvent.click(button('삭제'));

    expect(await screen.findByText('삭제하지 못했습니다')).toBeTruthy();
    expect(button('다시 요청하기')).toBeTruthy();
    expect(button('닫기')).toBeTruthy();
    // 서버를 바꾸지 못했으므로 뒤 화면을 다시 읽을 일이 없다.
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('Terraform — 막지 않고 말한다', () => {
  it('APPLIED 면 경고 한 문장이 붙고, 그래도 삭제는 끝까지 간다', async () => {
    mount(2, 'APPLIED');

    expect(screen.getByText('확정 정보 2건을 삭제할까요?')).toBeTruthy();
    expect(screen.getByText(TERRAFORM_SENTENCE)).toBeTruthy();
    // 막힌 화면도, 그 화면의 출구도 없다.
    expect(screen.queryByRole('button', { name: '인프라 작업 탭으로' })).toBeNull();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '1642' } });
    expect(button('삭제').disabled).toBe(false);

    fireEvent.click(button('삭제'));
    await waitFor(() => expect(deleteConfirmedResources).toHaveBeenCalledWith(1642, 'AWS'));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });

  it('NEVER_APPLIED 와 값 없음은 Terraform 을 말하지 않는다', () => {
    const { unmount } = mount(2, 'NEVER_APPLIED');
    expect(screen.getByText(/삭제하면 재승인 절차를 처음부터 다시 진행해야 합니다\./)).toBeTruthy();
    expect(screen.queryByText(TERRAFORM_SENTENCE)).toBeNull();
    unmount();

    mount();
    expect(screen.queryByText(TERRAFORM_SENTENCE)).toBeNull();
  });

  it('이 모달은 terraform-status 를 제가 부르지 않는다', () => {
    mount(2, 'APPLIED');
    expect(getTerraformStatus).not.toHaveBeenCalled();
  });
});
