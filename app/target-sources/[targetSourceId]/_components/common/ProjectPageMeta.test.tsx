// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type TargetSource } from '@/lib/types';

// The flat header mounts the quiet stepper; stub it and surface the step it receives.
vi.mock('@/app/components/features/process-status', () => ({
  InstallationProcessProgressBar: ({ currentStep }: { currentStep: unknown }) => (
    <div data-testid="process-progress-bar" data-step={String(currentStep)} />
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

const awsIdentity: ProjectIdentity = {
  cloudProvider: 'AWS',
  identifiers: [{ label: 'Account ID', value: '482915736204', mono: true }],
  installMode: 'auto',
};

/** The only provider with two identifiers, and so the only one that exercises the
 *  card's second row — and its UUIDs are the widest value the column ever holds. */
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

/** The cue is named for exactly what it opens now (오너 11차 지시) — one paragraph. */
const foldCue = () => screen.getByRole('button', { name: /설명/ });

/**
 * The description lives behind the 「설명」 disclosure and the header opens folded, so
 * every assertion about it has to open it first — a bare `render` sees the path, the
 * named 설치 대상 block and the progress band, and nothing else.
 */
const renderOpen = (props: Parameters<typeof ProjectPageMeta>[0]) => {
  const result = render(<ProjectPageMeta {...props} />);
  fireEvent.click(foldCue());
  return result;
};

/**
 * 개선안 ㄷ: the facts sit in a NAMED region instead of a card. Querying it by that
 * accessible name is the point of the round — the card had no name, so this helper
 * used to reach for `[class*="bg-white"]`, which is precisely the coupling between
 * "is a group" and "has a fill" that the plane was removed to break.
 */
const scopeBlock = () => screen.getByRole('region', { name: '설치 대상' });

const metaBlock = () => {
  const body = document.getElementById(foldCue().getAttribute('aria-controls') ?? '');
  if (!body) throw new Error('meta block is closed');
  return within(body);
};

describe('ProjectPageMeta — 설명 disclosure', () => {
  it('folds the meta away by default — the header is path + named scope + progress band', () => {
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    expect(screen.queryByText('클라우드 정보')).toBeNull();
    expect(screen.queryByText('desc')).toBeNull();
    // The tiers that survive the fold.
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(scopeBlock()).toBeTruthy();
    expect(screen.getByTestId('process-progress-bar')).toBeTruthy();
  });

  it('keeps the provider and every identifier on the folded block (오너 4·6차 지시)', () => {
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    const card = within(scopeBlock());
    // The block states the SCOPE and the whole of it — that completeness is what
    // let the fold drop its 클라우드 정보 group. Neither the service name nor the
    // code is down here: the path above carries both.
    for (const fact of ['AWS Cloud', 'Account ID', '482915736204']) {
      expect(card.getByText(fact)).toBeTruthy();
    }
    expect(card.queryByText('서비스 코드')).toBeNull();
  });

  it('lets a branded logo be the provider name, and keeps that name readable aloud', () => {
    // 오너 8차 지시 — the AWS mark IS the wordmark, so 「AWS Cloud」 beside it printed
    // the name twice. It goes off the SCREEN, not out of the document: a logo
    // announces nothing, so dropping the text outright would leave the three branded
    // clouds unnamed for anyone not looking at it.
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    expect(within(scopeBlock()).getByText('AWS Cloud').className).toBe('sr-only');
  });

  // The other half of the same rule. A server rack and an upload arrow are ours, not a
  // vendor's, and name nothing on their own; hiding these two would delete the provider
  // from the card rather than de-duplicate it.
  it.each([
    ['IDC', { cloudProvider: 'IDC' as const }, 'IDC'],
    ['SDU', { isSduType: true }, 'SDU'],
  ])('still prints the %s name in ink — its glyph is a generic outline', (_, patch, name) => {
    render(<ProjectPageMeta project={{ ...projectFixture, ...patch }} identity={idcIdentity} />);
    expect(within(scopeBlock()).getByText(name).className).not.toContain('sr-only');
  });

  it('stacks every identifier on its own row, aligned in one label column', () => {
    // 오너 6차 지시 — Azure's two IDs read as a list, not as a line that ran out of
    // room, and that only holds while the rows come from grid structure. A wrapping
    // flex row would put Tenant ID under whatever column the viewport left it.
    render(<ProjectPageMeta project={projectFixture} identity={azureIdentity} />);
    const ids = within(scopeBlock()).getByText('Subscription ID').parentElement as HTMLElement;
    expect(ids.className).toContain('grid');
    expect(ids.className).toContain('grid-cols-[auto_1fr]');
    expect(within(ids).getByText('Tenant ID')).toBeTruthy();
    // Same grid, so both labels share a column and both values start on one x.
    expect(within(ids).getByText('Tenant ID').parentElement).toBe(ids);
  });

  it('lets the value shrink and nothing else — the card must not overflow', () => {
    render(<ProjectPageMeta project={projectFixture} identity={azureIdentity} />);
    const subscription = '12345678-abcd-ef01-2345-6789abcdef01';
    const value = within(scopeBlock()).getByText(subscription);
    expect(value.className).toContain('min-w-0');
    expect(value.className).toContain('truncate');
    // `flex-none` on the wrapper would pin flex-shrink to 0 and this truncation
    // would never fire — the row overflowed the card instead. Keep it off.
    expect(value.parentElement?.className).not.toContain('flex-none');
    expect(value.parentElement?.getAttribute('title')).toBe(subscription);
  });

  it('copies an identifier from the card itself, not from a second copy of it', () => {
    // The reason the cue is a small control instead of the whole row: a copy button
    // inside a <button> is invalid, and dropping copy would have been the price of
    // keeping the big hit area once the 클라우드 정보 group went away.
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    expect(within(scopeBlock()).getByRole('button', { name: 'Account ID 복사' })).toBeTruthy();
  });

  it('opens and closes on the toggle, reporting state to assistive tech', () => {
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    const toggle = foldCue();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    // aria-controls has to name a box that exists, or the association is a lie.
    const body = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    expect(body).toBeTruthy();
    // Head and body are one object: the body opens inside the named block, not after it.
    expect(scopeBlock().contains(body as Node)).toBe(true);
    expect(screen.getByText('desc')).toBeTruthy();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('desc')).toBeNull();
  });

  it('says only 설명, because one paragraph is all it opens (오너 11차 지시)', () => {
    // 「설치 대상 정보」 promised a body this fold stopped having three rounds ago, when
    // the identifiers, their copy buttons and the install mode all moved onto the face.
    // The rename is the cheap half of the fix; the gate below is the other half.
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    expect(screen.queryByRole('button', { name: /설치 대상 정보/ })).toBeNull();
    expect(foldCue().textContent).toBe('설명');
  });

  it('drops the cue entirely when there is nothing behind it', () => {
    // An exact promise over an empty box is worse than no promise. Nothing else in the
    // block moves — the scope row is not part of the disclosure.
    render(
      <ProjectPageMeta project={{ ...projectFixture, description: '  ' }} identity={awsIdentity} />,
    );
    expect(screen.queryByRole('button', { name: /설명/ })).toBeNull();
    expect(within(scopeBlock()).getByText('Account ID')).toBeTruthy();
  });
});

describe('ProjectPageMeta — path heading', () => {
  it('states the job at the weight of a location, not a 24px title', () => {
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    const heading = screen.getByRole('heading', { level: 1 });
    // The path closes on the service code, not the target-source id (오너 5차 지시):
    // #1008 is a database key, and it was holding the most emphatic slot on the line.
    // Both identifying segments now say what KIND they are (오너 12차 지시).
    expect(heading.textContent).toBe('PII Agent 설치/서비스Service A/서비스 코드SERVICE-A');
    expect(heading.textContent).not.toContain('1008');
  });

  it('tags both service segments with their kind — a path cannot say what a token is', () => {
    // 오너 12차 지시. `/ SERVICE-A` identified nothing to a first-time reader, and the
    // fix is not a longer path but a named one. The two tags share `codeChip`'s fill,
    // so they read as one vocabulary; the code's mono is what separates them.
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    const heading = within(screen.getByRole('heading', { level: 1 }));
    const kind = heading.getByText('서비스');
    const codeLabel = heading.getByText('서비스 코드');
    const code = heading.getByText('SERVICE-A');

    // Both are tags, not runs of text: a bare label beside the value would read as
    // part of it, which is the thing the reader could not parse in the first place.
    expect(kind.className).toContain('rounded-[6px]');
    expect(kind.className).toContain('bg-[#EAEEF7]');
    expect(codeLabel.parentElement?.className).toContain('bg-[#EAEEF7]');
    // The code chip holds its own label, so the two live in ONE tag, not two.
    expect(codeLabel.parentElement).toBe(code.parentElement);
    expect(code.className).toContain('font-mono');
  });

  it('keeps the path outside the 설치 대상 block — it is page chrome (개선안 ㄷ)', () => {
    // The card that used to house it is gone: it covered 91% of its column and matched
    // the step card's x, width and shadow, so the page's subject read as one of the
    // page's items. What names this block now is a `blockLabel`, and a block's name
    // cannot be a path — pulling the heading back inside is the regression this pins.
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    expect(scopeBlock().contains(screen.getByRole('heading', { level: 1 }))).toBe(false);
  });

  it('gives the scope block the accessible name the card never had', () => {
    // The whole of 개선안 ㄷ in one assertion: `getByRole('region', …)` only resolves
    // because 설치 대상 is wired as the section's label. A card is invisible here.
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    const block = scopeBlock();
    expect(block.tagName).toBe('SECTION');
    expect(within(block).getByText('설치 대상').id).toBe(block.getAttribute('aria-labelledby'));
  });

  it('clamps the service name — no contract maximum backs it', () => {
    // swagger `service_name` declares no maxLength, so the only guarantee this
    // line can make about width is the one it enforces itself.
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

describe('ProjectPageMeta — description block', () => {
  it('renders the description, with no second 설명 title inside the fold', () => {
    // The cue that opened this box is the word 설명; a body does not re-title itself.
    renderOpen({ project: projectFixture, identity: awsIdentity });
    expect(metaBlock().getByText('desc')).toBeTruthy();
    expect(metaBlock().queryByText('설명')).toBeNull();
  });

  it('has no fold at all when the description is empty', () => {
    render(
      <ProjectPageMeta project={{ ...projectFixture, description: '  ' }} identity={awsIdentity} />,
    );
    expect(document.getElementById('target-source-meta')).toBeNull();
  });
});

describe('ProjectPageMeta — provider group', () => {
  it('keeps 설치 모드 on the card — it decides whether there is work to do', () => {
    // 오너 7차 지시: 자동/수동 is not reference material, so it does not go behind
    // the fold. It is the card's last row, under the identifiers.
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    const card = within(scopeBlock());
    expect(card.getByText('설치 모드')).toBeTruthy();
    expect(card.getByText('자동 설치')).toBeTruthy();
    // The mode's meaning stays on-screen, not behind a tooltip.
    expect(card.getByText('Terraform 권한 위임')).toBeTruthy();
    // Same grid as the identifiers, so its label shares their column.
    expect(card.getByText('설치 모드').parentElement).toBe(card.getByText('Account ID').parentElement);
  });

  it('leaves the fold only what a line cannot say (오너 6·7차 지시)', () => {
    renderOpen({ project: projectFixture, identity: awsIdentity });
    const block = metaBlock();
    expect(block.getByText('desc')).toBeTruthy();
    // Every cloud fact is stated once, on the card. The group that used to repeat
    // them is gone: with the identifiers, their copy buttons and the mode all moved
    // up, it was printing the same values 60px lower under its own eyebrow.
    expect(block.queryByText('클라우드 정보')).toBeNull();
    expect(block.queryByText('AWS Cloud')).toBeNull();
    expect(block.queryByText('482915736204')).toBeNull();
    expect(block.queryByText('Account ID')).toBeNull();
    expect(block.queryByText('설치 모드')).toBeNull();
  });

  it('renders manual mode with its own explanation', () => {
    renderOpen({
      project: projectFixture,
      identity: { ...awsIdentity, installMode: 'manual' },
    });
    expect(screen.getByText('수동 설치')).toBeTruthy();
    expect(screen.getByText('설치 스크립트 직접 실행')).toBeTruthy();
  });

  it('hides the install-mode row when the identity carries none', () => {
    renderOpen({
      project: projectFixture,
      identity: { ...awsIdentity, installMode: undefined },
    });
    expect(screen.queryByText('설치 모드')).toBeNull();
  });

  it('drops identifier rows whose value is absent instead of rendering "-"', () => {
    renderOpen({
      project: projectFixture,
      identity: {
        cloudProvider: 'AWS',
        identifiers: [{ label: 'Account ID', value: null, mono: true }],
      },
    });
    expect(screen.queryByText('Account ID')).toBeNull();
    expect(screen.queryByText('-')).toBeNull();
  });

  it('IDC carries its 사내망 gloss on the card and lists no identifier at all', () => {
    renderOpen({ project: { ...projectFixture, cloudProvider: 'IDC' }, identity: idcIdentity });
    const card = within(scopeBlock());
    expect(card.getByText('IDC')).toBeTruthy();
    expect(card.getByText('사내망')).toBeTruthy();
    // No account, so no divider and no identifier column — an empty slot is the
    // truthful rendering, not a dash (결정 #49).
    expect(card.queryByText('Cloud Provider')).toBeNull();
    expect(screen.queryByText('-')).toBeNull();
  });

  it('an SDU account reads SDU over its underlying CSP, direct upload in the fold', () => {
    renderOpen({ project: { ...projectFixture, isSduType: true }, identity: awsIdentity });
    expect(within(scopeBlock()).getByText('SDU')).toBeTruthy();
    const block = metaBlock();
    expect(block.getByText('연동 방식')).toBeTruthy();
    expect(block.getByText('고객사가 데이터를 직접 업로드')).toBeTruthy();
    expect(screen.queryByText('AWS Cloud')).toBeNull();
  });
});

/**
 * The header shipped with the provider name reading 10px above the identifier
 * beside it, and nothing in this suite noticed — every other assertion here is a
 * text-presence query, which passes at any alignment. These are the class
 * agreements the one-line-per-tier layout rests on; each one, broken alone, puts
 * the two lines back out of register.
 */
const utilityOn = (start: Element | null, prefix: string): string | null => {
  for (let el: Element | null = start; el; el = el.parentElement) {
    const hit = String(el.className)
      .split(/\s+/)
      .find((c) => c.startsWith(prefix));
    if (hit) return hit;
  }
  return null;
};

describe('ProjectPageMeta — one line per tier', () => {
  it('gives the provider name and the account one shared line box on the card', () => {
    // SDU, because the branded clouds no longer print a name to align (오너 8차 지시) —
    // an inked provider name beside an identifier value is now only reachable through
    // IDC or SDU, and neither ships one today (IDC carries no identifier; an SDU target
    // never reaches this header). So this guards the token agreement, not a live pixel:
    // it is what the next provider to print a name will land on.
    render(<ProjectPageMeta project={{ ...projectFixture, isSduType: true }} identity={awsIdentity} />);
    const card = within(scopeBlock());
    const provider = card.getByText('SDU');
    const value = card.getByText('482915736204');

    // Same size, or one of them sets the row's content height alone. The size sits
    // on the value's wrapper, not on the truncating span, so walk up for both.
    expect(utilityOn(provider, 'text-[')).toBe('text-[14px]');
    expect(utilityOn(value, 'text-[')).toBe('text-[14px]');

    // Same size is not the same baseline. Both line boxes must also declare the
    // same leading, or the glyphs sit ~1px apart on a line 24px tall.
    expect(utilityOn(provider, 'leading-')).toBe(utilityOn(value, 'leading-'));
    expect(utilityOn(provider, 'leading-')).not.toBeNull();
  });
});

describe('ProjectPageMeta — install progress', () => {
  it('mounts the stepper with the project processStatus', () => {
    render(<ProjectPageMeta project={projectFixture} identity={awsIdentity} />);
    expect(screen.getByTestId('process-progress-bar').getAttribute('data-step')).toBe(
      String(projectFixture.processStatus),
    );
  });
});
