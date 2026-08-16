/**
 * DuplicateAddressNotice — P3 상단, "같은 데이터베이스를 두 번 등록한 요청일 수 있어요".
 *
 * RequestVerdictNotice 와 같은 문법(3px 좌측 룰에 매단 인용, 12px 라벨 → 14px 문장)을
 * 쓴다. 채운 경고 박스가 아니다: 이 화면에서 색을 칠한 면은 아직 없고, 확인해 보라는
 * 요청이지 승인을 막는 판정도 아니다.
 *
 * 문구는 인프라 용어를 쓰지 않는다. 이 화면을 보는 관리자가 이중화 구성이나 대표 주소
 * 같은 말을 안다고 가정할 수 없다. "무엇이 이상한가 → 승인하면 무슨 일이 생기는가 →
 * 무엇을 하면 되는가" 세 문장으로, 줄이지 않고 그대로 적는다.
 *
 * 가리키는 대상은 접속 주소다. IDC 표는 리소스 이름을 그리지 않고 행의 정체는 접속
 * 주소이므로(IdcResourceTable), 이름으로 부르면 관리자가 표에서 찾을 수 없다.
 */
import type { ReactElement } from 'react';
import { idcStyles } from '@/lib/theme';
import type { SuspectGroup } from '@/app/admin/pipelines/queue/requests/_duplicateAddress';

export interface DuplicateAddressNoticeProps {
  groups: readonly SuspectGroup[];
  /** 표를 '확인 필요'로 좁힌다 — 아래 표는 이 그룹들을 붙여 세우기는 하지만 그 사이에
   *  다른 행들이 있고 페이지도 갈리므로, 한 화면에 모아 보는 길을 따로 둔다. */
  onShowInTable?: () => void;
}

export function DuplicateAddressNotice({
  groups,
  onShowInTable,
}: DuplicateAddressNoticeProps): ReactElement | null {
  if (groups.length === 0) return null;
  // 주소를 여러 개 등록한 항목이 끼어 있으면 표에서 나머지가 접혀 있다 — 그때만 괄호
  // 숫자의 뜻을 밝힌다. 해당 없는 요청에까지 설명을 달면 읽을 게 하나 늘 뿐이다.
  const hasMultiAddressRow = groups.some((group) =>
    group.members.some((member) => member.addressCount > 1),
  );

  return (
    <div className="mb-6" role="status">
      <div className="border-l-[3px] border-[var(--pl-warn)] pl-4">
        <p className="text-[12px] font-bold tracking-[0.02em] text-[var(--pl-warn-text)]">
          확인 필요
        </p>
        <p className="mt-1.5 text-[14px] font-medium leading-[1.5] text-[var(--pl-text-strong)]">
          같은 데이터베이스를 여러 번 등록한 요청일 수 있어요
        </p>
        <p className="mt-2 max-w-[880px] text-[14px] leading-[1.6] text-[var(--pl-text-medium)]">
          아래 {groups.length}건은 IP 주소가 서로 같거나 끝자리만 1 차이가 나고, Database Type과
          Port까지 같아요. 데이터베이스 한 대를 주소만 다르게 여러 번 등록하면, 승인 후 같은
          데이터를 그만큼 반복해서 검사하게 돼요. 서로 다른 데이터베이스가 맞는지 요청자에게
          확인한 뒤 승인해 주세요.
        </p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {groups.map((group) => (
            <li key={group.label} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              {/* 표의 행들에 붙는 것과 같은 이름 — 알림에서 읽은 건을 표에서 되찾는 열쇠다. */}
              <span className={idcStyles.checkBadge}>{group.label}</span>
              {group.members.map((member, index) => (
                <span
                  key={`${member.addresses.join('|')}|${index}`}
                  className="inline-flex items-baseline gap-2"
                >
                  {index > 0 && <span className="text-[12px] text-[var(--pl-text-weak)]">↔</span>}
                  <SuspectAddressText
                    address={member.addresses.join(' · ')}
                    addressCount={member.addressCount}
                  />
                </span>
              ))}
              {/* 같아서 의심하는 두 값이므로 옆에 그대로 적는다 — 관리자가 표로 건너가
                  다시 확인할 일을 한 줄이 없앤다. */}
              <span className="text-[12px] text-[var(--pl-text-weak)]">
                {group.databaseType} · Port {group.port}
              </span>
            </li>
          ))}
        </ul>
        {onShowInTable && (
          <button
            type="button"
            onClick={onShowInTable}
            className="mt-3 inline-flex items-center rounded-md border border-[var(--pl-warn)] bg-[var(--pl-bg-card)] px-3 py-1.5 text-[12px] font-semibold text-[var(--pl-warn-text)] transition-colors hover:bg-[var(--pl-warn-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pl-warn)]"
          >
            아래 표에서 이 항목만 보기
          </button>
        )}
        {hasMultiAddressRow && (
          <p className="mt-2 text-[12px] leading-[1.5] text-[var(--pl-text-weak)]">
            괄호 안 숫자는 그 항목이 등록한 접속 주소 개수예요. 아래 표는 그중 여기 적힌 주소를
            맨 앞에 보여주고, 나머지는 접어 둡니다.
          </p>
        )}
      </div>
    </div>
  );
}

/** 주소 한 개 — 주소를 여러 개 등록한 항목이면 개수를 괄호로 덧붙인다. */
function SuspectAddressText({
  address,
  addressCount,
}: {
  address: string;
  addressCount: number;
}): ReactElement {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="font-mono text-[14px] font-medium text-[var(--pl-text-strong)]">
        {address}
      </span>
      {addressCount > 1 && (
        <span className="text-[12px] text-[var(--pl-text-weak)]">(주소 {addressCount}개)</span>
      )}
    </span>
  );
}
