'use client';

/**
 * 관리자 콘솔의 서비스 레일 — `/admin/pipelines/services` 와
 * `/admin/pipelines/ops/services` 가 함께 쓴다.
 *
 * 두 화면이 같은 JSX 를 두 벌 들고 있었고, 이미 한 번 어긋난 적이 있다 (한쪽은
 * 10개씩, 한쪽은 8개씩 — 그래서 `SERVICE_RAIL_PAGE_SIZE` 가 생겼다). 이번에는
 * 목록 로딩 표현이 갈려 있었다: 한쪽은 스켈레톤, 한쪽은 빈 상자. 여기서는 두
 * 화면 모두 스켈레톤을 쓴다 — 빈 상자는 "아직 안 왔다"와 "아무것도 없다"를 같은
 * 모양으로 보여준다.
 *
 * `/services` 의 `ServiceSidebar` 와는 **일부러** 합치지 않았다. 그쪽은 자기
 * 배경(#E2E7EA)과 오른쪽 경계선을 칠하는 독립 면이고, 이 레일은 배경을 칠하지
 * 않는다 — `serviceListStyles.split` 이 깔아 둔 바닥과 한 장으로 붙어 보여야
 * 하기 때문이다(흰 면으로 만들었다가 "두 페이지를 붙여놓은 것처럼" 읽혀 되돌린
 * 이력이 styles.ts 주석에 남아 있다). 실패+재시도 상태도 이쪽에만 있다. 하나로
 * 만들려면 surface·title·error·sticky·paging 다섯 축의 스위치가 필요한데,
 * 소비처는 셋뿐이다. 공유하는 것은 컴포넌트가 아니라 부품이다 —
 * `SERVICE_RAIL_PAGE_SIZE`, `SidebarPagination`, `serviceTileClass`,
 * `serviceSidebarStyles.tile`.
 */
import type { ReactElement, ReactNode } from 'react';
import { cn, serviceSidebarStyles } from '@/lib/theme';
import { serviceTileClass } from '@/app/components/features/admin/ServiceSidebar/ServiceRow';
import { SidebarPagination } from '@/app/components/features/admin/ServiceSidebar/SidebarPagination';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { SearchBox } from '@/app/admin/pipelines/_components/SearchBox';
import { serviceListStyles } from '@/app/admin/pipelines/_services/styles';
import type { ServiceItem } from '@/app/admin/pipelines/_services/logic';

/**
 * Ceiling for one stretched row. A full page divides the rail's height evenly, so
 * without a cap a tall monitor — or a two-row search result — would stretch each
 * row down the whole rail.
 */
const ROW_MAX_PX = 88;

interface RailPageInfo {
  totalElements: number;
  totalPages: number;
  /** 0-based, like the contract's `page` parameter and SidebarPagination. */
  number: number;
  size: number;
}

interface AdminServiceRailProps {
  /** 레일 머리의 h1 — 화면마다 다르다 ("서비스 운영" / "서비스·대상 검색"). */
  title: string;
  /** 총계 pill. `null` 이면 감춘다 (아직 못 받았거나 0건). */
  total: number | null;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  services: ServiceItem[];
  loading: boolean;
  /** 목록 조회 실패 — 메시지와 재시도는 화면이 정한다. */
  error?: { message: string; onRetry: () => void } | null;
  selectedCode: string | null;
  onSelectService: (code: string) => void;
  pageInfo: RailPageInfo;
  onPageChange: (page: number) => void;
}

/**
 * 목록 자리의 스켈레톤 — 행 모양(타일 · 이름 · 코드)을 그대로 흉내 내 데이터가
 * 도착해도 레이아웃이 튀지 않는다. 행 수가 페이지 크기인 이유도 같다.
 *
 * 구역 라벨은 막대가 아니라 진짜 글자다. 검색 중인지 아닌지는 요청이 끝나기 전에
 * 이미 아는 로컬 상태라, 가리면 갖고 있는 정보를 숨기는 셈이 된다.
 */
function RailSkeleton({ section, rows }: { section: string; rows: number }): ReactElement {
  return (
    <>
      <div className={serviceListStyles.railSection}>{section}</div>
      <div
        className={serviceListStyles.railList}
        style={{ maxHeight: rows * ROW_MAX_PX }}
        aria-busy="true"
        aria-live="polite"
      >
        {Array.from({ length: rows }).map((_, i) => (
          // 진짜 행과 같은 flex-1 + min-h-[48px] — 스켈레톤이 걷힐 때 목록이 튀지 않는다.
          <div key={i} className="flex flex-1 min-h-[48px] items-center gap-2.5 px-3" aria-hidden="true">
            <div className={cn(serviceSidebarStyles.skeletonBar, 'h-7 w-7 shrink-0 rounded-[6px]')} />
            <div className={cn(serviceSidebarStyles.skeletonBar, 'h-3 flex-1 rounded')} />
            <div className={cn(serviceSidebarStyles.skeletonBar, 'h-5 w-10 shrink-0 rounded-[6px]')} />
          </div>
        ))}
      </div>
    </>
  );
}

