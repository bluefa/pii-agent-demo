'use client';

/**
 * ServiceAssignmentModal — the (서비스 · NLB) combinations sharing ONE IP Set.
 *
 * The subject is the IP SET, not the resource. Several services register the same
 * address, and each of them is served by its own NLB listener; what the admin opens this
 * for is that fan-out. So the key block leads with the IP Set and everything below it
 * answers "who else is on this address, and through which NLB".
 *
 * Master–detail, because the fan-out is not small: 30 NLB indexes × ~20 services = 600
 * combinations on one address. Laid out flat that measured 19,712px of list inside a
 * 417px box — 47 screens with no way to find anything. Here the left column holds one row
 * per NLB (which doubles as the distribution) and the right shows only the selected one,
 * so the modal's height is fixed no matter how many combinations arrive.
 *
 * The search filters across every NLB, not just the open one: at 600 entries scrolling is
 * not a way to find a service, and a filter that only searched the visible column would
 * be a filter that cannot find anything you have not already found.
 *
 * Read-only — the resource's OWN assignment is changed in NlbAssignModal, and no footer,
 * since the only action would have been 닫기 and the header X already is that.
 * resource_id is NEVER rendered (design-spec §8). `mappings === null` means the fetch
 * failed, which the body says outright instead of passing for "없음".
 */
import { useMemo, useState, type ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { TqModal } from '@/app/admin/pipelines/queue/_components/TqModal';
import { findResourceMappings } from '@/app/admin/pipelines/queue/requests/_logic';
import type {
  RequestResourceRow,
  ResourceNlbMappings,
} from '@/app/lib/api/task-queue-requests';

/** One NLB and the services on it, for the master column. */
interface NlbGroup {
  nlbIndex: number | null;
  services: string[];
}

const KEY_BLOCK =
  'flex items-start gap-3 rounded-xl border border-[var(--pl-primary)]/20 bg-[var(--pl-primary-bg)] px-4 py-3';
const KEY_LABEL =
  'shrink-0 pt-1 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--pl-primary)]';
const KEY_IP =
  'rounded-md border border-[var(--pl-primary)]/25 bg-[var(--pl-bg-card)] px-2 py-[3px] text-[12px] font-semibold text-[var(--pl-primary)] [font-family:var(--pl-font-mono)]';
const KEY_ENGINE =
  'ml-auto shrink-0 pt-1 text-[12px] text-[var(--pl-primary)] [font-family:var(--pl-font-mono)]';

const SEARCH =
  'w-full rounded-lg border border-[var(--pl-border)] bg-[var(--pl-bg-card)] px-3 py-2 text-[14px] text-[var(--pl-text-strong)] placeholder:text-[var(--pl-text-weak)] focus:border-[var(--pl-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--pl-primary)]/25';

const MASTER_ITEM =
  'flex w-full items-baseline justify-between gap-2 border-b border-[var(--pl-border)] px-3 py-2 text-left text-[12px] [font-family:var(--pl-font-mono)] text-[var(--pl-text-medium)] hover:bg-[var(--pl-bg-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--pl-primary)]';
const MASTER_ITEM_ON =
  'bg-[var(--pl-bg-card)] font-bold text-[var(--pl-text-strong)] shadow-[inset_3px_0_0_var(--pl-primary)]';

const CHIP =
  'rounded-md border border-[var(--pl-border)] bg-[var(--pl-bg-inner)] px-[7px] py-[2px] text-[12px] font-medium text-[var(--pl-text-medium)] [font-family:var(--pl-font-mono)]';
const EMPTY_WRAP = 'flex flex-col items-center gap-2 px-5 py-8 text-center';
const EMPTY_TITLE = 'text-[16px] font-semibold text-[var(--pl-text-strong)]';
const EMPTY_BODY = 'max-w-[46ch] text-[14px] text-[var(--pl-text-weak)]';

/** rows → one entry per NLB, index ascending; nulls last. */
function toGroups(rows: { serviceCode: string | null; nlbIndex: number | null }[]): NlbGroup[] {
  const byIndex = new Map<number | null, string[]>();
  for (const row of rows) {
    const list = byIndex.get(row.nlbIndex);
    const code = row.serviceCode ?? '—';
    if (list) list.push(code);
    else byIndex.set(row.nlbIndex, [code]);
  }
  return [...byIndex.entries()]
    .map(([nlbIndex, services]) => ({ nlbIndex, services }))
    // A mapping with no index is real data the contract allows; it sorts last rather
    // than being dropped, because dropping it would under-report the fan-out.
    .sort((a, b) => (a.nlbIndex ?? Infinity) - (b.nlbIndex ?? Infinity));
}

export interface ServiceAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  resource: RequestResourceRow;
  /** All resources' mappings, or null when the fetch failed. */
  mappings: ResourceNlbMappings[] | null;
}

