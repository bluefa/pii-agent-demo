/**
 * 판과 칩은 한 목록의 두 얼굴이다.
 *
 * 판이 자유 입력을 대신 쳐 주는 자리인 이상, 타일을 켠 값과 직접 친 값은 구별되지 않아야
 * 한다 — 같은 이름을 두 번 넣을 수 없고, 어느 쪽에서 지우든 목록에서 빠진다. 두 상한
 * (20개 · 50자)은 판이 생겼다고 사라지지 않는다.
 */
// @vitest-environment jsdom
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SDU_DB_TYPE_MAX, SDU_DB_TYPE_MAXLEN, type SduCloud } from '@/lib/types/sdu';
import { DatabaseTypeGrid } from '@/app/target-sources/[targetSourceId]/_components/sdu/step1/DatabaseTypeGrid';

/** 값은 부모가 들고 있는 컴포넌트라, 상한 판정도 "다음 값"이 아니라 현재 값으로 돈다. */
const Harness = ({
  initial = [],
  cloud = 'AWS',
  onValues,
}: {
  initial?: string[];
  cloud?: SduCloud;
  onValues?: (next: string[]) => void;
}) => {
  const [values, setValues] = useState<string[]>(initial);
  return (
    <DatabaseTypeGrid
      cloud={cloud}
      values={values}
      onChange={(next) => {
        setValues(next);
        onValues?.(next);
      }}
    />
  );
};

const tile = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
const openTyping = () => fireEvent.click(screen.getByRole('button', { name: /직접 입력/ }));
const input = () => screen.getByLabelText('Database Type 직접 입력') as HTMLInputElement;
const type = (text: string) => fireEvent.change(input(), { target: { value: text } });
const enter = () => fireEvent.keyDown(input(), { key: 'Enter' });

const filled = Array.from({ length: SDU_DB_TYPE_MAX }, (_, i) => `TYPE-${i + 1}`);

describe('타일 판', () => {
  it('타일을 켜면 그 이름이 목록에 들어가고, 다시 누르면 빠진다', () => {
    const onValues = vi.fn();
    render(<Harness onValues={onValues} />);

    fireEvent.click(tile('MySQL'));
    expect(onValues).toHaveBeenLastCalledWith(['MySQL']);
    expect(tile('MySQL').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(`1 / ${SDU_DB_TYPE_MAX}`)).toBeTruthy();

    fireEvent.click(tile('MySQL'));
    expect(onValues).toHaveBeenLastCalledWith([]);
    expect(tile('MySQL').getAttribute('aria-pressed')).toBe('false');
  });

  it('대소문자만 다른 이름을 이미 갖고 있으면 타일은 켜진 채로 선다', () => {
    // 한 종을 두 번 세지 않는다 — `sduDraftDbTypeCount` 와 같은 규칙이다.
    const onValues = vi.fn();
    render(<Harness initial={['mysql']} onValues={onValues} />);

    expect(tile('MySQL').getAttribute('aria-pressed')).toBe('true');
    // 판이 이름을 가진 값이므로 칩으로 한 번 더 그리지 않는다.
    expect(screen.queryByRole('button', { name: 'mysql 제거' })).toBeNull();

    fireEvent.click(tile('MySQL'));
    expect(onValues).toHaveBeenLastCalledWith([]);
  });
});

