/**
 * Every hardcoded guide body must pass the same allow-list validator that
 * `GuideCardPure` runs at render time — an invalid entry would swap the
 * guide for the invalid-state card on the live page.
 */

import { describe, expect, it } from 'vitest';

import { GUIDE_SLOTS, resolveSlot } from '@/lib/constants/guide-registry';
import { STEP_GUIDE_HTML } from '@/lib/constants/step-guide-content';
import { GUIDE_NAMES } from '@/lib/types/guide';
import { GUIDE_VALIDATE_OPTIONS, validateGuideHtml } from '@/lib/utils/validate-guide-html';

import type { GuideSlotKey } from '@/lib/constants/guide-registry';

describe('STEP_GUIDE_HTML', () => {
  it.each(GUIDE_NAMES)('%s passes validateGuideHtml', (name) => {
    // Same options `GuideCardPure` renders with — validating a guide under the post
    // rules would reject the 안내 박스 the guides use.
    const result = validateGuideHtml(STEP_GUIDE_HTML[name], GUIDE_VALIDATE_OPTIONS);
    expect(result).toMatchObject({ valid: true });
  });
});

const bodyFor = (key: GuideSlotKey) => STEP_GUIDE_HTML[resolveSlot(key).guideName];

const EVERY_BODY = GUIDE_NAMES.map((name) => [name, STEP_GUIDE_HTML[name]] as const);

// ---------------------------------------------------------------------------
// The shared steps — one authored card each, reaching every integration type
// ---------------------------------------------------------------------------

type SharedStep = '2' | '3' | '5' | '6' | '7';

/**
 * ⛔ Derived from the registry, but still censused: the test below pins the exact five
 * keys, so a sixth provider FAILS here rather than quietly joining. That is the intent —
 * "shared by every type" is a claim about a known set, and a new type is a decision about
 * whether one authored card really does fit it, not a row to be swept in automatically.
 */
const slotsForStep = (step: SharedStep) =>
  (Object.keys(GUIDE_SLOTS) as GuideSlotKey[]).filter((key) => key.endsWith(`.${step}`));

/**
 * `bullets` is the flat `<li>` census, and it is only meaningful where the body has no
 * sub-lists. Steps 5 and 7 nest, so they are checked for blank rows and for the shape
 * of their nesting further down instead of by a single number nobody could verify.
 */
const SHARED_STEPS: { step: SharedStep; lines: string[]; bullets?: number }[] = [
  {
    step: '2',
    lines: [
      '<h4>PII Agent 담당자의 검토를 기다리고 있어요.</h4>',
      '제출하신 DB 연동 대상 목록을 담당자가 순차적으로 검토하고 있어요.',
      "우측 상단 <strong>'다시 요청하기'</strong>를 눌러 1단계로 돌아가",
      '<li>평균 1일 이내 검토가 완료됩니다. (주말·공휴일 제외)</li>',
      '<li>2일 이상 지연 시 <strong>협업 채널</strong>을 통해 문의를 남겨주세요.</li>',
    ],
    bullets: 2,
  },
  {
    step: '3',
    lines: [
      '<h4>담당자가 연동을 위한 환경을 구성하고 있어요.</h4>',
      '<p>연동할 준비가 완료되면 다음 단계로 넘어가요.</p>',
      '이전에 설치된 PII Agent 리소스 삭제 필요',
      '<li>최초 연동일 경우, 평균 10분 이내 완료됩니다.</li>',
      '<li>재연동일 경우, 평균 1일 소요됩니다. (주말·공휴일 제외)</li>',
      '<li>2일 이상 지연 시 <strong>협업 채널</strong>을 통해 문의를 남겨주세요.</li>',
    ],
    bullets: 3,
  },
  {
    step: '5',
    lines: [
      'DB에 접근하기 위한 DB Credential을 직접 등록해주시고',
      '<li>DB Credential 등록',
      '<li>DB Type별 user 생성 가이드</li>',
      '<li>DB별 Credential Key 입력',
      '<li>연결 테스트 진행',
      '<li>논리 DB 연동 설정',
      "<strong>'연동 논리 DB'</strong> 열의 건수를 눌러",
      "<strong>'다시 실행'</strong>으로 연결 테스트를 재수행한 후 <strong>'승인 요청'</strong>",
    ],
  },
  {
    step: '6',
    lines: [
      'meta/sample data가 정상 수집되는지 담당자가 확인하고 있어요.',
      "정상 수집 여부가 확인되면 <strong>'완료'</strong> 단계로 넘어가요.",
      '<blockquote>별도 조치가 필요한 경우 담당자가 개별 연락드릴 예정입니다.</blockquote>',
      '<li>평균 1일 소요되는 과정입니다. (주말·공휴일 제외)</li>',
      '<li>수집해야 할 데이터가 클 경우, 더 오래 소요될 수 있어요.</li>',
      '<li>3일 이상 지연 시 <strong>협업 채널</strong>을 통해 문의를 남겨주세요.</li>',
    ],
    bullets: 3,
  },
  {
    step: '7',
    lines: [
      '<h4>PII Agent 연동이 완료되었어요.</h4>',
      '<li><strong>Healthy</strong>: 정상 동작 중</li>',
      '<strong>Unhealthy</strong>: 3일 이상 meta/sample data 수집 실패',
      '<li>DB Credential Key가 변경된 경우',
      '<li>Agent가 설치된 DB 내 논리 DB 연동 추가/삭제가 필요한 경우',
      '<li>연동 후 추가/삭제된 DB가 있는 경우',
      "<strong>'인프라 변경'</strong>을 통해 <strong>'연동 대상 DB 선택'</strong> 단계로 돌아가",
    ],
  },
];

