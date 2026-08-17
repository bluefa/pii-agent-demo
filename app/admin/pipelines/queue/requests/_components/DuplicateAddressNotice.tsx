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
 * 어느 행인지는 여기서 세지 않는다. 주소·엔진·포트를 그룹마다 늘어놓으면 이 알림 자체가
 * 작은 표가 되고, 바로 아래 진짜 표가 같은 값을 다시 그린다 — 중복 경고가 중복으로
 * 표시된다. 규칙과 개수만 말하고, 어느 행인지는 표가 배지와 짝 주소로 말한다.
 */
import type { ReactElement } from 'react';
import type { SuspectGroup } from '@/app/admin/pipelines/queue/requests/_duplicateAddress';

export interface DuplicateAddressNoticeProps {
  groups: readonly SuspectGroup[];
  /** 표를 '확인 필요'로 좁힌다 — 표는 요청 순서 그대로라 의심 행이 흩어져 있고 페이지도
   *  갈리므로, 한 화면에 모아 보는 길을 따로 둔다. */
  onShowInTable?: () => void;
}

export function DuplicateAddressNotice({
  groups,
  onShowInTable,
}: DuplicateAddressNoticeProps): ReactElement | null {
  if (groups.length === 0) return null;
  // 그룹 수가 아니라 행 수를 센다 — '확인 필요' 타일과 표의 배지가 세는 것도 행이고,
  // 한 화면에서 두 숫자가 다르면 어느 쪽이 무엇을 세는지 알 길이 없다.
  const rowCount = groups.reduce((sum, group) => sum + group.members.length, 0);

  return (
    <div className="mb-6" role="status">
      <div className="border-l-[3px] border-[var(--pl-warn)] pl-4">
        <p className="text-[12px] font-bold tracking-[0.02em] text-[var(--pl-warn-text)]">
          확인 필요
        </p>
        <p className="mt-1.5 text-[14px] font-medium leading-[1.5] text-[var(--pl-text-strong)]">
          같은 데이터베이스를 여러 번 등록한 요청일 수 있어요
        </p>
        {/* break-keep: 한국어는 단어 사이에서 감아야 한다 (…요청자에|게 확인한). */}
        <p className="mt-2 max-w-[880px] break-keep text-[14px] leading-[1.6] text-[var(--pl-text-medium)]">
          아래 표에서 &lsquo;확인 필요&rsquo;로 표시한 {rowCount}개 항목은 IP 주소가 서로 같거나
          끝자리만 1 차이가 나고, Database Type과 Port까지 같아요. 데이터베이스 한 대를 주소만
          다르게 여러 번 등록하면, 승인 후 같은 데이터를 그만큼 반복해서 검사하게 돼요. 각
          항목에 짝이 되는 주소를 함께 적어 두었으니, 서로 다른 데이터베이스가 맞는지 요청자에게
          확인한 뒤 승인해 주세요.
        </p>
        {onShowInTable && (
          <button
            type="button"
            onClick={onShowInTable}
            className="mt-3 inline-flex items-center rounded-md border border-[var(--pl-warn)] bg-[var(--pl-bg-card)] px-3 py-1.5 text-[12px] font-semibold text-[var(--pl-warn-text)] transition-colors hover:bg-[var(--pl-warn-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pl-warn)]"
          >
            아래 표에서 이 항목만 보기
          </button>
        )}
      </div>
    </div>
  );
}
