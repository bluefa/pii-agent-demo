'use client';

/**
 * P3 연동 요청 상세 (/admin/pipelines/queue/requests/[targetSourceId]) — design-spec §3.
 *
 * 화면은 `RequestDetail` 이 다 그린다 — 목록 화면(queue/requests)의 워크벤치 시트와 같은
 * 것이다. 관리자는 이제 목록에서 고르고 그 자리에서 결정하므로 이 라우트는 알림·딥링크가
 * 오는 자리로 남는다. 여기가 더 하는 일은 빵부스러기와, 결정 후 목록으로 돌아가는 것뿐.
 *
 * 마지막 빵부스러기는 #id 다. 서비스 이름은 바로 아래 24px 제목이 말하고, 이 페이지는
 * 이제 헤더를 스스로 읽지 않는다 — 이름을 다시 쓰려고 같은 요청을 한 번 더 부를 이유가
 * 없다.
 */
import type { ReactElement } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { passRoutes } from '@/lib/routes';

import { PlBreadcrumb } from '@/app/admin/pipelines/_components/PlBreadcrumb';
import { RequestDetail } from '@/app/admin/pipelines/queue/requests/_components/RequestDetail';

export default function RequestDetailPage(): ReactElement {
  const router = useRouter();
  const params = useParams<{ targetSourceId: string }>();
  const targetSourceId = Number(params.targetSourceId);

  return (
    <div>
      <PlBreadcrumb
        crumbs={[
          { label: 'Task Queue', href: passRoutes.pipelines.queue.dashboard },
          { label: '연동 요청', href: passRoutes.pipelines.queue.requests },
          { label: `#${targetSourceId}` },
        ]}
      />
      <RequestDetail
        targetSourceId={targetSourceId}
        onDecided={() => router.push(passRoutes.pipelines.queue.requests)}
      />
    </div>
  );
}