describe.each(SHARED_STEPS)(
  'step $step — one authored card, every integration type',
  ({ step, lines, bullets }) => {
    const keys = slotsForStep(step);

    it('covers AWS (both variants), Azure, GCP and IDC', () => {
      expect(keys.sort()).toEqual([
        `process.aws.auto.${step}`,
        `process.aws.manual.${step}`,
        `process.azure.${step}`,
        `process.gcp.${step}`,
        `process.idc.${step}`,
      ]);
    });

    it.each(keys)('%s renders it', (key) => {
      const html = bodyFor(key);
      for (const line of lines) expect(html).toContain(line);
    });

    it('gives them all the same body — one card authored, one string here', () => {
      expect(new Set(keys.map(bodyFor)).size).toBe(1);
    });

    it('has no blank row', () => {
      expect(bodyFor(keys[0])).not.toContain('<li></li>');
    });

    if (bullets !== undefined) {
      it(`has exactly ${bullets} bullets`, () => {
        expect(bodyFor(keys[0]).match(/<li>/g)).toHaveLength(bullets);
      });
    }
  },
);

// ---------------------------------------------------------------------------
// What the 2026-08-23 transcription reversed
// ---------------------------------------------------------------------------

/**
 * These three assertions are the whole point of the rewrite: the copy that shipped
 * before said the opposite of each one, deliberately, with a ⚠️ comment defending it.
 * The owner's source screens overruled all three, so they are pinned across EVERY body
 * — a half-migrated file, where one step still escalates to 담당자, is the failure this
 * catches.
 */
describe('the transcription reversed the old house rules', () => {
  it('escalates to the 협업 채널 card, never to 담당자에게 문의', () => {
    for (const [name, html] of EVERY_BODY) {
      expect(html, name).not.toContain('담당자에게 문의');
    }
    for (const step of ['2', '3', '6'] as const) {
      expect(bodyFor(slotsForStep(step)[0])).toContain(
        '<strong>협업 채널</strong>을 통해 문의를 남겨주세요.',
      );
    }
  });

  it('spells durations 「N일 … (주말·공휴일 제외)」, never 「N영업일」', () => {
    for (const [name, html] of EVERY_BODY) {
      expect(html, name).not.toContain('영업일');
    }
    expect(bodyFor('process.aws.auto.2')).toContain('평균 1일 이내 검토가 완료됩니다. (주말·공휴일 제외)');
  });

  it('never tells the reader to refresh', () => {
    // These pages still do not poll. The instruction is dropped on the owner's
    // authority, so its absence is the intent — not a sentence someone lost.
    for (const [name, html] of EVERY_BODY) {
      expect(html, name).not.toContain('새로고침');
    }
  });
});

describe('step 2 — the control the guide points at', () => {
  it("names '다시 요청하기', the label WaitingApprovalCancelButton actually draws", () => {
    const html = bodyFor('process.aws.auto.2');
    expect(html).toContain("<strong>'다시 요청하기'</strong>");
    // Both were names this copy carried for the same button before the source screens
    // settled it. Either one reappearing means the naming question was reopened by edit.
    expect(html).not.toContain('연동 대상 다시 선택하기');
    expect(html).not.toContain('전체 요청 취소');
  });
});

// ---------------------------------------------------------------------------
// Shape the copy check cannot see
// ---------------------------------------------------------------------------

