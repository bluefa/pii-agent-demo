// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type TargetSource } from '@/lib/types';
import { cardStyles, installStepperStyles, projectHeaderStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';

// The header mounts the road; stub it and surface the props it receives. The road is the
// second half of what the one cue opens, so whether it is on screen at all is a fact
// about the drawer and has to survive the stub.
vi.mock('@/app/components/features/process-status', () => ({
  InstallationProcessProgressBar: ({
    currentStep,
    variant,
  }: {
    currentStep: unknown;
    variant?: string;
  }) => (
    <div
      data-testid="process-progress-bar"
      data-step={String(currentStep)}
      data-variant={String(variant)}
    />
  ),
}));

// The real tag fetches on mount; only the scope it was handed is under test here.
vi.mock('@/app/target-sources/[targetSourceId]/_components/common/TcHeaderTag', () => ({
  TcHeaderTag: ({ scope }: { scope: string }) => (
    <span data-testid="tc-header-tag" data-scope={scope} />
  ),
}));

import { ProjectPageMeta } from '@/app/target-sources/[targetSourceId]/_components/common/ProjectPageMeta';
import type { ProjectIdentity } from '@/app/target-sources/[targetSourceId]/_components/common/project-identity';

const projectFixture: TargetSource = {
  isTerraformExecutionGranted: false,
  id: 'proj-1',
  targetSourceId: 1008,
  projectCode: 'AWS-001',
  serviceCode: 'SERVICE-A',
  serviceName: 'Service A',
  processStatus: ProcessStatus.INSTALLATION_COMPLETE,
  createdAt: '2026-01-20T09:00:00Z',
  updatedAt: '2026-01-25T14:00:00Z',
  name: 'Big Data Platform',
  description: 'desc',
  isRejected: false,
  cloudProvider: 'AWS',
};

const SCAN_ARN = 'arn:aws:iam::482915736204:role/BDCPIIInfraScanRole';

/** The four facts the AWS grid states — the shape `AwsProjectPage` builds. */
const awsIdentity: ProjectIdentity = {
  cloudProvider: 'AWS',
  identifiers: [
    { label: '계정', value: '482915736204', mono: true },
    {
      label: '스캔 역할',
      value: SCAN_ARN,
      display: 'BDCPIIInfraScanRole',
      mono: true,
      emptyText: '미등록',
    },
    {
      label: '테라폼 역할',
      value: null,
      emptyText: '역할 불필요',
      emptyHint: '수동 설치는 설치 스크립트를 직접 실행해요.',
    },
  ],
  installMode: 'auto',
};

/** Azure's two UUIDs are the widest values this grid ever holds. */
const azureIdentity: ProjectIdentity = {
  cloudProvider: 'Azure',
  identifiers: [
    { label: 'Subscription ID', value: '12345678-abcd-ef01-2345-6789abcdef01', mono: true },
    { label: 'Tenant ID', value: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', mono: true },
  ],
  installMode: 'auto',
};

const idcIdentity: ProjectIdentity = {
  cloudProvider: 'IDC',
  identifiers: [],
};

/**
 * The header's ONE cue (오너 2026-08-28). Exact name, not `/상세 정보/`: the mode chip
 * carries a 「자동 설치 설명」 tip button, and a loose match would pick up both.
 */
const cue = () => screen.getByRole('button', { name: '상세 정보' });

/**
 * The drawer is closed at every step but the first, so assertions about its body open it.
 * `aria-controls` is an ID list — the body, then the verdict slot up on the head row.
 */
const metaBlock = () => {
  const [bodyId] = (cue().getAttribute('aria-controls') ?? '').split(' ');
  const body = document.getElementById(bodyId);
  if (!body) throw new Error('meta block is closed');
  return within(body);
};

const renderOpen = (props: Parameters<typeof ProjectPageMeta>[0]) => {
  const result = render(<ProjectPageMeta {...props} />);
  if (cue().getAttribute('aria-expanded') === 'false') fireEvent.click(cue());
  return result;
};

/**
 * The facts sit in a NAMED region instead of a card. Querying it by that accessible name
 * is the point: the card had no name, so this helper used to reach for
 * `[class*="bg-white"]` — precisely the coupling between "is a group" and "has a fill"
 * that the plane was removed to break.
 */
const scopeBlock = () => screen.getByRole('region', { name: '설치 대상' });

/**
 * Colour helpers. ⛔ Never spell a hex out in this file: a value copied here is free to
 * drift away from the token it names, and the token is the thing under test. Every colour
 * claim below is a RELATION between two tokens.
 */
const COLOUR = '(#[0-9A-Fa-f]{3,8}|var\\([^)]*\\))';
// Rest state only. A token that declares a hover ink carries two `text-[…]` runs, and a
// pair measured on the wrong one reports a colour the reader never sees at rest.
const REST = '(?<!hover:)(?<!focus-visible:)(?<!group-hover:)';
// ⛔ Colour-shaped only. `text-[…]` is also how this repo spells a font SIZE, so a
// permissive `[^\]]+` reads `text-[14px]` off `factNone` and compares a size to a tint.
const inkOf = (cls: string) => cls.match(new RegExp(`${REST}text-\\[${COLOUR}\\]`))?.[1];
const fillOf = (cls: string) => cls.match(new RegExp(`${REST}bg-\\[${COLOUR}\\]`))?.[1];
const hoverInkOf = (cls: string) => cls.match(new RegExp(`hover:text-\\[${COLOUR}\\]`))?.[1];

/**
 * What `opsStyles.pathLinkId` actually paints — the ops path's identifier segment, and
 * the value the service-side path code is supposed to share. The ops console names it
 * through a CSS variable, so this resolves the variable in `globals.css` exactly as
 * `design-guard.test.ts` does.
 */
const opsPathIdInk = (): string => {
  const root = path.resolve(__dirname, '../../../../..');
  const opsSrc = readFileSync(
    path.join(
      root,
      'app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles.ts',
    ),
    'utf8',
  );
  const token = opsSrc.match(/pathLinkId:\s*\n?\s*'([^']+)'/)?.[1];
  if (!token) throw new Error('opsStyles.pathLinkId not found');
  const value = inkOf(token);
  if (!value) throw new Error(`opsStyles.pathLinkId declares no ink: ${token}`);
  const name = value.match(/^var\((--[\w-]+)\)$/)?.[1];
  if (!name) return value;
  const css = readFileSync(path.join(root, 'app/globals.css'), 'utf8');
  const resolved = css.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim();
  if (!resolved) throw new Error(`${name} is not declared in globals.css`);
  return resolved;
};

/** The position plate, matched by exact token equality rather than by structure. */
const stepTag = () =>
  [...scopeBlock().querySelectorAll('span')].find(
    (s) => s.className === installStepperStyles.stepTag,
  );
const stepText = () => stepTag()?.textContent?.replace(/\s+/g, ' ').trim();

describe('ProjectPageMeta — one block, one cue, no rules', () => {
  it('draws no rule anywhere in the header (오너 2026-08-28)', () => {
    // The header had two horizontal hairlines and one vertical divider on a wash it
    // paints nothing on, and the horizontal one measured 1.16:1 against the lavender
    // canvas — too faint to group anything. Grouping is the 16px name and the 22px gap now.
    // Asserted on the tokens as well as the DOM: a `border-b` re-added to `blockHead`
    // would be the exact revert, and only the token pin names it.
    const { container } = render(
      <ProjectPageMeta
        project={projectFixture}
        identity={{ ...awsIdentity, installMode: 'manual' }}
      />,
    );
    expect(projectHeaderStyles.blockHead).not.toContain('border');
    expect(projectHeaderStyles.factGrid).toContain('pt-[22px]');
    // A rule is a single EDGE — `border-b`, `border-t` — or a 1px bar standing on its own
    // (`divider` was `w-px … bg-…`). A box's full outline is not one: 수동 설치 keeps its
    // amber chip stroke, which is the chip saying it is a chip, and this fixture renders
    // that mode so the distinction is exercised rather than assumed.
    for (const el of container.querySelectorAll('*')) {
      const cls = String(el.className);
      expect(cls).not.toMatch(/(?:^|\s)border-[btlrxy](?:$|\s|-)/);
      expect(cls).not.toMatch(/(?:^|\s)w-px(?:$|\s)/);
      expect(cls).not.toMatch(/(?:^|\s)h-px(?:$|\s)/);
    }
  });

  it('offers exactly one disclosure, and it is 「상세 정보」', () => {
    // 「설명」 was right when the fold held one paragraph; the fold now holds the
    // description AND the road, so a cue naming only the paragraph understates its body.
    // ⛔ Two cues 32px apart is the state this replaced.
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    expect(screen.queryByRole('button', { name: /전체 단계/ })).toBeNull();
    expect(screen.queryByRole('button', { name: '설명' })).toBeNull();
    expect(cue().textContent).toBe('상세 정보');
  });

  it('keeps the cue out of blue — it opens reference, not work (오너 2026-08-28)', () => {
    // ⛔ Blue in this palette also reads as 「you must look at this」, and what this cue
    // opens is read-once reference. It joins the chrome family instead: the same ink the
    // path and the block name wear. Not a legibility trade — on the header's ground the
    // new ink is slightly STRONGER than the blue it replaced (6.50:1 vs 6.15:1); the
    // measurement itself lives in `design-guard.test.ts`, which pairs this token's rest
    // ink against the canvas.
    expect(inkOf(projectHeaderStyles.metaCue)).toBe(inkOf(projectHeaderStyles.blockLabel));
    expect(inkOf(projectHeaderStyles.metaCue)).toBe(inkOf(projectHeaderStyles.crumb));
    // ⛔ And it is not the position plate's blue, which is the one thing on this row the
    // eye IS meant to land on.
    expect(inkOf(projectHeaderStyles.metaCue)).not.toBe(inkOf(installStepperStyles.stepTag));
    expect(fillOf(projectHeaderStyles.metaCue)).toBeUndefined();
  });

  it('declares pressability by hover and the chevron, not by hue', () => {
    // The grammar `opsStyles.pathLink` already uses one screen over: 「누를 수 있다는
    // 것은 hover 가 말한다」. Hover darkens to the value ink and underlines, and keyboard
    // focus gets the same treatment — a reader who never touches a pointer must not be
    // the one reader with no affordance.
    expect(hoverInkOf(projectHeaderStyles.metaCue)).toBe(
      inkOf(projectHeaderStyles.summaryValue),
    );
    expect(projectHeaderStyles.metaCue).toContain('hover:underline');
    expect(projectHeaderStyles.metaCue).toContain('focus-visible:underline');
    // The focus ring stays as it was: a focus indicator appears only for the reader who
    // asked for it, so it is not attention-seeking colour.
    expect(projectHeaderStyles.metaCue).toContain('focus-visible:ring-2');
    // The chevron takes the cue's own ink, so it darkens with it and needs no pair.
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    expect(cue().querySelector('svg')?.getAttribute('class')).toBe(
      projectHeaderStyles.metaToggleIcon,
    );
    expect(projectHeaderStyles.metaToggleIcon).not.toMatch(/text-\[/);
  });

  it('is no longer gated — the road is always behind it', () => {
    // The old `hasFold` check dropped the cue when the description was empty. The road
    // always exists, so that gate can only ever be true now, and a header whose cue came
    // and went with a text field was the thing it protected against.
    render(
      <ProjectPageMeta project={{ ...projectFixture, description: '  ' }} identity={awsIdentity} />,
    );
    expect(cue()).toBeTruthy();
    fireEvent.click(cue());
    expect(screen.getByTestId('process-progress-bar')).toBeTruthy();
  });

  it('dissolves the 설치 진행 block — one named region is left', () => {
    // The block spent a name, a hairline and ~70px stating one tag. The tag moved onto
    // this block's head row; the road moved behind this block's cue.
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    expect(screen.queryByText('설치 진행')).toBeNull();
    expect(screen.getAllByRole('region')).toHaveLength(1);
  });

  it('opens and closes on the cue, reporting state to assistive tech', () => {
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    expect(cue().getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(cue());
    expect(cue().getAttribute('aria-expanded')).toBe('true');
    // aria-controls has to name a box that exists, or the association is a lie.
    const [bodyId] = (cue().getAttribute('aria-controls') ?? '').split(' ');
    const body = document.getElementById(bodyId);
    expect(body).toBeTruthy();
    // Head and body are one object: the body opens inside the named block, not after it.
    expect(scopeBlock().contains(body as Node)).toBe(true);
    expect(screen.getByText('desc')).toBeTruthy();

    fireEvent.click(cue());
    expect(cue().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('desc')).toBeNull();
  });
});

/**
 * Which state the reader arrives in. Step 1 is the first-time reader's state — they have
 * not seen the road and have not been told what the target is — and every later step is
 * one they have already walked through.
 */
describe('ProjectPageMeta — the drawer’s default state', () => {
  it('opens by itself at 연동 대상 DB 선택, and only there', () => {
    render(
      <ProjectPageMeta
        project={{ ...projectFixture, processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION }}
        identity={awsIdentity}
      />,
    );
    expect(cue().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('desc')).toBeTruthy();
    expect(screen.getByTestId('process-progress-bar')).toBeTruthy();
  });

  it.each([
    ['WAITING_APPROVAL', ProcessStatus.WAITING_APPROVAL],
    ['APPLYING_APPROVED', ProcessStatus.APPLYING_APPROVED],
    ['INSTALLING', ProcessStatus.INSTALLING],
    ['WAITING_CONNECTION_TEST', ProcessStatus.WAITING_CONNECTION_TEST],
    ['CONNECTION_VERIFIED', ProcessStatus.CONNECTION_VERIFIED],
    ['INSTALLATION_COMPLETE', ProcessStatus.INSTALLATION_COMPLETE],
  ])('stays shut at %s — the reader has walked past it', (_name, status) => {
    render(
      <ProjectPageMeta project={{ ...projectFixture, processStatus: status }} identity={awsIdentity} />,
    );
    expect(cue().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('process-progress-bar')).toBeNull();
  });

  it('is a first render, not a memory — closing it at step 1 sticks for that visit', () => {
    // ⛔ Deliberately unpersisted: no cookie, no localStorage. Re-opening the page at
    // step 1 re-opens the drawer, and that is accepted — the alternative makes the
    // header's shape depend on history the reader cannot see.
    render(
      <ProjectPageMeta
        project={{ ...projectFixture, processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION }}
        identity={awsIdentity}
      />,
    );
    fireEvent.click(cue());
    expect(cue().getAttribute('aria-expanded')).toBe('false');
  });
});

describe('ProjectPageMeta — path heading', () => {
  it('states the job at the weight of a location, in three segments', () => {
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    const heading = screen.getByRole('heading', { level: 1 });
    // The path closes on the service code (오너 5차 지시): #1008 is a database key, and
    // it was holding the most emphatic slot on the line. ⛔ No `Target Source #id`
    // segment, and no painted kind tags in front of the two service segments.
    expect(heading.textContent).toBe('PII Agent 설치/Service A/SERVICE-A');
    expect(heading.textContent).not.toContain('1008');
    expect(heading.textContent).not.toContain('서비스 코드');
  });

  it('navigates — the root to the service list, the name to that service', () => {
    // 오너 2026-08-29, reversing 「nothing here links」. The service segment had to take
    // the reader to their own service. Both destinations already existed; ⛔ neither is
    // spelled out here — the hrefs are read off `passRoutes`, so a route that moves moves
    // this assertion with it instead of leaving a green test pointing nowhere.
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    const crumb = within(screen.getByRole('heading', { level: 1 }));
    expect(crumb.getByRole('link', { name: 'PII Agent 설치' }).getAttribute('href')).toBe(
      passRoutes.services,
    );
    expect(crumb.getByRole('link', { name: 'Service A' }).getAttribute('href')).toBe(
      passRoutes.service(projectFixture.serviceCode),
    );
  });

  it('percent-encodes the service code into the deep link', () => {
    // `/services` is URL-driven, so the code lands in a query string. A code with a
    // reserved character would otherwise end the query early and select nothing.
    render(
      <ProjectPageMeta
        project={{ ...projectFixture, serviceCode: 'a b&c' }}
        identity={awsIdentity}
      />,
    );
    const href = screen.getByRole('link', { name: 'Service A' }).getAttribute('href');
    expect(href).toBe(passRoutes.service('a b&c'));
    expect(href).toContain('a%20b%26c');
  });

  it('leaves the code segment unlinked and marks it as where you are', () => {
    // ⛔ Two adjacent links to one destination is one link too many — the segment before
    // it already goes to this service. That is the exact flaw the ops path removed on
    // 2026-08-26, and `aria-current` is what actually answers 「where am I」.
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(within(heading).getAllByRole('link')).toHaveLength(2);
    const code = within(heading).getByText('SERVICE-A');
    expect(code.tagName).toBe('SPAN');
    expect(code.closest('a')).toBeNull();
    expect(code.getAttribute('aria-current')).toBe('page');
  });

  it('takes the landmark that comes with the links', () => {
    // ⛔ Links without a landmark is the accessibility gap this screen's ops sibling
    // still has; a heading shaped like a path needed none, a breadcrumb does. The `<h1>`
    // survives inside it — the page has exactly one, and it is this line.
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    const nav = screen.getByRole('navigation', { name: '경로' });
    expect(nav.contains(screen.getByRole('heading', { level: 1 }))).toBe(true);
    // `min-w-0` or the 280px clamp on the name stops truncating — the nav is the flex
    // child now, and a flex item refuses to shrink below its content without it.
    expect(nav.className).toContain('min-w-0');
  });

  it('keeps the links out of blue — hue in this header claims no attention', () => {
    // ⛔ Same call as the cue (오너 2026-08-29), same reason. Each segment keeps the ink
    // it already had; `crumbLink` adds only what happens when the reader reaches for it,
    // and it darkens to the ink the cue darkens to, so the header has ONE "you are
    // touching this" tone rather than two.
    expect(inkOf(projectHeaderStyles.crumbLink)).toBeUndefined();
    expect(hoverInkOf(projectHeaderStyles.crumbLink)).toBe(
      hoverInkOf(projectHeaderStyles.metaCue),
    );
    expect(projectHeaderStyles.crumbLink).toContain('hover:underline');
    // Keyboard reaches it too — hue is gone, so a pointer-only affordance would leave a
    // keyboard reader with nothing at all.
    expect(projectHeaderStyles.crumbLink).toContain('focus-visible:underline');
    // ⛔ No hand-drawn ring: `globals.css` paints `*:focus-visible` outside the cascade
    // layer, so a Tailwind ring is drawn ALONGSIDE the global outline, not instead of it.
    expect(projectHeaderStyles.crumbLink).not.toContain('ring');
    expect(projectHeaderStyles.crumbLink).not.toContain('outline-none');

    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    for (const name of ['PII Agent 설치', 'Service A']) {
      expect(screen.getByRole('link', { name }).className).toContain(
        projectHeaderStyles.crumbLink,
      );
    }
  });

  it('makes the service code the identifier segment — mono, one rung darker', () => {
    // 오너 2026-08-28. `/ SERVICE-A` in the same grey as the words beside it identified
    // nothing; the earlier fix was a painted 「서비스 코드」 tag, which cost the header two
    // more fills. Mono says "identifier" without a plane, and it is the exact value the
    // ops path gives the same segment (`opsStyles.pathLinkId`).
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    const code = within(screen.getByRole('heading', { level: 1 })).getByText('SERVICE-A');
    expect(code.className).toBe(projectHeaderStyles.crumbCode);
    expect(projectHeaderStyles.crumbCode).toContain('font-mono');
    expect(projectHeaderStyles.crumbCode).toContain('font-medium');
    // The ink is read off the ops token and resolved through the console's own variable,
    // never hand-copied: a value spelled out here would keep this green after either side
    // moved, and the CLAIM is that the two screens give the same segment the same tint.
    expect(inkOf(projectHeaderStyles.crumbCode)).toBe(opsPathIdInk());
    // ⛔ No fill and no stroke — that is the whole difference from the tag it replaced.
    expect(projectHeaderStyles.crumbCode).not.toMatch(/bg-\[|border/);
  });

  it('sets the block name one rung above the path root (오너 2026-08-28)', () => {
    // 「설치 대상」 is now the ONLY name in this header apart from the path's root, and the
    // root reads at 14. A name sharing its size with the line above it introduces nothing.
    // 16 is the rung `opsStyles.fmLabel` took after the same instruction.
    expect(projectHeaderStyles.blockLabel).toContain('text-[16px]');
    expect(projectHeaderStyles.crumbRoot).toContain('text-[14px]');
    expect(projectHeaderStyles.crumb).toContain('text-[12px]');
  });

  it('keeps the path outside the 설치 대상 block — it is page chrome', () => {
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    expect(scopeBlock().contains(screen.getByRole('heading', { level: 1 }))).toBe(false);
  });

  it('gives the scope block the accessible name the card never had', () => {
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    const block = scopeBlock();
    expect(block.tagName).toBe('SECTION');
    expect(within(block).getByText('설치 대상').id).toBe(block.getAttribute('aria-labelledby'));
  });

  /**
   * `inner` is the body gutter plus the step card's own keyline, and nothing computes
   * that sum — so the two halves can drift apart in silence. Change the layouts' `px-5`
   * alone and the header's type slides off the cards' type with every test still green,
   * which is exactly the wobble 오너 10차 지시 was about (11px, then).
   *
   * A source-string pin, not a measurement: jsdom computes no geometry. It fires when any
   * of the three values is EDITED and equally when one is merely moved into a token —
   * that false positive is the price. Re-derive the sum and update the test.
   */
  it('keeps the header keyline equal to the body gutter plus the card inset', () => {
    const GUTTER = 20; // the layouts' px-5, 오너 13차 지시
    expect(cardStyles.header).toContain('px-[28px]');
    expect(projectHeaderStyles.inner).toContain(`px-[${GUTTER + 28}px]`);

    const root = path.resolve(__dirname, '../../../../..');
    for (const layout of [
      'app/target-sources/[targetSourceId]/_components/layout/CloudTargetSourceLayout.tsx',
      'app/target-sources/[targetSourceId]/_components/idc/IdcTargetSourceLayout.tsx',
    ]) {
      const src = readFileSync(path.join(root, layout), 'utf8');
      expect(src, `${layout}: its gutter is the other half of inner`).toContain(
        `px-${GUTTER / 4} pt-8 pb-20`,
      );
    }
  });

  it('gives the header a floor that does not depend on the drawer', () => {
    // The 18px used to come from the 설치 진행 block, which was always rendered. The road
    // lives behind the drawer now, so without a floor on `inner` the gap under the header
    // changed depending on whether the reader had opened it.
    expect(projectHeaderStyles.inner).toContain('pb-[18px]');
  });

  it('clamps the service name — no contract maximum backs it', () => {
    // swagger `service_name` declares no maxLength, so the only guarantee this line can
    // make about width is the one it enforces itself.
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    const name = within(screen.getByRole('heading', { level: 1 })).getByText('Service A');
    expect(name.className).toContain('truncate');
    expect(name.className).toContain('max-w-[280px]');
    expect(name.getAttribute('title')).toBe('Service A');
  });

  it('renders the page action', () => {
    render(
      <ProjectPageMeta
        project={projectFixture}
        identity={awsIdentity}
        action={<button type="button">인프라 삭제</button>}
      />,
    );
    expect(screen.getByRole('button', { name: '인프라 삭제' })).toBeTruthy();
  });
});

describe('ProjectPageMeta — the fact grid', () => {
  it('states each fact in its own cell, label above value', () => {
    // 오너 2026-08-28. The row this replaces put the provider on the left as a subject
    // and stacked `label · value` pairs to its right behind a divider: it could only ever
    // say what ONE provider owned before it ran out of width, and AWS owns four facts.
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    const card = within(scopeBlock());
    const grid = card.getByText('계정').parentElement?.parentElement as HTMLElement;
    expect(grid.className).toBe(projectHeaderStyles.factGrid);
    for (const label of ['계정', '스캔 역할', '테라폼 역할', '설치 모드']) {
      expect(card.getByText(label).parentElement?.className).toBe(projectHeaderStyles.factCell);
      expect(card.getByText(label).parentElement?.parentElement).toBe(grid);
    }
    // The label sits ABOVE its value, so it is the cell's first child, not its sibling.
    expect(card.getByText('계정').previousElementSibling).toBeNull();
  });

  it('lets the column count follow the width — a fixed four squeezes a cell to 94px', () => {
    // ⛔ Do not copy `opsStyles.fmGrid`'s `repeat(4,minmax(0,240px))`. The ops masthead
    // has the whole window; this header stands in a column with a guide rail beside it,
    // and at that width the fourth fixed track ellipses a role name that fits everywhere
    // else. `auto-fit` wraps to a second row instead of shrinking a cell below its
    // content.
    expect(projectHeaderStyles.factGrid).toContain('repeat(auto-fit,minmax(200px,240px))');
    expect(projectHeaderStyles.factGrid).not.toContain('repeat(4,');
  });

  it('gives the CSP no cell — the brand mark on the head row is its statement', () => {
    // 오너 8차 지시: the logo already is the name. It moved up beside 설치 대상 and it is
    // not a fact in the grid.
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    const card = within(scopeBlock());
    expect(card.queryByText('Cloud Provider')).toBeNull();
    expect(card.queryByText('CSP')).toBeNull();
    // Hidden, not dropped: a logo announces nothing, so removing 「AWS Cloud」 from the
    // screen must not remove it from the accessible name too.
    expect(card.getByText('AWS Cloud').className).toBe('sr-only');
    expect(card.getByText('AWS Cloud').parentElement?.className).toBe(
      projectHeaderStyles.blockName,
    );
  });

  // The other half of the same rule. A server rack and an upload arrow are ours, not a
  // vendor's, and name nothing on their own; hiding these two would delete the provider
  // from the header rather than de-duplicate it.
  it.each([
    ['IDC', { cloudProvider: 'IDC' as const }, 'IDC'],
    ['SDU', { isSduType: true }, 'SDU'],
  ])('still prints the %s name in ink — its glyph is a generic outline', (_, patch, name) => {
    render(<ProjectPageMeta project={{ ...projectFixture, ...patch }} identity={idcIdentity} />);
    expect(within(scopeBlock()).getByText(name).className).not.toContain('sr-only');
  });

  it('prints the short form and copies the whole one', () => {
    // The role name is what the cell is for; the ARN is what a reader takes to the AWS
    // console. Both are on screen — one in ink, one in the title and the clipboard — so
    // the short slot costs no evidence.
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    const card = within(scopeBlock());
    const value = card.getByText('BDCPIIInfraScanRole');
    expect(card.queryByText(SCAN_ARN)).toBeNull();
    expect(value.parentElement?.getAttribute('title')).toBe(SCAN_ARN);
    expect(card.getByRole('button', { name: '스캔 역할 복사' })).toBeTruthy();
  });

  it('says what is absent instead of dropping the cell', () => {
    // ⛔ A cell that disappears makes "there is none" and "not read yet" look the same.
    // The text is a statement, not a dash (결정 #49), and it carries its own reason.
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    const empty = within(scopeBlock()).getByText('역할 불필요');
    expect(empty.className).toBe(projectHeaderStyles.factNone);
    expect(empty.getAttribute('title')).toBe('수동 설치는 설치 스크립트를 직접 실행해요.');
    // Not a value: it is 14px like one, but in `kvLabel`'s ink, never the near-black the
    // real values wear. Both ends read off the tokens — the relation IS the assertion.
    expect(inkOf(projectHeaderStyles.factNone)).toBe(inkOf(projectHeaderStyles.kvLabel));
    expect(inkOf(projectHeaderStyles.factNone)).not.toBe(inkOf(projectHeaderStyles.summaryValue));
  });

  it('drops a cell with neither a value nor something to say (결정 #49)', () => {
    render(
      <ProjectPageMeta
        project={projectFixture}
        identity={{
          cloudProvider: 'AWS',
          identifiers: [{ label: '계정', value: null, mono: true }],
        }}
      />,
    );
    expect(screen.queryByText('계정')).toBeNull();
    expect(screen.queryByText('-')).toBeNull();
  });

  it('lets the value shrink and nothing else — the grid must not overflow', () => {
    render(<ProjectPageMeta project={projectFixture} identity={azureIdentity} />);
    const subscription = '12345678-abcd-ef01-2345-6789abcdef01';
    const value = within(scopeBlock()).getByText(subscription);
    expect(value.className).toContain('min-w-0');
    expect(value.className).toContain('truncate');
    // `flex-none` on the wrapper would pin flex-shrink to 0 and this truncation would
    // never fire — the row overflowed instead. Keep it off. The cell needs `min-w-0` for
    // the same reason: a grid track's default `min-width:auto` refuses to go below its
    // content.
    expect(value.parentElement?.className).not.toContain('flex-none');
    expect(projectHeaderStyles.factCell).toContain('min-w-0');
    expect(value.parentElement?.getAttribute('title')).toBe(subscription);
  });

  it('keeps 설치 모드 on the face — it decides whether there is work to do', () => {
    // 오너 7차 지시: 자동/수동 is not reference material, so it does not go behind the
    // cue. Last cell of the grid, in the same track rule as the identifiers.
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    const card = within(scopeBlock());
    expect(card.getByText('설치 모드')).toBeTruthy();
    expect(card.getByText('자동 설치')).toBeTruthy();
    // 오너 17차 지시 replaced the four-word gloss with a press-to-open tip inside the
    // chip. Closed at rest, so the meaning is a press away and not on the row.
    expect(card.queryByText(/Terraform 권한 위임/)).toBeNull();
    expect(card.getByRole('button', { name: '자동 설치 설명' })).toBeTruthy();
  });

  it('hides the 설치 모드 cell when the identity carries none', () => {
    render(
      <ProjectPageMeta
        project={projectFixture}
        identity={{ ...awsIdentity, installMode: undefined }}
      />,
    );
    expect(screen.queryByText('설치 모드')).toBeNull();
  });

  it('is read-only — the service owner may copy these values and nothing else', () => {
    // ⛔ On the ops screen these same values are buttons that open an edit modal. Here
    // they are plain text plus copy: no blue, no underline, no CTA.
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    const grid = within(scopeBlock()).getByText('계정').parentElement
      ?.parentElement as HTMLElement;
    const names = [...grid.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['계정 복사', '스캔 역할 복사', '자동 설치 설명']);
    for (const el of grid.querySelectorAll('*')) {
      expect(String(el.className)).not.toContain('underline');
    }
  });

  it('explains either mode from a press inside its own chip (오너 17차 지시)', () => {
    render(
      <ProjectPageMeta
        project={projectFixture}
        identity={{ ...awsIdentity, installMode: 'manual' }}
      />,
    );
    expect(screen.getByText('수동 설치')).toBeTruthy();
    expect(screen.queryByText(/설치 스크립트 직접 실행/)).toBeNull();

    const tip = screen.getByRole('button', { name: '수동 설치 설명' });
    fireEvent.click(tip);
    expect(screen.getByText(/설치 스크립트를 받아 직접 실행해야 해요/)).toBeTruthy();
    // Press again and it closes — a hover tip has no way back once it is pinned open.
    fireEvent.click(tip);
    expect(screen.queryByText(/설치 스크립트를 받아 직접 실행해야 해요/)).toBeNull();
  });

  it('opens the same tip on hover, and the press only pins it (오너 18차 지시)', () => {
    render(
      <ProjectPageMeta
        project={projectFixture}
        identity={{ ...awsIdentity, installMode: 'manual' }}
      />,
    );
    // The wrapper carries the pointer handlers; the button is what the reader aims at.
    const wrapper = screen.getByRole('button', { name: '수동 설치 설명' }).parentElement!;

    fireEvent.mouseEnter(wrapper);
    expect(screen.getByText(/설치 스크립트를 받아 직접 실행해야 해요/)).toBeTruthy();
    // Unpinned, so leaving closes it — hover costs the reader nothing to dismiss.
    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByText(/설치 스크립트를 받아 직접 실행해야 해요/)).toBeNull();

    // Hover then press: the pin has to survive the pointer leaving the 14px target,
    // which is the whole reason the press exists alongside hover.
    fireEvent.mouseEnter(wrapper);
    fireEvent.click(wrapper);
    fireEvent.mouseLeave(wrapper);
    expect(screen.getByText(/설치 스크립트를 받아 직접 실행해야 해요/)).toBeTruthy();
  });

  it('says only what the mode costs at the install step (오너 18차 지시)', () => {
    // The first half restated the chip's own name (「Agent 를 직접 설치하고 구성해요」).
    // What the reader cannot see from the chip is what it means for THEM at step 4.
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    fireEvent.click(screen.getByRole('button', { name: '자동 설치 설명' }));
    expect(
      screen.getByText('설치 단계에서 BDC 측에 Terraform 수행 권한을 위임해요.'),
    ).toBeTruthy();
    expect(screen.queryByText(/Agent 를 설치하고 구성해요/)).toBeNull();
  });

  it('IDC carries its 사내망 gloss on the head row and lists no fact at all', () => {
    render(<ProjectPageMeta project={{ ...projectFixture, cloudProvider: 'IDC' }} identity={idcIdentity} />);
    const card = within(scopeBlock());
    expect(card.getByText('IDC')).toBeTruthy();
    expect(card.getByText('사내망')).toBeTruthy();
    // No account, so no cells at all — an empty slot is the truthful rendering, not a dash.
    expect(screen.queryByText('-')).toBeNull();
  });
});

describe('ProjectPageMeta — what the one cue opens', () => {
  it('puts the description first and the road second (오너 2026-08-28)', () => {
    // What this target IS, before where it is going. ⛔ Not the other way round: the road
    // is the same seven steps on every target, and the description is the only thing in
    // the drawer that is about THIS one.
    renderOpen({ project: projectFixture, identity: awsIdentity });
    const body = metaBlock();
    const description = body.getByText('desc');
    const roadNode = body.getByTestId('process-progress-bar');
    expect(
      description.compareDocumentPosition(roadNode) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('names the description with a field label, not a block title', () => {
    // The label is what the cue's old 「설명」 name became: a `kvLabel`, the same tier the
    // grid's own labels wear, because it names one paragraph. ⛔ No other group titles
    // inside the drawer — the road and the description are not two named blocks again.
    renderOpen({ project: projectFixture, identity: awsIdentity });
    const label = metaBlock().getByText('계정 설명');
    expect(label.className).toBe(projectHeaderStyles.kvLabel);
    expect(metaBlock().queryByText('설치 진행')).toBeNull();
  });

  it.each([
    ['AWS', { cloudProvider: 'AWS' as const }, awsIdentity, '계정 설명'],
    ['Azure', { cloudProvider: 'Azure' as const }, azureIdentity, '계정 설명'],
    ['GCP', { cloudProvider: 'GCP' as const }, { ...awsIdentity, cloudProvider: 'GCP' as const }, '프로젝트 설명'],
    ['IDC', { cloudProvider: 'IDC' as const }, idcIdentity, '대상 설명'],
    ['SDU', { isSduType: true }, awsIdentity, '대상 설명'],
  ])('labels the description per provider — %s says 「%s」', (_name, patch, identity, label) => {
    // The component is shared, and the thing being described changes with the provider:
    // a CSP account, a GCP project, or the target itself where there is no cloud account.
    renderOpen({ project: { ...projectFixture, ...patch }, identity });
    expect(metaBlock().getByText(label)).toBeTruthy();
  });

  it('skips the description block when there is none, and still shows the road', () => {
    renderOpen({
      project: { ...projectFixture, description: '  ' },
      identity: awsIdentity,
    });
    expect(metaBlock().queryByText('계정 설명')).toBeNull();
    expect(metaBlock().getByTestId('process-progress-bar')).toBeTruthy();
  });

  it('prints the description whole — the reader pressed for it', () => {
    // ⛔ No `line-clamp`. It was right while the description sat behind a cue promising
    // 「설명」 among other things; it is the drawer's first and only labelled content now.
    expect(projectHeaderStyles.descText).not.toContain('line-clamp');
    expect(projectHeaderStyles.descText).toContain('max-w-[82ch]');
  });

  it('leaves the drawer only what a line cannot say (오너 6·7차 지시)', () => {
    renderOpen({ project: projectFixture, identity: awsIdentity });
    const body = metaBlock();
    // Every cloud fact is stated once, in the grid. The group that used to repeat them
    // 60px lower under its own eyebrow is gone.
    expect(body.queryByText('클라우드 정보')).toBeNull();
    expect(body.queryByText('AWS Cloud')).toBeNull();
    expect(body.queryByText('482915736204')).toBeNull();
    expect(body.queryByText('계정')).toBeNull();
    expect(body.queryByText('설치 모드')).toBeNull();
  });

  it('mounts the road with the project processStatus', () => {
    renderOpen({ project: projectFixture, identity: awsIdentity });
    const bar = screen.getByTestId('process-progress-bar');
    expect(bar.getAttribute('data-step')).toBe(String(projectFixture.processStatus));
    expect(bar.getAttribute('data-variant')).toBe('undefined');
  });
});

describe('ProjectPageMeta — the position tag on the head row', () => {
  it('rides the block head, after the block name (오너 2026-08-28)', () => {
    // The slot `OpsHeader` gives `StepPill` on the same target: 몇 단계인지 is the state of
    // the thing this block names, not a block of its own.
    render(
      <ProjectPageMeta
        project={{ ...projectFixture, processStatus: ProcessStatus.INSTALLING }}
        identity={awsIdentity}
      />,
    );
    expect(stepText()).toBe('7단계 중 4단계');
    expect(stepTag()?.parentElement?.className).toBe(projectHeaderStyles.blockName);
    expect(within(scopeBlock()).getByText('설치 대상').parentElement).toBe(
      stepTag()?.parentElement,
    );
  });

  it.each([
    [ProcessStatus.WAITING_TARGET_CONFIRMATION, '1단계', '연동 대상 DB 선택'],
    [ProcessStatus.INSTALLING, '4단계', 'Agent 설치'],
    [ProcessStatus.WAITING_CONNECTION_TEST, '5단계', '연결 테스트'],
  ])('counts %s as %s and does NOT name it %s', (status, position, label) => {
    render(<ProjectPageMeta project={{ ...projectFixture, processStatus: status }} identity={awsIdentity} />);
    // 「N단계 중 」 — the space is real text (`{' '}`).
    expect(stepText()).toContain(`중 ${position}`);
    // ⛔ The plate answers 「어디」 and stops. The name belongs to the card head below,
    // which prints it at 20px beside its own tag; carrying it here too put one string on
    // the screen three times over — and the three did not agree.
    expect(stepText()).not.toContain(label);
    expect(stepText()).not.toContain('·');
  });

  it('drops the position once there is none left to report (오너 18차 지시)', () => {
    // 「7단계 중 7단계 완료」 stated completion three ways. The total survives because it is
    // what got completed; the position does not.
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    expect(stepText()).toBe('7단계 모두 완료');
    expect([...scopeBlock().querySelectorAll('b')].map((c) => c.textContent)).toEqual(['7']);
  });

  it('puts both digits on the one plate, in the plate’s own ink (오너 16차 지시)', () => {
    render(
      <ProjectPageMeta
        project={{ ...projectFixture, processStatus: ProcessStatus.INSTALLING }}
        identity={awsIdentity}
      />,
    );
    const counts = [...scopeBlock().querySelectorAll('b')];
    expect(counts.map((c) => c.textContent)).toEqual(['7', '4']);
    expect(counts.every((c) => c.className === installStepperStyles.tagCount)).toBe(true);
    expect(installStepperStyles.tagCount).toContain('text-[14px]');
    // ⛔ No ink of its own: a near-black digit on this fill would be a second colour
    // inside what is a single statement.
    expect(installStepperStyles.tagCount).not.toMatch(/text-\[#/);
  });

  it('separates the 16px name from the 14px digits by plate, not by size', () => {
    // ⛔ Never give the block name the tag's ink — slate on the wash versus blue on a
    // blue fill is what tells the reader which of the two is the position.
    expect(inkOf(installStepperStyles.stepTag)).not.toBe(inkOf(projectHeaderStyles.blockLabel));
    expect(fillOf(installStepperStyles.stepTag)).toBeTruthy();
    expect(fillOf(projectHeaderStyles.blockLabel)).toBeUndefined();
    // The slate this palette uses for a quiet plate is the 설치 모드 chip's, two rows
    // below on the same header. The step is the thing the eye lands on, so it is not it.
    expect(fillOf(installStepperStyles.stepTag)).not.toBe(
      fillOf(projectHeaderStyles.modeChipAuto),
    );
  });

  it('drops the plate entirely on a status outside the seven', () => {
    // ProcessStatus is exactly these seven, but the value arrives over the wire — an
    // unknown one must not print 「0단계」 or crash on an undefined label.
    render(
      <ProjectPageMeta
        project={{ ...projectFixture, processStatus: 99 as ProcessStatus }}
        identity={awsIdentity}
      />,
    );
    expect(stepText()).toBeUndefined();
    expect(within(scopeBlock()).getByText('설치 대상')).toBeTruthy();
  });
});

/**
 * Two gates on the verdict tag, both unchanged by the 2026-08-28 round.
 *
 * 1. The target has REACHED 연결 테스트 (step 5). Before that the agent is not installed,
 *    so any surviving verdict describes a previous cycle — drawing it tells the user the
 *    connection is fine about a configuration never tested.
 * 2. The drawer is open (오너 14차 지시 후속). The verdict is detail about one step, so it
 *    comes with the press that names the steps.
 *
 * Neither gate may merely hide the tag: `TcHeaderTag` fetches latest_version on mount, so
 * a slot that rendered and hid it would keep the request.
 */
describe('ProjectPageMeta — 연결 테스트 verdict tag', () => {
  const opened = (status: ProcessStatus) => {
    render(<ProjectPageMeta project={{ ...projectFixture, processStatus: status }} identity={awsIdentity} />);
    if (cue().getAttribute('aria-expanded') === 'false') fireEvent.click(cue());
  };

  it.each([
    ['WAITING_TARGET_CONFIRMATION', ProcessStatus.WAITING_TARGET_CONFIRMATION],
    ['WAITING_APPROVAL', ProcessStatus.WAITING_APPROVAL],
    ['APPLYING_APPROVED', ProcessStatus.APPLYING_APPROVED],
    ['INSTALLING', ProcessStatus.INSTALLING],
  ])('renders no tag at %s even with the drawer open (step 5 not reached)', (_name, status) => {
    opened(status);
    expect(screen.queryByTestId('tc-header-tag')).toBeNull();
  });

  it.each([
    ['WAITING_CONNECTION_TEST', ProcessStatus.WAITING_CONNECTION_TEST],
    ['CONNECTION_VERIFIED', ProcessStatus.CONNECTION_VERIFIED],
    ['INSTALLATION_COMPLETE', ProcessStatus.INSTALLATION_COMPLETE],
  ])('renders the tag at %s once the drawer is open', (_name, status) => {
    opened(status);
    expect(screen.getByTestId('tc-header-tag')).toBeTruthy();
  });

  it('folds the verdict away with the drawer (오너 14차 지시 후속)', () => {
    render(
      <ProjectPageMeta
        project={{ ...projectFixture, processStatus: ProcessStatus.WAITING_CONNECTION_TEST }}
        identity={awsIdentity}
      />,
    );
    expect(screen.queryByTestId('tc-header-tag')).toBeNull();
    fireEvent.click(cue());
    expect(screen.getByTestId('tc-header-tag')).toBeTruthy();
    fireEvent.click(cue());
    expect(screen.queryByTestId('tc-header-tag')).toBeNull();
  });

  it('keeps the verdict on the head row, not inside the drawer it opens with', () => {
    // Hanging it on the road is the obvious way to fold it with the road — and it is the
    // way that brings back the absolute-positioning bug the slot token warns about.
    opened(ProcessStatus.WAITING_CONNECTION_TEST);
    const slot = screen.getByTestId('tc-header-tag').parentElement;
    expect(slot?.className).toBe(installStepperStyles.tagSlot);
    expect(slot?.parentElement?.className).toBe(projectHeaderStyles.blockName);
  });

  it('wires the cue to everything that press reveals, not just the body', () => {
    // `aria-controls` is an ID list. The verdict is the second thing this press reveals
    // and it lives up on the head row — outside the body and before it in the DOM — so a
    // single-id attribute leaves it with no tie to the control.
    opened(ProcessStatus.WAITING_CONNECTION_TEST);
    const controlled = cue().getAttribute('aria-controls')?.split(' ');
    expect(controlled).toEqual(['target-source-meta', 'target-source-meta-verdict']);
    expect(document.getElementById(controlled![0])).toBeTruthy();
    expect(screen.getByTestId('tc-header-tag').parentElement?.id).toBe(controlled![1]);
  });

  it('keeps the verdict in flow, so it can never overlap the card below', () => {
    expect(installStepperStyles.tagSlot).not.toContain('absolute');
    expect(installStepperStyles.tagSlot).not.toContain('top-full');
  });
});

/**
 * The two decisions this header makes for an SDU target, both invisible to a test of the
 * road alone: the header is the ONLY place either one is made.
 */
describe('ProjectPageMeta — SDU', () => {
  const sduProject: TargetSource = { ...projectFixture, isSduType: true };

  it('reads SDU over its underlying CSP, direct upload in the drawer', () => {
    renderOpen({ project: sduProject, identity: awsIdentity });
    expect(within(scopeBlock()).getByText('SDU')).toBeTruthy();
    const body = metaBlock();
    expect(body.getByText('연동 방식')).toBeTruthy();
    expect(body.getByText('고객사가 데이터를 직접 업로드')).toBeTruthy();
    expect(screen.queryByText('AWS Cloud')).toBeNull();
  });

  it('hands the road the SDU variant, and counts to four', () => {
    renderOpen({ project: sduProject, identity: awsIdentity });
    expect(screen.getByTestId('process-progress-bar').getAttribute('data-variant')).toBe('sdu');
    expect(stepText()).toBe('4단계 모두 완료');
  });

  it('gives it no 연결 테스트 verdict to carry, at any step', () => {
    // ⛔ Not "renders it hidden". 연결 테스트 is not a slot on the SDU road — the test
    // runs, but in the Admin console, and a verdict about work this reader can neither
    // see nor repeat is noise. `TcHeaderTag` also fetches on mount, so withholding the
    // node is what makes this a decision not to ASK rather than not to show.
    for (const status of [
      ProcessStatus.WAITING_CONNECTION_TEST,
      ProcessStatus.CONNECTION_VERIFIED,
      ProcessStatus.INSTALLATION_COMPLETE,
    ]) {
      const { unmount } = render(
        <ProjectPageMeta project={{ ...sduProject, processStatus: status }} identity={awsIdentity} />,
      );
      fireEvent.click(cue());
      expect(screen.queryByTestId('tc-header-tag')).toBeNull();
      unmount();
    }
  });
});

/**
 * `tcScopeFor` is the only branch left in the header, and both of its outcomes render the
 * same component with the same props shape — so picking the wrong run is silent
 * everywhere else: tsc, lint and every other assertion in this suite pass either way, and
 * the screen just reports a different run.
 */
const scopeAt = (status: ProcessStatus): string | null => {
  const { unmount } = render(
    <ProjectPageMeta project={{ ...projectFixture, processStatus: status }} identity={awsIdentity} />,
  );
  fireEvent.click(cue());
  const scope = screen.getByTestId('tc-header-tag').getAttribute('data-scope');
  unmount();
  return scope;
};

describe('ProjectPageMeta — which run the header tag reports', () => {
  it('Step 5 reports the raw latest run, failure included — fixing it is the user’s job', () => {
    expect(scopeAt(ProcessStatus.WAITING_CONNECTION_TEST)).toBe('latest');
  });

  it('Step 6 stands on a run that passed, so it keeps reporting that run', () => {
    expect(scopeAt(ProcessStatus.CONNECTION_VERIFIED)).toBe('latestSuccess');
  });

  it('Step 7 likewise reports the last SUCCESS, not a later failure', () => {
    expect(scopeAt(ProcessStatus.INSTALLATION_COMPLETE)).toBe('latestSuccess');
  });
});
