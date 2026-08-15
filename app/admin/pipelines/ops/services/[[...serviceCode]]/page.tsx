/**
 * Ops console — 서비스 운영 우측 패널.
 *
 * Optional catch-all: 목록(`/ops/services`)은 안내 시트를, 상세(`/ops/services/{code}`)는
 * 운영 상세를 이 자리에 세운다. 좌측 레일은 여기가 아니라 layout.tsx 에 있다 — 세그먼트가
 * 바뀌면 page 는 다시 마운트되지만 레이아웃은 보존되므로, 서비스를 골라도 레일은 그대로
 * 서 있고 우측만 갈린다 (이유는 layout.tsx 주석).
 */
import { cn } from '@/lib/theme';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { serviceListStyles as s } from '@/app/admin/pipelines/_services/styles';
import { ServiceDetailView } from '@/app/admin/pipelines/ops/services/_components/ServiceDetailView';

export default async function OpsServicesPage({
  params,
}: {
  params: Promise<{ serviceCode?: string[] }>;
}) {
  const { serviceCode } = await params;
  const selectedCode = serviceCode?.[0] ?? null;

  if (!selectedCode) {
    // 선택 전에도 같은 시트가 서 있어야 화면의 틀이 흔들리지 않는다. 다음 행동
    // ("서비스를 고르세요")만 primary 로 키워 시선이 좌측 레일로 가게 한다.
    return (
      <div className={cn(s.sheet, 'items-center justify-center')}>
        <PlEmptyState
          icon="cursor"
          message={
            <span className="text-[20px] font-bold text-[var(--pl-primary)]">
              좌측에서 서비스를 선택해 주세요.
            </span>
          }
          meta={<span className="text-[16px]">서비스 현황을 상세 확인합니다.</span>}
        />
      </div>
    );
  }

  // key 로 갈아끼워 이전 서비스 데이터가 남지 않게 한다.
  return <ServiceDetailView key={selectedCode} serviceCode={selectedCode} />;
}
