import { beforeEach, describe, expect, it } from 'vitest';
import { mockAws } from '@/lib/bff/mock/aws';
import { TERRAFORM_ROLE_REASON_CODES } from '@/app/components/features/process-status/aws/terraform-role-finding';
import { getStore } from '@/lib/mock-store';

/**
 * Step 4's role-verify panel reads its verdict off `terraform_execution_role_verify.status`
 * and calls verify-execution-role only when the user asks. Both halves have to be reachable
 * from a fixture: a target that declares a failed verification, and a reason for it.
 */
const ROLE_VERIFY_FAILED = '1019'; // terraformState.roleVerify: FAILED
const ROLE_VERIFY_COMPLETED = '1009'; // terraformState.roleVerify: COMPLETED
const NO_ROLE_VERIFY_INSTALLING = '1006'; // unspecified, serviceTf PENDING
const NO_ROLE_VERIFY_COMPLETED = '1012'; // unspecified, serviceTf COMPLETED

interface InstallBody {
  terraform_execution_role_verify?: { status?: string; role_arn?: string | null };
}
interface VerifyBody {
  status?: string;
  fail_reason?: string | null;
  role_arn?: string | null;
}

const roleVerifyStatus = async (targetSourceId: string) => {
  const response = await mockAws.getInstallationStatus(targetSourceId);
  const body = (await response.json()) as InstallBody;
  return body.terraform_execution_role_verify?.status;
};

describe('mock AWS installation-status — terraform_execution_role_verify', () => {
  beforeEach(() => {
    globalThis.__piiAgentMockStore = undefined;
    getStore();
  });

  // The regression this pins: the handler used to collapse the fixture to
  // `roleVerify === 'COMPLETED'`, so a target declaring FAILED was served IN_PROGRESS
  // and the failed screen could not be opened.
  it('serves FAIL when the fixture declares a failed verification', async () => {
    expect(await roleVerifyStatus(ROLE_VERIFY_FAILED)).toBe('FAIL');
  });

  it('serves COMPLETED when the fixture declares a passed verification', async () => {
    expect(await roleVerifyStatus(ROLE_VERIFY_COMPLETED)).toBe('COMPLETED');
  });

  it('falls back to serviceTf when the fixture says nothing about role verification', async () => {
    expect(await roleVerifyStatus(NO_ROLE_VERIFY_INSTALLING)).toBe('IN_PROGRESS');
    expect(await roleVerifyStatus(NO_ROLE_VERIFY_COMPLETED)).toBe('COMPLETED');
  });
});

describe('mock AWS verify-execution-role', () => {
  beforeEach(() => {
    globalThis.__piiAgentMockStore = undefined;
    getStore();
  });

  // The enum says the verification failed; only this operation can say why. Without a
  // pinned reason the button on the failed screen would answer "no finding".
  it('answers the failed fixture with one of the frozen reason codes', async () => {
    const response = await mockAws.verifyExecutionRole(ROLE_VERIFY_FAILED);
    const body = (await response.json()) as VerifyBody;

    expect(body.status).toBe('INVALID');
    expect(body.fail_reason).toBe('ROLE_NOT_FOUND');
    expect(TERRAFORM_ROLE_REASON_CODES).toContain(body.fail_reason);
    // ROLE_NOT_FOUND means IAM lacks the role, not that the ARN is missing — the panel
    // prints that ARN one line above the reason, so the mock must keep answering with it.
    expect(body.role_arn).toBeTruthy();
  });

  it('leaves the passed fixture VALID', async () => {
    const response = await mockAws.verifyExecutionRole(ROLE_VERIFY_COMPLETED);
    const body = (await response.json()) as VerifyBody;

    expect(body.status).toBe('VALID');
    expect(body.fail_reason).toBeNull();
  });
});