export function ServiceAssignmentModal({
  open,
  onClose,
  resource,
  mappings,
}: ServiceAssignmentModalProps): ReactElement {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<number | null | undefined>(undefined);

  const rows = findResourceMappings(mappings, resource.resourceId);
  const total = rows?.length ?? 0;

  const groups = useMemo(() => toGroups(rows ?? []), [rows]);

  // Filtering keeps a group only if some service matches, and narrows the group to the
  // matches — so the master column doubles as the result count per NLB.
  const shown = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return groups;
    return groups
      .map((g) => ({ ...g, services: g.services.filter((s) => s.toUpperCase().includes(q)) }))
      .filter((g) => g.services.length > 0);
  }, [groups, query]);

  // `picked` is the admin's choice; until they make one — or when a search removes what
  // they picked — the first visible group stands in. Deriving rather than syncing state
  // keeps the two from disagreeing while the query is being typed.
  const active =
    shown.find((g) => g.nlbIndex === picked) ?? shown[0] ?? null;

  const label = (nlbIndex: number | null): string =>
    nlbIndex != null ? `NLB #${nlbIndex}` : 'NLB 미배정';

  const dbLabel = resource.databaseType ? getDatabaseShortLabel(resource.databaseType) : null;
  const isSet = resource.connectTargets.length > 1;

  return (
    <TqModal
      open={open}
      onClose={onClose}
      title="같은 IP Set을 쓰는 서비스"
      sub="이 IP Set으로 접속하는 서비스와, 서비스마다 배정된 NLB예요."
    >
      {/* The join key, made the subject. It stays put in every state — including the two
          empty ones, because what is missing has to be missing *about* something. */}
      <div className={KEY_BLOCK}>
        <span className={KEY_LABEL}>{isSet ? 'IP Set' : '접속 주소'}</span>
        <span className="flex flex-wrap gap-1.5">
          {resource.connectTargets.map((host) => (
            <span key={host} className={KEY_IP}>
              {host}
            </span>
          ))}
        </span>
        {(dbLabel || resource.port != null) && (
          <span className={KEY_ENGINE}>
            {[dbLabel, resource.port].filter(Boolean).join(' · ')}
          </span>
        )}
      </div>

      {rows === null ? (
        <div className={EMPTY_WRAP}>
          <p className={EMPTY_TITLE}>조합을 불러오지 못했어요</p>
          <p className={EMPTY_BODY}>
            잠시 후 다시 열어 주세요. 계속 보이면 조회에 실패한 것이지, 조합이 없는 것은 아니에요.
          </p>
        </div>
      ) : total === 0 ? (
        <div className={EMPTY_WRAP}>
          <p className={EMPTY_TITLE}>이 IP Set을 쓰는 다른 서비스가 없어요</p>
          <p className={EMPTY_BODY}>지금은 이 연동 대상만 이 주소를 사용해요.</p>
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-3">
            <input
              type="search"
              className={SEARCH}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="서비스 코드로 찾기 — 예: ORD"
              aria-label="서비스 코드 검색"
            />
            {/* The totals the admin came for, next to the control that changes them. */}
            <span className="shrink-0 text-[12px] tabular-nums text-[var(--pl-text-weak)]">
              서비스 {total}개 · NLB {groups.length}개
            </span>
          </div>

          {shown.length === 0 ? (
            <div className={EMPTY_WRAP}>
              <p className={EMPTY_TITLE}>‘{query.trim()}’와 맞는 서비스가 없어요</p>
              <p className={EMPTY_BODY}>서비스 코드 일부만 입력해도 찾을 수 있어요.</p>
            </div>
          ) : (
            // Fixed height by construction: each column scrolls on its own, so 600
            // combinations and 6 occupy the same box.
            <div className="mt-3 grid grid-cols-[236px_1fr] overflow-hidden rounded-[10px] border border-[var(--pl-border)]">
              <div className="max-h-[300px] overflow-y-auto border-r border-[var(--pl-border)] bg-[var(--pl-bg-inner)]">
                {shown.map((g) => (
                  <button
                    key={g.nlbIndex ?? 'none'}
                    type="button"
                    onClick={() => setPicked(g.nlbIndex)}
                    aria-current={active?.nlbIndex === g.nlbIndex}
                    className={cn(
                      MASTER_ITEM,
                      active?.nlbIndex === g.nlbIndex && MASTER_ITEM_ON,
                    )}
                  >
                    {label(g.nlbIndex)}
                    <span className="font-normal tabular-nums text-[var(--pl-text-weak)]">
                      {g.services.length}
                    </span>
                  </button>
                ))}
              </div>
              <div className="max-h-[300px] overflow-y-auto px-4 py-3">
                {active && (
                  <>
                    <p className="mb-2.5 text-[12px] text-[var(--pl-text-weak)]">
                      <span className="font-bold text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)]">
                        {label(active.nlbIndex)}
                      </span>
                      {' 를 타는 서비스 '}
                      <span className="tabular-nums">{active.services.length}</span>개
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {active.services.map((code) => (
                        <span key={code} className={CHIP}>
                          {code}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </TqModal>
  );
}