describe('every body', () => {
  it.each(EVERY_BODY)('%s opens with its own <h4>', (_name, html) => {
    // The card header only ever prints 「가이드」 — a body with no <h4> renders headless.
    expect(html.startsWith('<h4>')).toBe(true);
  });

  it.each(EVERY_BODY)('%s carries no link', (_name, html) => {
    // The source's accordions and 외부 링크 have no body and no href, so their labels ship
    // as plain list items. A placeholder link is exactly what the file's rules refuse.
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('href');
  });
});

describe('the source nests, and so does the copy', () => {
  /**
   * Flattening a sub-list is invisible to a line-by-line copy check — every sentence is
   * still present, one indent shallower — so the nesting is pinned as shape. Each
   * fragment below closes the parent `<li>` too, which is what makes it a nesting
   * assertion rather than a sibling one.
   */
  it.each([
    ['process.aws.auto.1', '<ul><li>Infra Scan 권한 설정 가이드(스캔 불가 시 수행)</li></ul></li>'],
    ['process.idc.4', '<ul><li>SDS에서 운영하는 DB인 경우, DC Manager를 통해 접근 허용 등</li></ul></li>'],
    ['process.gcp.5', '<ul><li>DEV DB, STG DB, Temp DB, 타 시스템 사용 DB</li></ul></li>'],
    ['process.azure.7', '<ul><li>운영 중인 DB라면 재연동 조치가 필요해요.</li></ul></li>'],
  ] as [GuideSlotKey, string][])('%s keeps its sub-list', (key, fragment) => {
    expect(bodyFor(key)).toContain(fragment);
  });
});

describe('the owner steps set their note on a blockquote', () => {
  it.each(['2', '3', '6'] as const)('step %s', (step) => {
    const html = bodyFor(slotsForStep(step)[0]);
    // ⛔ Flattening this back to <p> loses the grey card the design draws — there is no
    // other way to say "this paragraph is an aside" inside the guide allow-list.
    expect(html.match(/<blockquote>/g)).toHaveLength(1);
    expect(html).toContain('</blockquote>');
  });
});

// ---------------------------------------------------------------------------
// The two steps that split by integration type
// ---------------------------------------------------------------------------

describe('step 1 — the VM row is the only thing that splits the cloud copy', () => {
  const VM_BULLET =
    '<li>VM에서 운영 중인 DB는 인프라 스캔을 지원하지 않아요. ' +
    "<strong>'VM DB 등록'</strong>을 통해 연동 대상 DB를 직접 등록해주세요.</li>";

  it('gives AWS and Azure the identical body', () => {
    expect(bodyFor('process.aws.auto.1')).toBe(bodyFor('process.azure.1'));
  });

  it('drops that one bullet for GCP, and changes nothing else', () => {
    // GCP has no VM integration (docs/cloud-provider-states.md); the source card drops
    // the bullet for that reason and keeps every other word. Asserting the whole string
    // is what makes "and nothing else" a fact rather than a hope.
    expect(bodyFor('process.aws.auto.1')).toContain(VM_BULLET);
    expect(bodyFor('process.gcp.1')).toBe(bodyFor('process.aws.auto.1').replace(VM_BULLET, ''));
  });

  it('has IDC type its targets in instead of scanning for them', () => {
    const html = bodyFor('process.idc.1');
    expect(html).toContain('<h4>연동 대상 DB의 접속 정보를 입력해주세요.</h4>');
    expect(html).not.toContain('스캔 시작');
  });
});

describe('step 4 — each AWS slot carries one branch', () => {
  const auto = bodyFor('process.aws.auto.4');
  const manual = bodyFor('process.aws.manual.4');

  it('shows its own branch and never the other', () => {
    expect(auto).toContain('<strong>자동 설치</strong>');
    expect(auto).toContain('<li>실행 권한 부여 가이드</li>');
    expect(auto).not.toContain('Terraform Script 실행 가이드');

    expect(manual).toContain('<strong>수동 설치</strong>');
    expect(manual).toContain('<li>Terraform Script 실행 가이드</li>');
    expect(manual).not.toContain('실행 권한 부여 가이드');
  });

  it('drops the two-branch lead — only one branch is on screen', () => {
    for (const html of [auto, manual]) expect(html).not.toContain('아래 두 갈래 중');
  });

  it('repeats the head and the tail the source prints for both branches', () => {
    for (const html of [auto, manual]) {
      expect(html).toContain('<h4>선택하신 설치 방식에 따라 진행해야 할 작업이 달라요.</h4>');
      expect(html).toContain('<li>BDC 측 리소스 생성까지 평균 2일 소요됩니다. (주말·공휴일 제외)</li>');
      expect(html).toContain('<li>이 단계에서 어떤 작업이 진행되나요</li>');
    }
  });
});
