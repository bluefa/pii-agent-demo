'use client';

/**
 * Ops console — Target Source 운영 entry. Minimal ID jump box for now; a full
 * searchable list is deferred (design/pipeline/ops-target-source-app-plan.md §7).
 */
import { useState, type ReactElement, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { cn, pipelineStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';

export default function OpsTargetSourcesPage(): ReactElement {
  const router = useRouter();
  const [id, setId] = useState('');
  const valid = /^\d+$/.test(id.trim());

  const go = (event: FormEvent): void => {
    event.preventDefault();
    if (valid) router.push(passRoutes.pipelines.ops.targetSource(id.trim()));
  };

  return (
    <div>
      <h1 className={cn(pipelineStyles.text.pageTitle, 'mb-3')}>Target Source 운영</h1>
      <p className={cn(pipelineStyles.text.sectionDesc, 'mb-6')}>
        Target Source ID로 운영 상세 화면으로 이동합니다.
      </p>
      <form onSubmit={go} className="flex items-center gap-2">
        <label htmlFor="ops-ts-id" className={pipelineStyles.text.subsectionTitle}>
          Target Source ID
        </label>
        <input
          id="ops-ts-id"
          value={id}
          onChange={(event) => setId(event.target.value)}
          placeholder="예: 1003"
          inputMode="numeric"
          className={cn(pipelineStyles.input, 'w-40')}
        />
        <PlButton type="submit" variant="primary" disabled={!valid}>
          이동
        </PlButton>
      </form>
    </div>
  );
}
