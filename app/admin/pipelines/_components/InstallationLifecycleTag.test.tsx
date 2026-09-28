// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InstallationLifecycleTag } from '@/app/admin/pipelines/_components/InstallationLifecycleTag';

describe('InstallationLifecycleTag', () => {
  it('draws nothing when the response carried no value', () => {
    const { container } = render(<InstallationLifecycleTag status={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('names the state and explains it on hover', async () => {
    render(<InstallationLifecycleTag status="REINSTALLATION" />);
    const tag = screen.getByText('재설치');
    expect(screen.queryByText(/연동 초기화 뒤 1단계부터/)).toBeNull();

    fireEvent.mouseEnter(tag);
    expect(await screen.findByText(/연동 초기화 뒤 1단계부터/)).toBeTruthy();
  });
});
