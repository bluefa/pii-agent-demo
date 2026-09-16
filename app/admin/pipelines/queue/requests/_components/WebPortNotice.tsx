/**
 * WebPortNotice — P3 상단, "웹 서버를 등록한 요청일 수 있어요".
 *
 * DuplicateAddressNotice 와 같은 문법(3px 좌측 룰, 12px 라벨 → 14px 문장). 승인을 막는
 * 판정이 아니라 확인해 보라는 요청이다: DB 가 그 포트를 쓰는 일도 있으므로 행은 그대로
 * 승인할 수 있다. 어느 행인지는 표가 'Port 확인' 배지와 주황 포트로 말한다.
 */
import type { ReactElement } from 'react';
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';
import { IDC_WEB_PORTS } from '@/lib/constants/idc';
import { isWebPort } from '@/app/admin/pipelines/queue/requests/_components/idcCells';

const PORT_LIST = [...IDC_WEB_PORTS].join('·');

export function WebPortNotice({ rows }: { rows: readonly RequestResourceRow[] }): ReactElement | null {
  const count = rows.filter((row) => isWebPort(row.port)).length;
  if (count === 0) return null;
  return (
    <div className="mb-6" role="status">
      <div className="border-l-[3px] border-[var(--pl-warn)] pl-4">
        <p className="text-[12px] font-bold tracking-[0.02em] text-[var(--pl-warn-text)]">확인 필요</p>
        <p className="mt-1.5 text-[14px] font-medium leading-[1.5] text-[var(--pl-text-strong)]">
          웹 서버를 연동 대상으로 등록한 요청일 수 있어요
        </p>
        <p className="mt-2 max-w-[880px] break-keep text-[14px] leading-[1.6] text-[var(--pl-text-medium)]">
          아래 표에서 &lsquo;Port 확인&rsquo;으로 표시한 {count}개 항목은 Port 가 {PORT_LIST} 중
          하나예요. 이 포트는 웹 서버가 주로 쓰는 포트라, 데이터베이스가 아니라 웹 서버 주소를
          적었을 수 있어요. 연동 대상이 데이터베이스가 맞는지 요청자에게 확인한 뒤 승인해 주세요.
        </p>
      </div>
    </div>
  );
}
