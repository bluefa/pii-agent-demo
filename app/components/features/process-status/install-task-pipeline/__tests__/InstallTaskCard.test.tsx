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

  it('renders 대기 for pending', () => {
    const html = renderToStaticMarkup(<InstallTaskCard {...baseProps} status="pending" />);
    expect(html).toContain('대기');
  });

  it('renders 진행중 for running without counts', () => {
    const html = renderToStaticMarkup(<InstallTaskCard {...baseProps} status="running" />);
    expect(html).toContain('진행중');
    expect(html).not.toContain('진행중 (');
  });

  it('renders plain 진행중 (no count suffix) even when counts are passed', () => {
    const html = renderToStaticMarkup(
      <InstallTaskCard {...baseProps} status="running" completedCount={2} activeCount={5} />,
    );
    expect(html).toContain('진행중');
    expect(html).not.toContain('진행중 (');
    expect(html).not.toContain('(2/5)');
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
      <InstallTaskCard num={2} title="t" status="pending" />,
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
  it('renders a › chevron glyph when showConnector is true', () => {
    const html = renderToStaticMarkup(
      <InstallTaskCard {...baseProps} status="done" showConnector />,
    );
    // v15 `.install-task::after` — `›` glyph at right -14, #B0B8C1, 22px.
    expect(html).toContain('right-[-14px]');
    expect(html).toContain('text-[#B0B8C1]');
    expect(html).toContain('›');
    expect(html).toContain('aria-hidden="true"');
  });

  it('omits chevron when showConnector is false or undefined', () => {
    const without = renderToStaticMarkup(
      <InstallTaskCard {...baseProps} status="done" />,
    );
    const explicitFalse = renderToStaticMarkup(
      <InstallTaskCard {...baseProps} status="done" showConnector={false} />,
    );
    expect(without).not.toContain('right-[-14px]');
    expect(explicitFalse).not.toContain('right-[-14px]');
  });

  it('does not use inline left-percent style anywhere (AP-E2)', () => {
    const html = renderToStaticMarkup(
      <InstallTaskCard {...baseProps} status="running" showConnector activeCount={3} completedCount={1} />,
    );
    expect(html).not.toMatch(/style="[^"]*left:\s*\d/);
  });
});

describe('InstallTaskCard — card surface', () => {
  it('uses uniform rounded-xl with all corners (v15 12px all corners)', () => {
    const html = renderToStaticMarkup(<InstallTaskCard {...baseProps} status="pending" />);
    expect(html).toContain('rounded-xl');
    expect(html).toContain('border-0');
    expect(html).not.toContain('rounded-l-[10px]');
    expect(html).not.toContain('rounded-r-[10px]');
  });

  it('tints the done card #ECFDF5 and running card #EFF6FF', () => {
    const done = renderToStaticMarkup(<InstallTaskCard {...baseProps} status="done" />);
    const running = renderToStaticMarkup(<InstallTaskCard {...baseProps} status="running" />);
    const pending = renderToStaticMarkup(<InstallTaskCard {...baseProps} status="pending" />);
    expect(done).toContain('bg-[#ECFDF5]');
    expect(running).toContain('bg-[#EFF6FF]');
    expect(pending).toContain('bg-[#F7F8FA]');
  });

  it('renders the 진행중 pill on the primary #0064FF fill', () => {
    const html = renderToStaticMarkup(<InstallTaskCard {...baseProps} status="running" />);
    expect(html).toContain('bg-[#0064FF]');
  });
});
