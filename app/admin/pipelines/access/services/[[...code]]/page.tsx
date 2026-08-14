'use client';

/**
 * 서비스별 권한 (/admin/pipelines/access/services 와 /…/services/{code}).
 *
 * 서비스·대상 검색과 같은 부품으로 만든 화면이다 — 레일은 `serviceListStyles` 와
 * `getServicesPage` 를 그대로 쓰고(폭·타일·검색·페이저 전부 한 곳에서 온다), 오른쪽은
 * 시트 한 장이다. 시트 안에 카드를 또 얹지 않는다: 표면이 두 겹이 되면 한 화면이 여러
 * 섬으로 갈라진다. 구역은 가로줄로만 나눈다.
 *
 * optional catch-all 이라 `/services/{code}` 로 바로 들어와도 열리고, 레일 클릭은
 * router.push 만 한다 — 선택이 바뀌어도 레일의 검색·페이지 상태는 유지된다.
 *
 * 이력 구역은 같은 이력 API 를 `service_code` 로 필터한 것이다 — 요구사항의 "service
 * code 단위 이력 조회"가 여기 산다. 전역 로그는 권한 요청 화면 아래에 따로 있다.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { cn, serviceSidebarStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { fmtDateTime } from '@/lib/pipeline/format';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';

import { SearchBox } from '@/app/admin/pipelines/_components/SearchBox';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { SERVICE_RAIL_PAGE_SIZE } from '@/app/components/features/admin/ServiceSidebar';
import { serviceTileClass } from '@/app/components/features/admin/ServiceSidebar/ServiceRow';
import { SidebarPagination } from '@/app/components/features/admin/ServiceSidebar/SidebarPagination';
import { serviceListStyles } from '@/app/admin/pipelines/_services/styles';

import {
  PagedCard,
  errorMessage,
  usePagedSection,
  type Column,
} from '@/app/admin/pipelines/access/_components/PagedCard';
import {
  ConfirmDangerModal,
  UserPickerModal,
} from '@/app/admin/pipelines/access/_components/AccessModals';
import { HistoryTypePill } from '@/app/admin/pipelines/access/_components/AccessPills';
import { accessStyles as a } from '@/app/admin/pipelines/access/_components/accessStyles';
import {
  ACCESS_PAGE_SIZE,
  addServiceOwners,
  getAccessHistory,
  getAdminServices,
  getServiceOwners,
  removeServiceOwner,
  sliceToPage,
  type AccessHistoryEntry,
  type AccessPage,
  type AccessUser,
  type AdminServiceRow,
} from '@/app/lib/api/access';

const SERVICE_PAGE_SIZE = SERVICE_RAIL_PAGE_SIZE;
/** 늘어난 레일 행 하나의 상한 — serviceListStyles.item 참고. */
const ROW_MAX_PX = 88;
const SEARCH_DEBOUNCE_MS = 300;

/** 서비스가 안 골라졌을 때 카드가 그릴 빈 페이지 — 훅은 조건부로 못 쓴다. */
const emptyPage = <T,>(): AccessPage<T> => ({
  content: [],
  totalElements: 0,
  totalPages: 1,
  number: 0,
  size: ACCESS_PAGE_SIZE,
});

/**
 * 담당자 표는 두 열뿐이다 — 계약이 사용자 그 자체만 준다(부여 일시·부여자·부여 경로
 * 없음, owner decision 2026-08-13). 열을 채우려고 없는 값을 지어내지 않는다. 부여가
 * 언제 어떤 경로로 일어났는지는 바로 아래 이력 구역이 답한다.
 */
const USER_COLUMNS: readonly Column[] = [
  { label: 'Knox ID', className: a.knox },
  { label: '이메일', className: a.email },
  { className: a.tail },
];

const HISTORY_COLUMNS: readonly Column[] = [
  { label: '구분', className: a.status },
  { label: '대상', className: a.knox },
  { label: '수행자', className: a.knox },
  { label: '사유', className: a.note },
  { label: '일시', className: a.when },
];

