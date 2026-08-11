// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ServiceHeaderV7 } from '@/app/components/features/admin/v7/ServiceHeaderV7';

const header = (serviceName = '쿠폰·프로모션 발급 정산') =>
  render(<ServiceHeaderV7 serviceCode="CPN" serviceName={serviceName} onAddInfra={vi.fn()} />);

const cta = (root: HTMLElement) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent?.includes('인프라 등록'));

const statusPill = (root: HTMLElement) =>
  [...root.querySelectorAll('span')].find((s) => s.textContent?.trim() === '운영 중');

describe('ServiceHeaderV7', () => {
  /**
   * 오너 결정: CTA 는 h1 옆이 아니라 정체성 줄(서비스 이름 · 코드 · 운영 중)에 선다.
   * 같은 부모를 공유하는지로 확인한다 — 픽셀은 jsdom 이 계산하지 않으므로, 한 줄에
   * 있다는 말의 검증 가능한 형태는 "같은 flex 행의 형제"다.
   */
  it('puts the CTA on the 운영 중 line, not beside the h1', () => {
    const { container } = header();
    const button = cta(container);
    const pill = statusPill(container);
    expect(button).toBeDefined();
    expect(pill).toBeDefined();

    // 버튼의 부모 = 정체성 묶음의 부모. 즉 둘은 같은 행에 있다.
    expect(button?.parentElement).toBe(pill?.closest('div')?.parentElement);

    // h1 은 그 행 밖에 남는다 — 버튼이 제목 줄로 되돌아가면 여기서 잡힌다.
    const h1 = container.querySelector('h1');
    expect(button?.parentElement?.contains(h1 as Node)).toBe(false);
  });

  /**
   * 버튼은 정체성 묶음과 같은 wrap 목록에 있으면 안 된다. 서비스 이름이 길어지는 순간
   * 버튼이 먼저 다음 줄로 밀려, 헤더에 CTA 하나만 있는 빈 줄이 생긴다.
   */
  it('keeps the CTA out of the identity group wrap', () => {
    const { container } = header('아주 긴 서비스 이름이 들어오는 경우를 위한 30자 이상의 값');
    const button = cta(container);
    const group = statusPill(container)?.closest('div');
    expect(group?.className).toContain('flex-wrap');
    expect(group?.contains(button as Node), 'CTA 가 wrap 묶음 안에 있다').toBe(false);
    // 묶음이 짧아도 버튼은 오른쪽 끝에 남는다.
    expect(button?.className).toContain('ml-auto');
  });

  it('still labels the CTA 인프라 등록', () => {
    const { container } = header();
    expect(cta(container)?.textContent).toContain('인프라 등록');
  });

  it('renders the 운영 중 badge without a status dot', () => {
    const { container } = header();
    const pill = statusPill(container);
    expect(pill?.querySelector('span'), '뱃지 안에 점이 남아 있다').toBeNull();
    expect(pill?.className).not.toContain('gap-1.5');
  });
});
