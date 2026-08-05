// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';

import { IdcEndpointCell } from '@/app/admin/pipelines/queue/requests/_components/idcCells';

const IPS = ['10.20.1.11', '10.20.1.12', '10.20.1.13'];

// Every address also renders a CopyButton, so the toggle has to be named, not just
// asked for by role.
const TOGGLE = { name: /더보기|접기/ };

describe('IdcEndpointCell', () => {
  it('MULTIPLE_IP은 첫 주소만 두고 나머지를 토글 뒤로 접는다', () => {
    render(<IdcEndpointCell hosts={IPS} kind="MULTIPLE_IP" />);

    expect(screen.getByText('10.20.1.11')).toBeTruthy();
    expect(screen.queryByText('10.20.1.12')).toBeNull();
    expect(screen.getByRole('button', TOGGLE).textContent).toContain('IP 2개 더보기');
  });

  it('토글을 누르면 전부 펼쳐지고 다시 누르면 접힌다', () => {
    render(<IdcEndpointCell hosts={IPS} kind="MULTIPLE_IP" />);

    fireEvent.click(screen.getByRole('button', TOGGLE));
    IPS.forEach((ip) => expect(screen.getByText(ip)).toBeTruthy());
    expect(screen.getByRole('button', TOGGLE).textContent).toContain('접기');

    fireEvent.click(screen.getByRole('button', TOGGLE));
    expect(screen.queryByText('10.20.1.13')).toBeNull();
  });

  // A DOMAIN row has one hostname and a SINGLE row one IP — nothing is hidden, so drawing
  // a toggle would promise a disclosure that has nothing behind it. This is also what keeps
  // every row the same height: the toggle rides on the last visible address, so a row with
  // no toggle is not a line shorter than one with it.
  it.each(['SINGLE', 'DOMAIN'] as const)('%s은 토글을 그리지 않는다', (kind) => {
    render(<IdcEndpointCell hosts={['db.corp.internal']} kind={kind} />);
    expect(screen.queryByRole('button', TOGGLE)).toBeNull();
  });

  it('주소가 없으면 아무것도 렌더하지 않는다', () => {
    const { container } = render(<IdcEndpointCell hosts={[]} kind="SINGLE" />);
    expect(container.firstChild).toBeNull();
  });
});
