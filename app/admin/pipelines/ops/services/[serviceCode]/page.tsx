/** Ops console — 서비스 운영 상세 (Jira tickets · EOS · target sources). */
import { ServiceDetailView } from '@/app/admin/pipelines/ops/services/_components/ServiceDetailView';

export default async function OpsServiceDetailPage({
  params,
}: {
  params: Promise<{ serviceCode: string }>;
}) {
  const { serviceCode } = await params;
  return <ServiceDetailView serviceCode={decodeURIComponent(serviceCode)} />;
}
