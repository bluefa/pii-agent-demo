/**
 * Every hardcoded guide body must pass the same allow-list validator that
 * `GuideCardPure` runs at render time — an invalid entry would swap the
 * guide for the invalid-state card on the live page.
 */

import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { GUIDE_SLOTS, resolveSlot } from '@/lib/constants/guide-registry';
import { STEP_GUIDE_HTML } from '@/lib/constants/step-guide-content';
import { GUIDE_NAMES } from '@/lib/types/guide';
import { GUIDE_VALIDATE_OPTIONS, validateGuideHtml } from '@/lib/utils/validate-guide-html';

import type { GuideSlotKey } from '@/lib/constants/guide-registry';
import type { GuideName } from '@/lib/types/guide';
import type { GuideNode } from '@/lib/utils/validate-guide-html';

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
      '<li><strong>DB Credential 등록</strong>',
      '<li><em>DB Type별 user 생성 가이드 ↗</em></li>',
      '<li><strong>DB별 Credential Key 입력</strong>',
      '<li><strong>연결 테스트 진행</strong>',
      '<li><strong>논리 DB 연동 설정</strong>',
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
      '<li><strong>DB Credential Key가 변경된 경우</strong>',
      '<li><strong>Agent가 설치된 DB 내 논리 DB 연동 추가/삭제가 필요한 경우</strong>',
      '<li><strong>연동 후 추가/삭제된 DB가 있는 경우</strong>',
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

/** The label the PENDING sub-state's control renders — the one Step 2's guide describes. */
const PENDING_CONTROL = '다시 요청하기';

describe('step 2 — the control the guide points at', () => {
  it("names '다시 요청하기', the label WaitingApprovalCancelButton actually draws", () => {
    const html = bodyFor('process.aws.auto.2');
    expect(html).toContain(`<strong>'${PENDING_CONTROL}'</strong>`);
    // ⛔ 「연동 대상 다시 선택하기」 is NOT another name for this button — it is
    // `WaitingApprovalReselectButton`, at the card's foot, and only in the REJECTED
    // sub-state, which this guide does not describe. The old copy sent a waiting reader
    // to a control that is not on their screen; this line is what stops it coming back.
    expect(html).not.toContain('연동 대상 다시 선택하기');
    expect(html).not.toContain('전체 요청 취소');
  });

  /**
   * The guide and the button are two files that have already drifted apart once — the whole
   * ⚠️ OPEN block this rewrite deleted was the record of that. Nothing but this test couples
   * them: rename the button and every other check in the repo still passes while the guide
   * quietly starts pointing at a control nobody can find.
   */
  it('says the same word the button source does', async () => {
    const source = await readFile(
      new URL(
        '../../../app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCancelButton.tsx',
        import.meta.url,
      ),
      'utf8',
    );
    expect(source).toContain(PENDING_CONTROL);
    expect(bodyFor('process.aws.auto.2')).toContain(`<strong>'${PENDING_CONTROL}'</strong>`);
  });
});

// ---------------------------------------------------------------------------
// Shape the copy check cannot see
// ---------------------------------------------------------------------------

/**
 * Cloud step 1 is the one body that must NOT open with a heading, and the exception is
 * spelled out rather than skipped: the panel header prints 「1단계 가이드」 and the card head
 * beside it prints 「연동 대상 DB 선택」 at 20px, so an <h4> here was that string's third copy
 * on one screen. Listed by name so a fourth headless body is a decision, not a slip.
 */
const HEADLESS_BY_DESIGN = new Set<GuideName>([
  'AWS_TARGET_CONFIRM',
  'AZURE_TARGET_CONFIRM',
  'GCP_TARGET_CONFIRM',
]);

