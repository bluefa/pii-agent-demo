import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SLOT_FILES = [
  'InstallationStatusSlot.tsx',
  'ConfirmedResourcesSlot.tsx',
  'ConnectionTestSlot.tsx',
] as const;

const FORBIDDEN_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'useState', pattern: /\buseState\b/ },
  { name: 'useEffect', pattern: /\buseEffect\b/ },
  { name: 'getConfirmedIntegration (direct API call)', pattern: /\bgetConfirmedIntegration\b/ },
  { name: 'getApprovedIntegration (direct API call)', pattern: /\bgetApprovedIntegration\b/ },
  { name: 'getConfirmResources (direct API call)', pattern: /\bgetConfirmResources\b/ },
  { name: 'fetch( (raw network call)', pattern: /\bfetch\(/ },
];

describe('Slot purity guard (R2 coarse)', () => {
  for (const slotFile of SLOT_FILES) {
    const sourcePath = resolve(__dirname, slotFile);
    const source = readFileSync(sourcePath, 'utf8');

    for (const { name, pattern } of FORBIDDEN_PATTERNS) {
      it(`${slotFile} does not contain ${name}`, () => {
        expect(source).not.toMatch(pattern);
      });
    }
  }
});
