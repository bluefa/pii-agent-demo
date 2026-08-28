/**
 * 「연동 대상 추가」 마법사 — 단계로 나눠 물었을 때 지켜야 하는 것들.
 *
 * 여기서 확인하는 것은 세 가지다: 못 가는 단계는 왜 못 가는지 말하는가, 네 단계를 다 걸으면
 * 담당자가 적은 값 그대로 돌아오는가, 그리고 적은 것이 있는 채로 나가면 되묻는가. 저장은
 * 이 모달의 일이 아니므로(1단계의 제출/저장이 한다) API 는 하나도 등장하지 않는다.
 */
// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SduAddTargetModal } from '@/app/target-sources/[targetSourceId]/_components/sdu/step1/SduAddTargetModal';

const wizard = () => within(screen.getByRole('dialog', { name: '연동 대상 추가' }));

const click = (name: string) => fireEvent.click(wizard().getByRole('button', { name }));

/** 나가는 길. 판에는 닫기 버튼이 없고 ESC 와 배경 클릭만 있다. */
const escape = () => fireEvent.keyDown(document, { key: 'Escape' });

const renderModal = () => {
  const onAdd = vi.fn();
  const onClose = vi.fn();
  render(
    <SduAddTargetModal scope="GLOBAL" newKey="sdu-new-0" onAdd={onAdd} onClose={onClose} />,
  );
  return { onAdd, onClose };
};

describe('단계 게이트', () => {
  it('업로드 IP 가 IPv4 가 아니면 다음 단계로 보내지 않고 사유를 말한다', () => {
    renderModal();
    click('다음');

    // 빈 칸으로 눌러도 조용히 아무 일도 없지 않다 — 비활성 버튼은 이유를 말하지 못한다.
    click('다음');
    expect(screen.getByText('올바른 IPv4 주소가 아니에요')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '업로드는 어느 IP에서 하나요?' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('업로드 IP'), { target: { value: '10.20.30.999' } });
    click('다음');
    expect(screen.getByText('올바른 IPv4 주소가 아니에요')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '업로드는 어느 IP에서 하나요?' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('업로드 IP'), { target: { value: '10.20.30.40' } });
    expect(screen.queryByText('올바른 IPv4 주소가 아니에요')).toBeNull();
    click('다음');
    expect(screen.getByRole('heading', { name: '어떤 Database를 올리나요?' })).toBeTruthy();
  });

  it('Database Type 이 하나도 없으면 확인 단계로 보내지 않는다', () => {
    renderModal();
    click('다음');
    fireEvent.change(screen.getByLabelText('업로드 IP'), { target: { value: '10.20.30.40' } });
    click('다음');

    click('다음');
    expect(screen.getByText('Database Type을 하나 이상 추가해 주세요')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '어떤 Database를 올리나요?' })).toBeTruthy();
  });
});

describe('네 단계를 다 걸었을 때', () => {
  it('적은 네 값을 그대로 돌려주고, 저장은 하지 않는다', () => {
    const { onAdd, onClose } = renderModal();

    fireEvent.click(wizard().getByRole('radio', { name: 'GCP' }));
    fireEvent.click(wizard().getByRole('radio', { name: 'EU' }));
    click('다음');

    fireEvent.change(screen.getByLabelText('업로드 IP'), { target: { value: '10.20.30.40' } });
    click('다음');

    click('MySQL');
    click('다음');

    // 확인 단계는 고치는 자리가 아니라 읽어 주는 자리다. Database Type 은 이름을 늘어놓지
    // 않고 몇 종인지만 말한다 — 한 대상이 20종까지 가질 수 있다.
    const summary = wizard();
    expect(summary.getByText('GCP')).toBeTruthy();
    expect(summary.getByText('EU')).toBeTruthy();
    expect(summary.getByText('10.20.30.40')).toBeTruthy();
    expect(summary.getByText('1개 데이터베이스 선택')).toBeTruthy();
    expect(summary.queryByText('MySQL')).toBeNull();

    click('대상 추가');

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith({
      key: 'sdu-new-0',
      targetId: '',
      cloud: 'GCP',
      region: 'eu',
      uploadIp: '10.20.30.40',
      databaseTypes: ['MySQL'],
      removed: false,
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('나가기', () => {
  it('적은 것이 있으면 되묻고, 아무것도 돌려주지 않는다', () => {
    const { onAdd, onClose } = renderModal();
    click('다음');
    fireEvent.change(screen.getByLabelText('업로드 IP'), { target: { value: '10.20.30.40' } });

    escape();

    expect(screen.getByText('대상 추가를 그만두시겠어요?')).toBeTruthy();
    expect(screen.getByText('지금 닫으면 입력한 내용이 사라져요.')).toBeTruthy();
    expect(onAdd).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    // 계속 작성 — 되묻는 창의 존재 이유는 여기 남는 것이다.
    fireEvent.click(screen.getByRole('button', { name: '계속 작성' }));
    expect(screen.queryByText('대상 추가를 그만두시겠어요?')).toBeNull();
    expect(screen.getByLabelText('업로드 IP')).toBeTruthy();
  });

  it('아무것도 적지 않았으면 되묻지 않고 바로 닫힌다', () => {
    const { onClose } = renderModal();

    escape();

    expect(screen.queryByText('대상 추가를 그만두시겠어요?')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
