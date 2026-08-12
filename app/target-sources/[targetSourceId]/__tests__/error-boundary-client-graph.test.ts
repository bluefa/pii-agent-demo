import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * `error.tsx` 는 `'use client'` 다. 즉 여기서 닿는 모든 모듈은 클라이언트 번들에 실린다.
 * `@/lib/bff/*` 는 서버 경계 안쪽이고(`docs/api/boundaries.md`), 형제 모듈
 * `lib/bff/client.ts` 는 이미 `import 'server-only'` 를 달고 있다. 그 선언이
 * `lib/bff/errors.ts` 로 번지는 날, **모든 게 실패했을 때 유일하게 떠야 할 화면**이
 * 빌드에서 깨진다.
 *
 * 직접 import 만 보면 안 된다 — 실제로 났던 위반이 전이적이었다:
 *   error.tsx → load-error.ts → @/lib/bff/errors
 * ESLint 의 `no-restricted-imports` 는 `app/components` 와 `app/integration` 아래의
 * 컴포넌트 디렉터리에만 걸려 있어(eslint.config.mjs) 이 경로를 보지 못한다.
 */
const REPO_ROOT = resolve(__dirname, '../../../..');
const ENTRY = 'app/target-sources/[targetSourceId]/error.tsx';

const IMPORT_RE = /from\s+['"]([^'"]+)['"]/g;
const CANDIDATE_EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

const readModule = (specifier: string): { path: string; source: string } | null => {
  const base = resolve(REPO_ROOT, specifier.replace(/^@\//, ''));
  for (const ext of ['', ...CANDIDATE_EXTENSIONS]) {
    try {
      return { path: `${specifier}${ext}`, source: readFileSync(`${base}${ext}`, 'utf8') };
    } catch {
      // 다음 확장자 후보로 넘어간다.
    }
  }
  return null;
};

/** `error.tsx` 에서 도달 가능한 `@/` 모듈 전부와, 각자가 어떤 경로로 닿았는지. */
const walkClientGraph = (): Map<string, string[]> => {
  const reached = new Map<string, string[]>();
  const queue: Array<{ specifier: string; trail: string[] }> = [
    { specifier: `@/${ENTRY}`, trail: [ENTRY] },
  ];

  while (queue.length > 0) {
    const { specifier, trail } = queue.shift()!;
    if (reached.has(specifier)) continue;
    const found = readModule(specifier);
    if (!found) continue;
    reached.set(specifier, trail);

    for (const [, target] of found.source.matchAll(IMPORT_RE)) {
      // 로컬 별칭만 따라간다. 패키지는 이 경계의 관심사가 아니다.
      if (target.startsWith('@/')) queue.push({ specifier: target, trail: [...trail, target] });
    }
  }
  return reached;
};

describe("error.tsx client graph ('use client' boundary)", () => {
  const graph = walkClientGraph();

  it('walks past the entry file — a graph of one would pass vacuously', () => {
    expect(graph.size).toBeGreaterThan(1);
  });

  it('reaches nothing under @/lib/bff', () => {
    const offenders = [...graph.entries()]
      .filter(([specifier]) => specifier.startsWith('@/lib/bff'))
      .map(([specifier, trail]) => `${specifier}\n    경로: ${trail.join(' → ')}`);

    expect(offenders, `클라이언트 그래프가 서버 경계에 닿았다:\n  ${offenders.join('\n  ')}`).toEqual(
      [],
    );
  });
});
