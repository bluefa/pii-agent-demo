// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { statusColors } from '@/lib/theme';
import { ServiceHeaderV7 } from '@/app/components/features/admin/v7/ServiceHeaderV7';

const header = (serviceName = '쿠폰·프로모션 발급 정산', isEosService?: boolean) =>
  render(
    <ServiceHeaderV7
      serviceCode="CPN"
      serviceName={serviceName}
      isEosService={isEosService}
      onAddInfra={vi.fn()}
    />,
  );

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

  /**
   * 오너 결정: `is_eos_service` 가 **명시적으로 true** 일 때만 EOS.
   *
   * 솔직히 적어 둔다 — 이 세 케이스는 `=== true` 를 truthy 로 완화해도 전부 통과한다
   * (뮤테이션으로 확인). 라우트가 `PageServiceItem.parse` 를 거치고 `Bool` 이
   * `z.boolean().nullable()` 이라, 이 prop 에 닿을 수 있는 값은 true/false/null/
   * undefined 뿐이고 그 넷에서는 두 표현이 같은 결과를 낸다. `=== true` 는 방어가
   * 아니라 의도의 표기다.
   *
   * 그러니 이 테스트가 지키는 것은 "명시적"이라는 낱말이 아니라 **세 상태의 매핑**이다.
   */
  describe('EOS 뱃지', () => {
    const badgeText = (isEos?: boolean) => {
      const view = header('고객센터 상담 이력', isEos);
      const text = [...view.container.querySelectorAll('span')]
        .map((s) => s.textContent?.trim())
        .find((t) => t === '서비스 미운영 EOS' || t === '운영 중');
      view.unmount();
      return text;
    };

    it('true 면 뜻과 약어를 한 태그로 묶어 그린다', () => {
      // `EOS` 만으로는 세 글자를 아는 사람에게만 읽힌다.
      expect(badgeText(true)).toBe('서비스 미운영 EOS');
    });

    it('false 는 운영 중이다', () => {
      expect(badgeText(false)).toBe('운영 중');
    });

    it('필드가 없으면(계약 반영 전) 지금 화면 그대로다', () => {
      expect(badgeText(undefined)).toBe('운영 중');
    });

    it('미운영은 빨강, 운영 중은 초록', () => {
      // 색 문자열을 추측하지 않고 토큰으로 비교한다 — success 는 'green' 이라는 낱말을
      // 쓰지 않는다(bg-[#45CB85]/10).
      const eos = header('x', true);
      const eosPill = [...eos.container.querySelectorAll('span')].find(
        (s) => s.textContent?.trim() === '서비스 미운영 EOS',
      );
      expect(eosPill?.className).toContain(statusColors.error.bg);
      expect(eosPill?.className).toContain(statusColors.error.textDark);
      expect(eosPill?.className).not.toContain(statusColors.success.bg);
      eos.unmount();

      const live = header('x', false);
      expect(statusPill(live.container)?.className).toContain(statusColors.success.bg);
      expect(statusPill(live.container)?.className).not.toContain(statusColors.error.bg);
      live.unmount();
    });
  });
});