describe('이름의 출처', () => {
  it('판이 묻는 이름은 그 클라우드의 백엔드 열거형에서 온다', () => {
    // 지어낸 목록이 아니다 — 「인프라 등록」이 묻는 것과 같은 `DB_TYPES_BY_PROVIDER` 다.
    render(<Harness cloud="GCP" />);
    expect(tile('BigQuery')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'DynamoDB' })).toBeNull();
    // Redis 는 어느 클라우드의 열거형에도 없다.
    expect(screen.queryByRole('button', { name: 'Redis' })).toBeNull();

    render(<Harness cloud="AWS" />);
    expect(screen.getByRole('button', { name: 'DynamoDB' })).toBeTruthy();
  });

  it('나가는 길은 판의 스크롤러 바깥에 선다 — 목록이 길다고 사라지지 않는다', () => {
    // 기타는 다섯 클라우드 중 목록이 가장 길다(17개, 다섯 줄). 그때 잘려도 되는 줄과
    // 잘리면 안 되는 줄을 구조가 갈라 놓는다.
    render(<Harness cloud="OTHER" />);
    const board = screen.getByRole('group', { name: '자주 쓰는 Database Type' });

    expect(board.contains(screen.getByRole('button', { name: /직접 입력/ }))).toBe(false);
    expect(board.contains(screen.getByText(`0 / ${SDU_DB_TYPE_MAX}`))).toBe(false);
    // 넘치는 몫은 판이 자기 안에서 굴린다. jsdom 은 레이아웃이 없어서 이것만 볼 수 있다.
    expect(board.className).toContain('overflow-y-auto');
  });

  it('클라우드를 바꿔 판에서 사라진 이름은 칩으로 남는다 — 조용히 버리지 않는다', () => {
    // 자유 입력이라 DynamoDB 는 GCP 대상에서도 유효한 값이다. 고른 적 있는 것을
    // 화면이 마음대로 지우면, 담당자는 지운 적 없는 값이 사라진 것을 보게 된다.
    render(<Harness cloud="GCP" initial={['DynamoDB']} />);

    expect(screen.getByRole('button', { name: 'DynamoDB 제거' })).toBeTruthy();
    expect(screen.getByText(`1 / ${SDU_DB_TYPE_MAX}`)).toBeTruthy();
  });
});

describe('직접 입력', () => {
  it('판에 없는 이름은 칩이 되고, 칩에서 지우면 목록에서 빠진다', () => {
    const onValues = vi.fn();
    render(<Harness onValues={onValues} />);
    openTyping();
    type('CUBRID');
    enter();

    expect(onValues).toHaveBeenLastCalledWith(['CUBRID']);
    expect(input().value).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'CUBRID 제거' }));
    expect(onValues).toHaveBeenLastCalledWith([]);
  });

  it('켜져 있는 타일과 같은 이름은 거절하고, 값은 입력칸에 남는다', () => {
    render(<Harness />);
    fireEvent.click(tile('Oracle'));
    openTyping();
    type('oracle');
    enter();

    expect(screen.getByText('이미 추가한 타입이에요')).toBeTruthy();
    expect(input().value).toBe('oracle');
    expect(screen.getByText(`1 / ${SDU_DB_TYPE_MAX}`)).toBeTruthy();
  });

  it(`${SDU_DB_TYPE_MAX}개를 채우면 ${SDU_DB_TYPE_MAX + 1}번째를 받지 않고, 그렇게 말한다`, () => {
    render(<Harness initial={filled} />);
    openTyping();

    expect(screen.getByText(`${SDU_DB_TYPE_MAX} / ${SDU_DB_TYPE_MAX}`)).toBeTruthy();
    expect(screen.getByText(`대상당 ${SDU_DB_TYPE_MAX}개까지 등록할 수 있어요`)).toBeTruthy();
    // 입력칸과 판이 함께 닫힌다 — 한쪽만 닫으면 다른 쪽으로 21번째가 들어간다.
    expect(input().disabled).toBe(true);
    expect(tile('MySQL').disabled).toBe(true);
  });

  it('상한에 닿아도 이미 켜진 타일은 끌 수 있다', () => {
    const onValues = vi.fn();
    render(<Harness initial={[...filled.slice(1), 'Athena']} onValues={onValues} />);

    expect(tile('Athena').disabled).toBe(false);
    fireEvent.click(tile('Athena'));
    expect(onValues).toHaveBeenLastCalledWith(filled.slice(1));
  });

  it(`${SDU_DB_TYPE_MAXLEN + 1}자는 치는 동안 거절되고, 값은 입력칸에 남는다`, () => {
    render(<Harness />);
    openTyping();
    const tooLong = 'A'.repeat(SDU_DB_TYPE_MAXLEN + 1);
    type(tooLong);

    expect(
      screen.getByText(`Database Type은 ${SDU_DB_TYPE_MAXLEN}자까지 입력할 수 있어요`),
    ).toBeTruthy();
    expect(screen.getByText(`${SDU_DB_TYPE_MAXLEN + 1} / ${SDU_DB_TYPE_MAXLEN}`)).toBeTruthy();
    expect((screen.getByRole('button', { name: '추가' }) as HTMLButtonElement).disabled).toBe(true);

    enter();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(input().value).toBe(tooLong);
  });
});
