/**
 * vitest config pins env to `'node'`, so we use `renderToStaticMarkup`
 * to assert against rendered HTML — same pattern as `GuideCardPure.test.tsx`.
 */

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { InstallTaskCard } from '@/app/components/features/process-status/install-task-pipeline/InstallTaskCard';

const baseProps = {
  num: 1,
  title: '서비스 측 리소스 설치 진행',
  sub: 'VPC Peering / Firewall / Service Account 권한 위임 구성',
  position: 'first' as const,
};

describe('InstallTaskCard — status pill labels', () => {
  it('renders 완료 for done', () => {
    const html = renderToStaticMarkup(<InstallTaskCard {...baseProps} status="done" />);
    expect(html).toContain('완료');
  });

  it('renders 실패 for failed', () => {
    const html = renderToStaticMarkup(<InstallTaskCard {...baseProps} status="failed" />);
    expect(html).toContain('실패');
  });

  it('renders 해당없음 for pending', () => {
    const html = renderToStaticMarkup(<InstallTaskCard {...baseProps} status="pending" />);
    expect(html).toContain('해당없음');
  });

  it('renders 진행중 for running without counts', () => {
    const html = renderToStaticMarkup(<InstallTaskCard {...baseProps} status="running" />);
    expect(html).toContain('진행중');
    expect(html).not.toContain('진행중 (');
  });

  it('renders 진행중 (M/N) for running with activeCount', () => {
    const html = renderToStaticMarkup(
      <InstallTaskCard {...baseProps} status="running" completedCount={2} activeCount={5} />,
    );
    expect(html).toContain('진행중 (2/5)');
  });

  it('treats missing completedCount as 0 in M/N pill', () => {
    const html = renderToStaticMarkup(
      <InstallTaskCard {...baseProps} status="running" activeCount={3} />,
    );
    expect(html).toContain('진행중 (0/3)');
  });
});

describe('InstallTaskCard — title / sub / num', () => {
  it('renders title text', () => {
    const html = renderToStaticMarkup(
      <InstallTaskCard {...baseProps} status="pending" title="Subnet 생성 진행" />,
    );
    expect(html).toContain('Subnet 생성 진행');
  });

  it('renders sub text when provided', () => {
    const html = renderToStaticMarkup(
      <InstallTaskCard {...baseProps} status="pending" sub="custom subtitle" />,
    );
    expect(html).toContain('custom subtitle');
  });

  it('omits sub element when sub is undefined', () => {
    const html = renderToStaticMarkup(
      <InstallTaskCard num={2} title="t" status="pending" position="middle" />,
    );
    expect(html).not.toContain('custom subtitle');
    expect(html).toContain('t');
  });

  it('renders num content', () => {
    const html = renderToStaticMarkup(
      <InstallTaskCard {...baseProps} status="pending" num={3} />,
    );
    expect(html).toMatch(/>3</);
  });
});

describe('InstallTaskCard — onClick controls element type', () => {
  it('renders as <button> when onClick is provided', () => {
    const html = renderToStaticMarkup(
      <InstallTaskCard {...baseProps} status="running" onClick={() => undefined} />,
    );
    expect(html).toMatch(/^<button\b/);
    expect(html).toContain('type="button"');
  });

  it('renders as <div> when onClick is omitted', () => {
    const html = renderToStaticMarkup(<InstallTaskCard {...baseProps} status="running" />);
    expect(html).toMatch(/^<div\b/);
  });
});

describe('InstallTaskCard — connector chevron', () => {
  it('renders a chevron span when showConnector is true', () => {
    const html = renderToStaticMarkup(
      <InstallTaskCard {...baseProps} status="done" showConnector />,
    );
    expect(html).toContain('right-[-7px]');
    expect(html).toContain('aria-hidden="true"');
  });

  it('omits chevron when showConnector is false or undefined', () => {
    const without = renderToStaticMarkup(
      <InstallTaskCard {...baseProps} status="done" />,
    );
    const explicitFalse = renderToStaticMarkup(
      <InstallTaskCard {...baseProps} status="done" showConnector={false} />,
    );
    expect(without).not.toContain('right-[-7px]');
    expect(explicitFalse).not.toContain('right-[-7px]');
  });

  it('does not use inline left-percent style anywhere (AP-E2)', () => {
    const html = renderToStaticMarkup(
      <InstallTaskCard {...baseProps} status="running" showConnector activeCount={3} completedCount={1} />,
    );
    expect(html).not.toMatch(/style="[^"]*left:\s*\d/);
  });
});

describe('InstallTaskCard — position rounded class', () => {
  it('first position gets rounded-l-[10px]', () => {
    const html = renderToStaticMarkup(
      <InstallTaskCard {...baseProps} status="pending" position="first" />,
    );
    expect(html).toContain('rounded-l-[10px]');
    expect(html).not.toContain('rounded-r-[10px]');
  });

  it('middle position gets neither rounded corner', () => {
    const html = renderToStaticMarkup(
      <InstallTaskCard {...baseProps} status="pending" position="middle" />,
    );
    expect(html).not.toContain('rounded-l-[10px]');
    expect(html).not.toContain('rounded-r-[10px]');
  });

  it('last position gets rounded-r-[10px] without border-r-0', () => {
    const html = renderToStaticMarkup(
      <InstallTaskCard {...baseProps} status="pending" position="last" />,
    );
    expect(html).toContain('rounded-r-[10px]');
    expect(html).not.toContain('rounded-l-[10px]');
    expect(html).not.toContain('border-r-0');
  });
});
