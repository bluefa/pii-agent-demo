/**
 * healthStatus 문구의 스코프 트립와이어.
 *
 * §10(`docs/api/ops-assumed-contracts.md`)은 `healthStatus` 의 산식을 BE 미회신 열린
 * 질문으로 두면서 UI 문구를 "최근 7일 DAG 실행 기준"까지로 묶는다. 그 제약을 문서와
 * 주석에만 두면 다음 카피 라운드가 조용히 걷어 간다 — 실제로 한 번 걷혔다가 교차
 * 리뷰에서 잡혔다.
 *
 * 소스를 읽는 검사인 이유: 문구는 게이트 행의 JSX prop 과 탭의 로컬 함수에 리터럴로
 * 살아서 순수 함수로 부를 손잡이가 없다. 이 검사가 지키는 것은 렌더 결과가 아니라
 * **문장에 스코프가 붙어 있다는 사실**이다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const TABS = path.join(
  process.cwd(),
  'app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs',
);
const read = (file: string): string => readFileSync(path.join(TABS, file), 'utf8');

/**
 * 주석을 걷고 나서 읽는다. 이 파일들의 주석에는 제약을 설명하려고 옛 문구를 그대로
 * 인용해 둔 줄이 있어서(⛔ 블록), 걷지 않으면 **주석이 화면인 척한다** — 실제로 첫 실행이
 * 주석 속 인용구를 잡고 빨갛게 떨어졌다. 화면에 서는 것만 세는 것이 이 검사의 전부다.
 */
const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** 화면에 서는 '정상' 문장 — 리터럴만. */
const claims = (src: string): string[] =>
  [...code(src).matchAll(/["']([^"'\n]*정상[^"'\n]*)["']/g)].map((m) => m[1]);

describe('healthStatus 를 근거로 하는 문장은 스코프를 달고 나온다', () => {
  it('승인 탭 게이트 ③ — 조건 문구', () => {
    const found = claims(read('ApprovalTab.tsx')).filter((c) => c.includes('DAG'));
    expect(found).not.toHaveLength(0);
    for (const claim of found) expect(claim).toContain('최근 7일');
  });

  it('Airflow 탭 — 판정 한 줄', () => {
    const found = claims(read('AirflowTab.tsx')).filter((c) => c.includes('DAG'));
    expect(found).not.toHaveLength(0);
    for (const claim of found) expect(claim).toContain('최근 7일');
  });

  it('§10 이 그 제약을 실제로 적고 있다 — 전제가 사라지면 이 검사도 만료다', () => {
    const spec = readFileSync(
      path.join(process.cwd(), 'docs/api/ops-assumed-contracts.md'),
      'utf8',
    );
    expect(spec).toContain('UI copy stops at "최근 7일 DAG 실행 기준"');
  });
});
