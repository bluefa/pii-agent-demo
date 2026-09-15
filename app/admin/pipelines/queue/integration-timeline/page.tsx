/**
 * P6 연동 시점 (/admin/pipelines/queue/integration-timeline) — server shell.
 *
 * Every read on this screen is driven by a control the operator moves, so the whole page
 * is the client view; the shell exists only to route to it.
 */
import type { ReactElement } from 'react';

import { IntegrationTimelineView } from '@/app/admin/pipelines/queue/integration-timeline/_components/IntegrationTimelineView';

export default function IntegrationTimelinePage(): ReactElement {
  return <IntegrationTimelineView />;
}
