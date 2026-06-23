// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { TfDownloadCard } from '@/app/components/features/process-status/install-task-pipeline/TfDownloadCard';

const baseProps = {
  sizeLabel: '12.4 KB',
  onGuide: () => undefined,
  onDownload: () => undefined,
};

describe('TfDownloadCard — content', () => {
  it('renders the title and meta pill with sizeLabel', () => {
    render(<TfDownloadCard {...baseProps} />);
    expect(screen.getByText('Terraform Script 다운로드')).toBeTruthy();
    expect(screen.getByText('.tf · 12.4 KB')).toBeTruthy();
  });

  it('renders both action buttons by default', () => {
    render(<TfDownloadCard {...baseProps} />);
    expect(screen.getByRole('button', { name: '가이드 보기' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Script 다운로드' })).toBeTruthy();
  });
});

describe('TfDownloadCard — actions', () => {
  it('fires onGuide when 가이드 보기 is clicked', () => {
    const onGuide = vi.fn();
    render(<TfDownloadCard {...baseProps} onGuide={onGuide} />);
    fireEvent.click(screen.getByRole('button', { name: '가이드 보기' }));
    expect(onGuide).toHaveBeenCalledTimes(1);
  });

  it('fires onDownload when Script 다운로드 is clicked', () => {
    const onDownload = vi.fn();
    render(<TfDownloadCard {...baseProps} onDownload={onDownload} />);
    fireEvent.click(screen.getByRole('button', { name: 'Script 다운로드' }));
    expect(onDownload).toHaveBeenCalledTimes(1);
  });
});

describe('TfDownloadCard — downloading state', () => {
  it('disables the primary button and swaps copy while downloading', () => {
    render(<TfDownloadCard {...baseProps} downloading />);
    const primary = screen.getByRole('button', { name: '다운로드 중...' });
    expect((primary as HTMLButtonElement).disabled).toBe(true);
  });
});
