import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LAYOUT_PATH = resolve(
  __dirname,
  'CloudTargetSourceLayout.tsx',
);

describe('CloudTargetSourceLayout architecture (R1)', () => {
  const source = readFileSync(LAYOUT_PATH, 'utf8');

  it('does not reference the cloudProvider provider-axis token', () => {
    expect(source).not.toMatch(/\bcloudProvider\b/);
  });

  it('does not reference the awsInstallationMode token', () => {
    expect(source).not.toMatch(/\bawsInstallationMode\b/);
  });

  it('does not import or reference the CloudProvider type', () => {
    expect(source).not.toMatch(/\bCloudProvider\b/);
  });

  it('does not import or reference the AwsInstallationMode type', () => {
    expect(source).not.toMatch(/\bAwsInstallationMode\b/);
  });
});