describe('every body', () => {
  it.each(EVERY_BODY)('%s opens with its own <h4> — unless it must not', (name, html) => {
    // A body with no <h4> renders headless under a panel header that says only 「N단계 가이드」.
    // The inverse matters just as much: re-adding the heading to cloud step 1 fails here.
    expect(html.startsWith('<h4>')).toBe(!HEADLESS_BY_DESIGN.has(name));
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

  it('never opens two 안내 박스 on the same clause, in any body', () => {
    // The defect this generalizes: GCP step 4 shipped with two boxes both opening
    // 「PSC 연동(PRIVATE_IP_MODE · PSC_MODE)의 경우」, because the second belonged to a
    // block that had been deleted out from under it. Two adjacent asides with an
    // identical lead read as a duplicate no matter which one the reader trusts.
    //
    // Whole-corpus, not per-step: the guard above looks only at 2/3/6, which is exactly
    // why nobody noticed step 4 had grown a second box.
    for (const [name, html] of EVERY_BODY) {
      const leads = [...html.matchAll(/<blockquote>(?:<strong>)?([^<]{8,40})/g)].map((m) => m[1]);
      expect(new Set(leads).size, `${name} — ${leads.join(' / ')}`).toBe(leads.length);
    }
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

  /**
   * 오너 지시 2026-08-24. The source names one button; the strip renders two, and which one
   * a reader sees depends on whether this source has ever been scanned. Naming only the
   * first leaves everyone past their first scan looking for a control that is not there —
   * the same defect the step-2 name carried, caught before it shipped this time.
   *
   * Coupled to the component source for the same reason as step 2's: nothing else in the
   * repo ties the guide's words to the button's, and a rename would leave every other
   * check green.
   */
  it('names both scan buttons, because the strip renders both', async () => {
    const source = await readFile(
      new URL('../../../app/components/features/scan/ScanStrip.tsx', import.meta.url),
      'utf8',
    );
    const html = bodyFor('process.aws.auto.1');
    for (const label of ['스캔 시작', '다시 스캔']) {
      expect(source, `ScanStrip no longer renders ${label}`).toContain(`'${label}'`);
      expect(html).toContain(`'${label}'`);
    }
  });

  it('nests the 비대상 사유 options under the instruction that asks for them', () => {
    // The source nests them, and it is right to: the list enumerates what goes IN that
    // field. As a sibling bullet it reads as a separate thing to do.
    expect(bodyFor('process.aws.auto.1')).toContain(
      '<li>체크박스 해제 후 연동 비대상 사유를 입력해주세요.' +
        '<ul><li>Dev DB / Stg DB / Temp DB / 타 시스템 사용 DB / 기타 (직접 입력)</li></ul></li>',
    );
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
    expect(auto).toContain('<mark>자동 설치</mark>');
    expect(auto).toContain('<summary>실행 권한 부여 가이드</summary>');
    expect(auto).not.toContain('Terraform Script 실행 가이드');

    expect(manual).toContain('<mark>수동 설치</mark>');
    expect(manual).toContain('<summary>Terraform Script 실행 가이드</summary>');
    expect(manual).not.toContain('실행 권한 부여 가이드');
  });

  it('drops the two-branch lead — only one branch is on screen', () => {
    for (const html of [auto, manual]) expect(html).not.toContain('아래 두 갈래 중');
  });

  it('repeats the head and the tail the source prints for both branches', () => {
    for (const html of [auto, manual]) {
      expect(html).toContain('<h4>선택하신 설치 방식에 따라 진행해야 할 작업이 달라요.</h4>');
      expect(html).toContain('<li>BDC 측 리소스 생성까지 평균 2일 소요됩니다. (주말·공휴일 제외)</li>');
      expect(html).toContain('<summary>이 단계에서 어떤 작업이 진행되나요</summary>');
    }
  });
});

/**
 * 오너 지시 2026-08-24: the BDC-side block leaves the GCP guide. The source artifact still
 * carries it, so this is the one GCP slot that deliberately departs from the transcription
 * — without a test the next pass against the artifact reads the gap as a porting miss and
 * quietly puts it back.
 */
describe('step 4 — the GCP slot drops the BDC-side block', () => {
  const gcp = bodyFor('process.gcp.4');

  /**
   * Matched on TEXT, not on markup. The first version of these pins spelled the whole tag
   * — `<details><summary>…</summary></details>`, `<mark>BDC Side Terraform</mark>` — which
   * coupled them to `refBar()`'s template: add a class or a space to that helper and every
   * negative passes forever while the content walks back in. Whitespace is collapsed for
   * the same reason, so a re-transcription writing 「우리 측」 does not slip through.
   */
  const textOf = (html: string): string => html.replace(/<[^>]*>/g, '').replace(/\s+/g, '');

  it.each([
    'Service Side Terraform 실행 가이드',
    'BDC Side Terraform',
    '우리측 GCP Project에 PSC Connection',
    // Went with the block above it, one round later — it described that block's output.
    '연결 상태가 Pending이면',
  ])('no longer carries 「%s」', (removed) => {
    expect(textOf(gcp)).not.toContain(removed.replace(/\s+/g, ''));
  });

  it('is left with one 안내 박스, and it still carries both approval outcomes', () => {
    // The deleted box's content was not lost, it was already duplicated — so this asserts
    // the survivor still says both halves rather than merely counting boxes.
    expect(gcp.match(/<blockquote>/g)).toHaveLength(1);
    expect(gcp).toContain('승인 절차 없이 자동으로 연결돼요');
    expect(gcp).toContain('상대측 담당자의 수동 승인이 한 번 더 필요해요');
  });

  it('counts the blocks it actually prints', () => {
    // 「3가지」 outlived the third block by one edit. The reader can count the pills, so the
    // number is a claim the body either backs or contradicts.
    expect(gcp).toContain('아래 2가지 작업');
    expect(gcp.match(/<mark>/g) ?? []).toHaveLength(2);
  });

  it('keeps the Service-side work the owner did not remove', () => {
    expect(gcp).toContain('<mark>Service Side Subnet 생성</mark>');
    expect(gcp).toContain('<mark>Service Side Terraform</mark>');
  });
});

// ---------------------------------------------------------------------------
// The source's visual grammar
// ---------------------------------------------------------------------------

/**
 * The first pass ported every sentence and none of the shapes: accordions, external links
 * and pills all came out as plain bullets, and the rail stopped looking like the document
 * it was transcribed from. Words alone are not the deliverable, so the shapes are pinned
 * as hard as the words — a regression here is silent in a copy diff.
 */
describe('the source draws shapes, not only sentences', () => {
  /** Every `.accordion` in the source, and the body it belongs to. */
  const REF_BARS: [GuideSlotKey, string][] = [
    ['process.aws.auto.1', 'Infra Scan 권한 설정 가이드(스캔 불가 시 수행)'],
    ['process.gcp.1', 'Infra Scan 권한 설정 가이드(스캔 불가 시 수행)'],
    ['process.aws.auto.4', '실행 권한 부여 가이드'],
    ['process.aws.auto.4', '이 단계에서 어떤 작업이 진행되나요'],
    ['process.aws.manual.4', 'Terraform Script 실행 가이드'],
    ['process.azure.4', 'VM Subnet 생성을 위한 권한 부여 설정'],
    ['process.azure.4', 'Private Endpoint 승인 가이드'],
    ['process.aws.auto.5', 'DB Credential 등록 페이지 가이드'],
  ];

  it.each(REF_BARS)('%s draws 「%s」 as a 참고 가이드 바', (key, label) => {
    // ⛔ Not `<li>${label}</li>`. `guideStyles.refBar` is attached to `<details>` by the
    // renderer; as a bullet the label keeps its words and loses the accent bar the source
    // makes the loudest thing on the card.
    expect(bodyFor(key)).toContain(`<details><summary>${label}</summary></details>`);
  });

  it('gives every 참고 가이드 바 a label and no body', () => {
    // The source's bars have nothing behind them, and an empty accent bar is worse than
    // no bar. `<details>` with anything other than one `<summary>` means someone started
    // writing a panel this renderer will not draw.
    for (const [name, html] of EVERY_BODY) {
      for (const bar of html.match(/<details>.*?<\/details>/g) ?? []) {
        expect(bar, name).toMatch(/^<details><summary>[^<]+<\/summary><\/details>$/);
      }
    }
  });

  /** Every `.extlinks` row — the source appends ↗ to each in CSS. */
  it.each([
    ['process.aws.auto.5', 'DB Type별 user 생성 가이드'],
    ['process.aws.auto.5', 'DB Credential 등록 페이지'],
    ['process.aws.auto.7', 'DB Credential 페이지'],
  ] as [GuideSlotKey, string][])('%s marks 「%s」 as somewhere to go', (key, label) => {
    expect(bodyFor(key)).toContain(`<li><em>${label} ↗</em></li>`);
  });

  /** Every `.tag` / `.path__pill` — the small label above a block of work. */
  it.each([
    ['process.gcp.4', 'Service Side Subnet 생성'],
    ['process.gcp.4', 'Service Side Terraform'],
    ['process.azure.4', 'Private Endpoint 승인'],
    ['process.aws.auto.4', '자동 설치'],
    ['process.aws.manual.4', '수동 설치'],
  ] as [GuideSlotKey, string][])('%s names its block with 「%s」 as a pill', (key, label) => {
    expect(bodyFor(key)).toContain(`<mark>${label}</mark>`);
  });

  /**
   * `.s-title` is the source's own weight on the first line of every numbered step;
   * without it a four-step procedure reads as one undifferentiated run of sentences.
   *
   * Walked over the AST rather than matched with a regex. A pattern like `<li>(?!<strong>)`
   * cannot tell a step apart from the bullets nested inside it — the first version of this
   * test did exactly that and reported a defect that was not there.
   */
  const untitledSteps = (nodes: GuideNode[], inOrderedList = false): number => {
    let count = 0;
    for (const node of nodes) {
      if (node.type === 'text' || node.type === 'br' || node.type === 'img') continue;
      if (node.type === 'li' && inOrderedList) {
        const first = node.children.find((child) => child.type !== 'text' || child.value.trim());
        if (!first || first.type !== 'strong') count += 1;
      }
      count += untitledSteps(node.children, node.type === 'ol');
    }
    return count;
  };

  it.each(GUIDE_NAMES)('%s opens every numbered step with a 600-weight title', (name) => {
    const result = validateGuideHtml(STEP_GUIDE_HTML[name], GUIDE_VALIDATE_OPTIONS);
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(untitledSteps(result.ast)).toBe(0);
  });
});
