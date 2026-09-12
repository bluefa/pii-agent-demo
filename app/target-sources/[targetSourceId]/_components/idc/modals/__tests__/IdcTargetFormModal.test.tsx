// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IdcTargetFormModal } from '@/app/target-sources/[targetSourceId]/_components/idc/modals/IdcTargetFormModal';
import { IDC_COPY } from '@/app/target-sources/[targetSourceId]/_components/idc/copy';

const t = IDC_COPY.ko;

const port = () => screen.getByPlaceholderText(t.formPortPlaceholder) as HTMLInputElement;
const cta = () => screen.getByRole('button', { name: t.add }) as HTMLButtonElement;

/** 주소와 DB 타입까지 채운 상태 — 포트만 남은 폼. DB 타입 선택이 기본 포트를 채운다. */
const openForm = () => {
  render(<IdcTargetFormModal isOpen onSubmit={vi.fn()} onClose={vi.fn()} />);
  fireEvent.change(screen.getByPlaceholderText(t.formIpPlaceholder), {
    target: { value: '10.0.0.1' },
  });
  fireEvent.change(screen.getByLabelText('Database Type'), { target: { value: 'MySQL' } });
};

/**
 * 포트는 정수만 받는다. `type=number` 입력은 `80.5` 를 그대로 넘기므로, 폼이 소수를
 * 통과시키면 서버(`lib/approval-selection.ts` 의 `.int()`)가 400 으로 거부한다 — 그 거부는
 * 새로고침으로 고칠 수 없다. 막는 자리는 값을 치는 이 폼이고, 판정은 EC2 추가 모달
 * (`Ec2AddModal` 의 `portOk`)과 같은 `Number.isInteger` 하나다.
 */
describe('IdcTargetFormModal — 포트는 정수만', () => {
  it('IP 와 DB 타입을 채우면 기본 포트가 들어오고 추가가 열린다', () => {
    openForm();

    expect(port().value).toBe('3306');
    expect(cta().disabled).toBe(false);
  });

  it('소수 포트는 추가를 잠그고 오류를 말한다', () => {
    openForm();
    fireEvent.change(port(), { target: { value: '80.5' } });

    expect(cta().disabled).toBe(true);
    expect(screen.getByText(t.formPortErr)).toBeTruthy();
  });

  it('정수로 고치면 다시 열린다', () => {
    openForm();
    fireEvent.change(port(), { target: { value: '80.5' } });
    fireEvent.change(port(), { target: { value: '8080' } });

    expect(cta().disabled).toBe(false);
    expect(screen.queryByText(t.formPortErr)).toBeNull();
  });
});
