// @vitest-environment jsdom
/**
 * 태그가 시스템 실행과 사람 실행을 서로 다른 모양으로 말하는지 — 이게 태그를
 * 도입한 이유다(오너 2026-09-03). 글자만 보고 구분하게 두면 태그로 감쌀 이유가 없다.
 */
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RequesterTag } from '@/app/admin/pipelines/_detail/RequesterTag';

afterEach(cleanup);

describe('RequesterTag', () => {
  it('marks a system run with the cog and prints 시스템, never the raw sentinel', () => {
    render(<RequesterTag requestedBy="SYSTEM" />);

    const tag = screen.getByTitle('시스템이 자동으로 시작한 실행입니다.');
    expect(tag.textContent).toBe('시스템');
    expect(tag.querySelector('svg')).not.toBeNull();
  });

  it('prints a person as the bare account id, with no cog to confuse it for a system run', () => {
    render(<RequesterTag requestedBy="admin-1" />);

    const tag = screen.getByTitle('admin-1 계정이 시작한 실행입니다.');
    expect(tag.textContent).toBe('admin-1');
    expect(tag.querySelector('svg')).toBeNull();
  });

  it('draws nothing when the backend recorded no requester', () => {
    const { container } = render(<RequesterTag requestedBy={null} />);

    expect(container.innerHTML).toBe('');
  });
});
