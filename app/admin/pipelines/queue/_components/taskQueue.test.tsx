import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StepStack, STEP } from '@/app/admin/pipelines/queue/_components/StepStack';
import {
  DelayText,
  delayTier,
  humanizeDelay,
} from '@/app/admin/pipelines/queue/_components/DelayText';

describe('StepStack', () => {
  it('renders the mono Step caption + Korean label for a status', () => {
    const html = renderToStaticMarkup(<StepStack status="PENDING" />);
    expect(html).toContain('Step 2');
    expect(html).toContain('연동 대상 승인 대기');
  });

  it('STEP maps every ProcessStatus to a 1-based step + label', () => {
    expect(STEP.IDLE.n).toBe(1);
    expect(STEP.COMPLETED.n).toBe(7);
    expect(STEP.INSTALLED.label).toBe('연결 테스트');
  });

  it('carries no state color — single gray label tag', () => {
    const html = renderToStaticMarkup(<StepStack status="COMPLETED" />);
    expect(html).toContain('bg-[var(--pl-gray-100)]');
    expect(html).not.toContain('--pl-ok');
    expect(html).not.toContain('--pl-warn');
  });
});

describe('humanizeDelay', () => {
  it('formats seconds / minutes / hours+minutes / days+hours', () => {
    expect(humanizeDelay(42)).toBe('42초');
    expect(humanizeDelay(18 * 60)).toBe('18분');
    expect(humanizeDelay(3 * 3600 + 25 * 60)).toBe('3시간 25분');
    expect(humanizeDelay(3600)).toBe('1시간');
    expect(humanizeDelay(14 * 86400 + 15 * 3600)).toBe('14일 15시간');
    expect(humanizeDelay(86400)).toBe('1일');
  });
});

describe('delayTier', () => {
  it('escalates at the 1h / 1d / 7d thresholds', () => {
    expect(delayTier(59 * 60)).toBe('d0');
    expect(delayTier(3600)).toBe('d1');
    expect(delayTier(86400)).toBe('d2');
    expect(delayTier(604800)).toBe('d3');
  });
});

describe('DelayText', () => {
  it('applies the tier tone + raw-seconds title', () => {
    const html = renderToStaticMarkup(<DelayText delaySeconds={604800} />);
    expect(html).toContain('text-[var(--pl-delay3-text)]');
    expect(html).toContain('604,800s');
    expect(html).toContain('7일');
  });

  it('uses the weak d0 tone under 1 hour', () => {
    const html = renderToStaticMarkup(<DelayText delaySeconds={600} />);
    expect(html).toContain('text-[var(--pl-text-weak)]');
    expect(html).toContain('10분');
  });
});
