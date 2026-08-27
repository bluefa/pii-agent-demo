/**
 * Database Type 의 두 상한(20개 · 50자)은 **조용히 자르지 않는다**.
 *
 * 자유 입력을 허용한 순간 오타로 만든 이름이 목록을 채우기 때문에, 거절은 사유와 함께
 * 보여야 하고 거절된 값은 사용자 손에 남아 있어야 한다. 서버도 같은 규칙으로 400 을
 * 돌려주지만(lib/bff/mock/sdu.ts), 그때는 이미 대상 저장을 눌러 본 뒤다.
 */
// @vitest-environment jsdom
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SDU_DB_TYPE_MAX, SDU_DB_TYPE_MAXLEN } from '@/lib/types/sdu';
import { DatabaseTypeTagInput } from '@/app/target-sources/[targetSourceId]/_components/sdu/step1/DatabaseTypeTagInput';

/** 값은 부모가 들고 있는 컴포넌트라, 상한 판정도 "다음 값"이 아니라 현재 값으로 돈다. */
const Harness = ({ initial = [] as string[] }) => {
  const [values, setValues] = useState<string[]>(initial);
  return <DatabaseTypeTagInput values={values} onChange={setValues} />;
};

const input = () => screen.getByLabelText('Database Type 직접 입력') as HTMLInputElement;
const type = (text: string) => fireEvent.change(input(), { target: { value: text } });
const enter = () => fireEvent.keyDown(input(), { key: 'Enter' });

const filled = Array.from({ length: SDU_DB_TYPE_MAX }, (_, i) => `TYPE-${i + 1}`);

describe('DatabaseTypeTagInput', () => {
  it('Enter 로 넣고 × 로 뺀다', () => {
    render(<Harness />);
    type('CUBRID');
    enter();

    expect(screen.getByText('CUBRID')).toBeTruthy();
    expect(input().value).toBe('');
    expect(screen.getByText(`1 / ${SDU_DB_TYPE_MAX}`)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'CUBRID 제거' }));
    expect(screen.queryByText('CUBRID')).toBeNull();
  });

  it('자주 쓰는 타입은 고르는 자리가 아니라 대신 쳐 주는 자리다', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'PostgreSQL' }));

    // 들어간 뒤에는 직접 친 값과 같은 토큰이고, 같은 이름을 두 번 넣을 수는 없다.
    expect(screen.getByRole('button', { name: 'PostgreSQL 제거' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'PostgreSQL' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it(`${SDU_DB_TYPE_MAX}개를 채우면 ${SDU_DB_TYPE_MAX + 1}번째를 받지 않고, 그렇게 말한다`, () => {
    render(<Harness initial={filled} />);

    expect(screen.getByText(`${SDU_DB_TYPE_MAX} / ${SDU_DB_TYPE_MAX}`)).toBeTruthy();
    expect(screen.getByText(`대상당 ${SDU_DB_TYPE_MAX}개까지 등록할 수 있어요`)).toBeTruthy();
    // 상한에 닿으면 입력칸과 빠른 추가가 함께 닫힌다 — 한쪽만 닫으면 다른 쪽으로 21번째가 들어간다.
    expect(input().disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'MySQL' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole('listitem')).toHaveLength(SDU_DB_TYPE_MAX);
  });

  it(`${SDU_DB_TYPE_MAXLEN + 1}자는 치는 동안 거절되고, 값은 입력칸에 남는다`, () => {
    render(<Harness />);
    const tooLong = 'A'.repeat(SDU_DB_TYPE_MAXLEN + 1);
    type(tooLong);

    // Enter 를 눌러 봐야 알게 두지 않는다 — 다 친 뒤에 지우게 된다.
    expect(screen.getByText(`Database Type은 ${SDU_DB_TYPE_MAXLEN}자까지 입력할 수 있어요`)).toBeTruthy();
    expect(screen.getByText(`${SDU_DB_TYPE_MAXLEN + 1} / ${SDU_DB_TYPE_MAXLEN}`)).toBeTruthy();
    expect((screen.getByRole('button', { name: '추가' }) as HTMLButtonElement).disabled).toBe(true);

    enter();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(input().value).toBe(tooLong);
  });

  it(`정확히 ${SDU_DB_TYPE_MAXLEN}자는 받는다 — 경계는 상한 안쪽이다`, () => {
    render(<Harness />);
    const atLimit = 'A'.repeat(SDU_DB_TYPE_MAXLEN);
    type(atLimit);
    enter();

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(input().value).toBe('');
  });
});
