import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PROVIDER_PAGES = [
  'aws/AwsProjectPage.tsx',
  'azure/AzureProjectPage.tsx',
  'gcp/GcpProjectPage.tsx',
] as const;

const FORBIDDEN_RESOURCE_IMPORT = /from\s+['"]@\/lib\/types\/resources['"]/;
const FORBIDDEN_RESOURCE_TYPES = [
  'CandidateResource',
  'ApprovedResource',
  'ConfirmedResource',
] as const;

describe('Provider ProjectPage C1 boundary', () => {
  for (const relative of PROVIDER_PAGES) {
    const sourcePath = resolve(__dirname, relative);
    const source = readFileSync(sourcePath, 'utf8');

    it(`${relative} does not import from @/lib/types/resources`, () => {
      expect(source).not.toMatch(FORBIDDEN_RESOURCE_IMPORT);
    });

    for (const typeName of FORBIDDEN_RESOURCE_TYPES) {
      it(`${relative} does not reference resource-domain type ${typeName}`, () => {
        const pattern = new RegExp(`\\b${typeName}\\b`);
        expect(source).not.toMatch(pattern);
      });
    }
  }
});
