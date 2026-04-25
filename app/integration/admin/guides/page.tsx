'use client';

import { useState } from 'react';
import { ProviderTabs } from '@/app/integration/admin/guides/components/ProviderTabs';
import { StepListPanel } from '@/app/integration/admin/guides/components/StepListPanel';
import { GuidePlaceholder } from '@/app/integration/admin/guides/components/GuidePlaceholder';
import type { GuideSlotKey } from '@/lib/constants/guide-registry';
import type { ProviderTab } from '@/app/integration/admin/guides/types';

export default function GuidesPage() {
  const [provider, setProvider] = useState<ProviderTab>('aws');
  const [selected, setSelected] = useState<GuideSlotKey | null>(null);

  const handleProviderChange = (next: ProviderTab) => {
    setProvider(next);
    setSelected(null);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <ProviderTabs value={provider} onChange={handleProviderChange} />
      <div className="grid grid-cols-[25%_35%_40%] flex-1 overflow-hidden">
        <StepListPanel provider={provider} selectedKey={selected} onSelect={setSelected} />
        <GuidePlaceholder>편집할 단계를 선택해주세요</GuidePlaceholder>
        <GuidePlaceholder>미리보기 영역</GuidePlaceholder>
      </div>
    </div>
  );
}