/** 목록 자리를 채우는 것 하나 — 실패 > 로딩 > 빈 결과 > 행 순으로 갈린다. */
function RailBody({
  services,
  loading,
  error,
  section,
  pageSize,
  selectedCode,
  onSelectService,
}: {
  services: ServiceItem[];
  loading: boolean;
  error?: { message: string; onRetry: () => void } | null;
  section: string;
  pageSize: number;
  selectedCode: string | null;
  onSelectService: (code: string) => void;
}): ReactNode {
  const s = serviceListStyles;

  if (error) {
    return (
      <div className="flex-1">
        <PlEmptyState
          onGround
          icon="search"
          message={error.message}
          meta={
            <PlButton variant="secondary" size="sm" onClick={error.onRetry}>
              다시 시도
            </PlButton>
          }
        />
      </div>
    );
  }

  if (loading) return <RailSkeleton section={section} rows={pageSize} />;

  if (services.length === 0) {
    return (
      <div className="flex-1">
        <PlEmptyState onGround icon="search" message="검색 결과가 없습니다." />
      </div>
    );
  }

  return (
    <>
      {/* 구역 라벨은 여기서는 남는다. `/services` 레일에서 뺀 이유는 바로 위 h2 가
          이미 "서비스 목록"이라 같은 말이 두 번 나왔기 때문인데, 이 레일의 h1 은
          "서비스 운영" · "서비스·대상 검색" 이라 목록의 범위를 말해 주는 건 이
          줄뿐이다. */}
      <div className={s.railSection}>{section}</div>
      <div
        className={s.railList}
        // 행이 남은 높이를 나눠 가지므로 상한이 없으면 한 장이 짧을 때 행이 레일
        // 끝까지 늘어난다. 상한을 걸면 남는 높이는 마지막 행과 페이지 표시 사이로
        // 빠진다 — railFoot 의 mt-auto 가 표시를 바닥에 붙여 두기 때문.
        style={{ maxHeight: services.length * ROW_MAX_PX }}
      >
        {/* 계약 스키마가 두 필드 모두 optional 이라(zod 느슨한 codegen) code 가
            없는 행은 이동할 곳이 없다 — 그릴 수 없는 행이라 걸러 낸다. */}
        {services.map((service) => {
          const code = service.service_code;
          if (!code) return null;
          const name = service.service_name ?? code;
          const active = code === selectedCode;
          return (
            <button
              key={code}
              type="button"
              onClick={() => {
                if (active) return;
                onSelectService(code);
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
              {/* EOS 배지는 여기 없다 — ServiceItem 에 그 필드가 없고, EOS 는 대상의
                  service_info 를 거쳐야 읽히므로 상세에서만 표시한다. */}
              <span className={active ? s.codeActive : s.code}>{code}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

export function AdminServiceRail({
  title,
  total,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  services,
  loading,
  error = null,
  selectedCode,
  onSelectService,
  pageInfo,
  onPageChange,
}: AdminServiceRailProps): ReactElement {
  const s = serviceListStyles;
  const section = searchValue.trim() ? '검색 결과' : '전체 서비스';

  return (
    // 우측 상세는 표·타일로 길어지므로 레일이 같이 늘어나면 페이지 이동 버튼이
    // 화면 밖으로 밀린다 — 뷰포트 높이에 고정하고 목록만 스크롤.
    // railSticky 의 top-[64px] = sticky TopNav 높이. top-0 이면 레일 제목이
    // TopNav 밑으로 들어간다.
    <aside className={cn(s.rail, s.railSticky)} aria-label="서비스 목록">
      {/* 제목 + 개수. 검색 중에는 걸린 건수라 그대로 둔다. */}
      <div className={s.railHead}>
        <h1 className={s.railTitle}>{title}</h1>
        {total != null && total > 0 && <span className={s.railCount}>{total}</span>}
      </div>
      <div className={s.railSearch}>
        <SearchBox
          // `block` alone leaves SearchBox's `inline-block` shrink-to-fit width.
          wrapClassName="block w-full"
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      <div className={s.railBody}>
        <RailBody
          services={services}
          loading={loading}
          error={error}
          section={section}
          pageSize={pageInfo.size}
          selectedCode={selectedCode}
          onSelectService={onSelectService}
        />
        {/* 한 장뿐이면 SidebarPagination 이 아무것도 그리지 않는다 — 갈 곳 없는
            "1 / 1" 은 컨트롤이 아니다. */}
        <div className={s.railFoot}>
          <SidebarPagination pageInfo={pageInfo} onPageChange={onPageChange} />
        </div>
      </div>
    </aside>
  );
}
