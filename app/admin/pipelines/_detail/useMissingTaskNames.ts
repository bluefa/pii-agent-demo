import { useEffect, useState } from 'react';
import { getTaskDetail } from '@/app/lib/api/pipeline';
import type { TaskSummary } from '@/lib/pipeline/types';

/**
 * display_name for the task definitions the catalog (#12) does not list. The
 * catalog is the only bulk source of names; a definition it leaves out (the AWS
 * China install HTTP tasks) otherwise renders as its wire name until someone
 * opens the task, and then flips to Korean. So: one task detail (#5) per missing
 * definition. A definition's name never changes, so the poll never evicts these.
 *
 * `catalog` null = not settled yet — nothing is fetched until it is.
 */
export function useMissingTaskNames(
  pipelineId: number | null | undefined,
  tasks: readonly TaskSummary[] | undefined,
  catalog: ReadonlyMap<string, unknown> | null,
): ReadonlyMap<string, string> {
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  // `definition:taskId` per missing definition — a string, so a poll that returns
  // the same tasks does not refire the effect.
  const missingKey =
    catalog && tasks
      ? [...new Map(tasks.filter((t) => !catalog.has(t.task_definition)).map((t) => [t.task_definition, t.task_id]))]
          .map(([definition, taskId]) => `${definition}:${taskId}`)
          .join(',')
      : '';

  useEffect(() => {
    if (pipelineId == null || !missingKey) return;
    let cancelled = false;
    for (const pair of missingKey.split(',')) {
      const [definition, taskId] = pair.split(':');
      getTaskDetail(pipelineId, taskId)
        .then((d) => {
          const name = d.definition?.display_name;
          if (!cancelled && name) setNames((prev) => new Map(prev).set(definition, name));
        })
        .catch(() => {
          /* the wire name stays */
        });
    }
    return () => {
      cancelled = true;
    };
  }, [pipelineId, missingKey]);

  return names;
}
