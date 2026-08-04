/**
 * Ops console — 서비스 운영 (목록 + 상세).
 *
 * Optional catch-all: 목록(`/ops/services`)과 상세(`/ops/services/{code}`)를 한 컴포넌트가
 * 맡는다 — 상세는 좌측 레일 옆에 붙고, 딥링크는 그대로 살아 있다
 * (서비스·대상 검색 `services/[[...code]]` 와 같은 구조).
 */
import { ServicesView } from '@/app/admin/pipelines/ops/services/_components/ServicesView';

export default function OpsServicesPage() {
  return <ServicesView />;
}