export default function AccessServicesPage(): ReactElement {
  const router = useRouter();
  const params = useParams<{ code?: string[] }>();
  const selectedCode = params.code?.[0] ?? null;
  const toast = usePlToast();

  // ── 레일 (서비스·대상 검색과 동일) ───────────────────────────────────────
  const [services, setServices] = useState<AdminServiceRow[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState<unknown>(null);
  const [servicesRetry, setServicesRetry] = useState(0);
  const [svcQuery, setSvcQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [svcPage, setSvcPage] = useState(1);
  const [svcPages, setSvcPages] = useState(1);
  const [svcTotal, setSvcTotal] = useState(0);
  const [resolvedName, setResolvedName] = useState<{ code: string; name: string } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(svcQuery.trim());
      setSvcPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [svcQuery]);

  useAbortableEffect(
    (signal) => {
      setServicesLoading(true);
      setServicesError(null);
      return getAdminServices(debouncedQuery || undefined, svcPage - 1, {
        signal,
        size: SERVICE_PAGE_SIZE,
      })
        .then((page) => {
          if (signal.aborted) return;
          setServices(page.content);
          setSvcPages(page.totalPages);
          setSvcTotal(page.totalElements);
          setServicesLoading(false);
        })
        .catch((err) => {
          if (signal.aborted) return;
          setServicesError(err);
          setSvcTotal(0);
          setSvcPages(1);
          setServicesLoading(false);
        });
    },
    [servicesRetry, svcPage, debouncedQuery],
  );

  const listName = services.find((svc) => svc.serviceCode === selectedCode)?.serviceName ?? null;

  // 다른 페이지에 있는 서비스로 바로 들어온 경우에만 이름을 한 번 찾아온다.
  // 레일이 아직 안 왔으면 기다린다 — `services` 는 빈 배열로 시작하니 그때의 listName
  // null 은 "레일에 없다"가 아니라 "아직 모른다"다. 그걸 답으로 읽으면 URL 로 들어올
  // 때마다 같은 목록을 한 번 더 부른다.
  useAbortableEffect(
    (signal) => {
      if (!selectedCode || listName || servicesLoading) return;
      return getAdminServices(selectedCode, 0, { signal, size: SERVICE_PAGE_SIZE })
        .then((page) => {
          if (signal.aborted) return;
          const match = page.content.find((item) => item.serviceCode === selectedCode);
          if (match) setResolvedName({ code: selectedCode, name: match.serviceName });
        })
        .catch(() => {});
    },
    [selectedCode, listName, servicesLoading],
  );

  const selectedName =
    listName ??
    (resolvedName?.code === selectedCode ? resolvedName.name : null) ??
    selectedCode ??
    '';

  // ── 오른쪽 시트 ──────────────────────────────────────────────────────────
  // 계약이 권한 사용자 전체를 한 번에 준다(페이지 아님) — 나누는 일은 화면 몫이다.
  // 전체 목록을 따로 붙잡는 이유는 피커다: 제외 목록이 **모든** 권한 사용자여야 하는데
  // 현재 페이지만 넘기면 2페이지에 있는 사람이 후보로 다시 올라온다.
  const [allOwners, setAllOwners] = useState<AccessUser[]>([]);
  const fetchUsers = useCallback(
    async (page: number, opts: { signal: AbortSignal }): Promise<AccessPage<AccessUser>> => {
      if (!selectedCode) {
        setAllOwners([]);
        return emptyPage<AccessUser>();
      }
      const { owners } = await getServiceOwners(selectedCode, opts);
      if (!opts.signal.aborted) setAllOwners(owners);
      return sliceToPage(owners, page, ACCESS_PAGE_SIZE);
    },
    [selectedCode],
  );
  const fetchHistory = useCallback(
    (page: number, opts: { signal: AbortSignal }): Promise<AccessPage<AccessHistoryEntry>> =>
      selectedCode
        ? getAccessHistory({ serviceCode: selectedCode }, page, opts)
        : Promise.resolve(emptyPage<AccessHistoryEntry>()),
    [selectedCode],
  );

  const users = usePagedSection(fetchUsers);
  const history = usePagedSection(fetchHistory);

  const [pickerOpen, setPickerOpen] = useState(false);
  /** 해제 확인 중인 담당자 — null 이면 모달이 닫혀 있다. */
  const [revoking, setRevoking] = useState<AccessUser | null>(null);

  const grant = async (emails: string[]): Promise<void> => {
    if (!selectedCode) return;
    try {
      const before = allOwners.length;
      const { owners } = await addServiceOwners(selectedCode, emails);
      setPickerOpen(false);
      toast.show(`${owners.length - before}명에게 ${selectedName} 권한을 부여했어요`);
      users.reload();
      history.reload();
    } catch (err) {
      toast.show(errorMessage(err));
    }
  };

  const revoke = async (): Promise<void> => {
    if (!selectedCode || !revoking) return;
    try {
      await removeServiceOwner(selectedCode, revoking.email);
      toast.show(`${revoking.knoxId}의 ${selectedName} 권한을 해제했어요`);
      setRevoking(null);
      users.reload();
      history.reload();
    } catch (err) {
      toast.show(errorMessage(err));
    }
  };

  const s = serviceListStyles;

  return (
    <div className={s.split}>
      <aside className={cn(s.rail, s.railSticky)} aria-label="서비스 목록">
        <div className={s.railHead}>
          <h1 className={s.railTitle}>서비스별 권한</h1>
          {!servicesLoading && svcTotal > 0 && <span className={s.railCount}>{svcTotal}</span>}
        </div>
        <div className={s.railSearch}>
          {/* 담당자로도 걸린다 — "이 사람이 담당인 서비스"를 찾는 축이다(계약). */}
          <SearchBox
            wrapClassName="block w-full"
            placeholder="서비스 코드/이름/담당자 검색"
            value={svcQuery}
            onChange={(event) => setSvcQuery(event.target.value)}
            aria-label="서비스 코드/이름/담당자 검색"
          />
        </div>
        <div className={s.railBody}>
          {servicesLoading ? (
            <div className="min-h-[240px] flex-1" aria-busy="true" />
          ) : servicesError != null ? (
            <div className="flex-1">
              <PlEmptyState
                onGround
                icon="search"
                message={errorMessage(servicesError)}
                meta={
                  <PlButton
                    variant="secondary"
                    size="sm"
                    onClick={() => setServicesRetry((n) => n + 1)}
                  >
                    재시도
                  </PlButton>
                }
              />
            </div>
          ) : services.length === 0 ? (
            <div className="flex-1">
              <PlEmptyState onGround icon="search" message="검색 결과가 없습니다." />
            </div>
          ) : (
            <>
              <div className={s.railSection}>{svcQuery ? '검색 결과' : '전체 서비스'}</div>
              <div className={s.railList} style={{ maxHeight: services.length * ROW_MAX_PX }}>
                {services.map((service) => {
                  const code = service.serviceCode;
                  const name = service.serviceName;
                  const active = code === selectedCode;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        if (code === selectedCode) return;
                        router.push(passRoutes.pipelines.access.service(code));
                      }}
                      title={`${name} (${code})`}
                      aria-current={active ? 'true' : undefined}
                      className={cn(s.item, active ? s.itemActive : s.itemIdle)}
                    >
                      <span
                        className={cn(serviceSidebarStyles.tile, serviceTileClass(code))}
                        aria-hidden="true"
                      >
                        {name.charAt(0).toUpperCase()}
                      </span>
                      <span className={cn(s.name, active ? s.nameActive : s.nameIdle)}>{name}</span>
                      <span className={active ? s.codeActive : s.code}>{code}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <div className={s.railFoot}>
            <SidebarPagination
              pageInfo={{
                totalElements: svcTotal,
                totalPages: svcPages,
                number: svcPage - 1,
                size: SERVICE_PAGE_SIZE,
              }}
              onPageChange={(next) => setSvcPage(next + 1)}
            />
          </div>
        </div>
      </aside>

      <section className={s.main}>
        {!selectedCode ? (
          <div className={cn(s.sheet, 'items-center justify-center')}>
            <PlEmptyState icon="cursor" center message="좌측에서 서비스를 선택해 주세요." />
          </div>
        ) : (
          <div className={s.sheet}>
            <div className={a.identity}>
              <span className={a.eyebrow}>서비스</span>
              <div className={a.titleRow}>
                <h2 className={a.svcTitle}>{selectedName}</h2>
                <span className={a.svcCodeChip}>
                  <span className={a.svcCodeChipLabel}>서비스코드</span>
                  <span className="[font-family:var(--pl-font-mono)]">{selectedCode}</span>
                </span>
              </div>
              <div className={a.statRow}>
                <div className={a.stat}>
                  <span className={a.statLabel}>권한 사용자</span>
                  <span className={a.statVal}>{users.paged?.totalElements ?? '—'}</span>
                </div>
                <div className={a.stat}>
                  <span className={a.statLabel}>기록된 변경</span>
                  <span className={a.statVal}>{history.paged?.totalElements ?? '—'}</span>
                </div>
              </div>
            </div>

            <hr className={s.sheetRule} />

            <PagedCard
              bare
              title="권한 사용자"
              desc="이 서비스에 접근할 수 있는 사용자예요 — 언제 어떤 경로로 부여됐는지는 아래 이력에서 볼 수 있어요"
              icon="shield-check"
              tone="primary"
              state={users}
              columns={USER_COLUMNS}
              empty={{
                title: '권한을 가진 사용자가 없어요',
                caption: '사용자 추가로 바로 부여하거나, 접근 요청을 승인해 주세요',
              }}
              action={
                <PlButton variant="primary" size="sm" onClick={() => setPickerOpen(true)}>
                  사용자 추가
                </PlButton>
              }
            >
              {(rows) =>
                rows.map((row) => (
                  <div key={row.email} role="row" className={a.row}>
                    <span role="cell" className={a.knox}>
                      {row.knoxId}
                    </span>
                    <span role="cell" className={a.email}>
                      {row.email}
                    </span>
                    <span role="cell" className={a.tail}>
                      <PlButton variant="ghost" size="sm" onClick={() => setRevoking(row)}>
                        해제
                      </PlButton>
                    </span>
                  </div>
                ))
              }
            </PagedCard>

            <hr className={s.sheetRule} />

            <PagedCard
              bare
              title="이 서비스의 권한 이력"
              desc="이 서비스 코드에서 권한이 움직인 기록이에요 — 요청 승인과 직접 부여가 여기서 갈려요"
              icon="clock"
              tone="muted"
              state={history}
              columns={HISTORY_COLUMNS}
              empty={{
                title: '기록된 변경이 없어요',
                caption: '권한이 부여되거나 해제되면 여기에 쌓여요',
              }}
            >
              {(rows) =>
                rows.map((row) => (
                  <div key={row.historyId} role="row" className={a.row}>
                    <span role="cell" className={a.status}>
                      <HistoryTypePill type={row.type} />
                    </span>
                    <span role="cell" className={a.knox}>
                      {row.targetUser.knoxId}
                    </span>
                    <span role="cell" className={a.knox}>
                      {row.actorUser.knoxId}
                    </span>
                    <span role="cell" className={a.note}>
                      {row.note ?? '—'}
                    </span>
                    <span role="cell" className={a.when}>
                      {fmtDateTime(row.createdAt)}
                    </span>
                  </div>
                ))
              }
            </PagedCard>
          </div>
        )}
      </section>

      <UserPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={`${selectedName} 권한 부여`}
        sub="요청 절차 없이 바로 부여해요. 이력에는 '직접 부여'로 남아요."
        excludeEmails={allOwners.map((owner) => owner.email)}
        submitLabel="부여"
        onSubmit={grant}
      />

      <ConfirmDangerModal
        open={revoking != null}
        onClose={() => setRevoking(null)}
        title="서비스 권한 해제"
        sub={`${revoking?.knoxId ?? ''}의 ${selectedName} 접근 권한을 해제해요.`}
        confirmLabel="해제"
        onConfirm={revoke}
      >
        <p className={a.quote}>
          해제하면 이 사용자는 {selectedName} 화면에 더 이상 들어올 수 없어요. 다시 부여하려면
          사용자 추가를 하거나 새 요청을 승인해야 해요.
        </p>
      </ConfirmDangerModal>
    </div>
  );
}
