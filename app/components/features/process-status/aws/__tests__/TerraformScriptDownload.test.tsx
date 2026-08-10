// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TerraformScriptDownload } from '@/app/components/features/process-status/aws/TerraformScriptDownload';

const getAwsTerraformScript = vi.fn();
vi.mock('@/app/lib/api/aws', () => ({
  getAwsTerraformScript: (id: number) => getAwsTerraformScript(id),
}));

/**
 * The blob → anchor → revoke path is the only logic this component owns, and it
 * mounts in two places (참고 히어로 / 수동 단계 헤더), so both outcomes are pinned here.
 */

describe('TerraformScriptDownload', () => {
  beforeEach(() => {
    getAwsTerraformScript.mockReset();
    URL.createObjectURL = vi.fn(() => 'blob:tf');
    URL.revokeObjectURL = vi.fn();
  });

  it('받은 blob 을 targetSourceId 이름의 zip 으로 내려받고 objectURL 을 회수한다', async () => {
    getAwsTerraformScript.mockResolvedValue(new Blob(['tf']));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<TerraformScriptDownload targetSourceId={1008} />);
    fireEvent.click(screen.getByRole('button', { name: 'Terraform Script 다운로드' }));

    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(getAwsTerraformScript).toHaveBeenCalledWith(1008);
    const anchor = click.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('terraform-1008.zip');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:tf');

    click.mockRestore();
  });

  it('실패하면 캡션으로 알리고 버튼은 다시 눌리는 상태로 돌아온다', async () => {
    getAwsTerraformScript.mockRejectedValue(new Error('boom'));

    render(<TerraformScriptDownload targetSourceId={1008} />);
    fireEvent.click(screen.getByRole('button', { name: 'Terraform Script 다운로드' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('다운로드에 실패했습니다');
    expect(screen.getByRole('button', { name: 'Terraform Script 다운로드' }).hasAttribute('disabled')).toBe(false);
  });
});
