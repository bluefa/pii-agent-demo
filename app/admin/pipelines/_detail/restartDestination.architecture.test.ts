/**
 * 재시작 뒤 어디로 가는지는 두 진입점이 일부러 다르다(오너 2026-09-03).
 *
 *   · 작업 상세  — 원본 작업 하나를 설명하는 화면이라 새 작업으로 이동한다.
 *   · ops 인프라 탭 — 탭에서 시작한 조작이 사람을 탭 밖으로 던지지 않는다(기존 결정).
 *
 * 둘 다 `RestartModal.onStarted` 한 곳으로 들어오므로, 한쪽을 손보다 다른 쪽까지
 * 같이 바꿔 버리기 쉽다. 렌더 테스트로 잡으려면 페이지 하나를 통째로 세워야 해서,
 * 같은 폴더의 architecture 테스트들처럼 호출부를 소스에서 직접 고정한다.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string): string => readFileSync(resolve(__dirname, path), 'utf8');

describe('재시작 후 이동 — 진입점별로 다르다', () => {
  it('작업 상세는 새로 만들어진 작업으로 이동한다', () => {
    const source = read('../[pipelineId]/_components/PipelineDetailView.tsx');

    expect(source).toMatch(
      /onStarted=\{\(created\) =>\s*router\.push\(passRoutes\.pipelines\.pipeline\(created\.pipeline_id\)\)\}/,
    );
  });

  it('ops 인프라 탭은 제자리에서 갱신만 한다 — 이동하지 않는다', () => {
    const source = read('TargetPipelineSections.tsx');

    // 인자를 받지 않는 것이 요점이다 — 새 작업 id 를 쓰지 않으므로 갈 곳이 없다.
    // (이 파일에도 다른 용도의 router.push 가 있어 파일 전체로는 잴 수 없다.)
    expect(source).toMatch(/onStarted=\{\(\) => setRunsKey\(/);
    expect(source).not.toMatch(/onStarted=\{[^}]*router\.push/);
  });
});
