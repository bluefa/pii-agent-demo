'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';

import { GuidePlaceholder } from '@/app/integration/admin/guides/components/GuidePlaceholder';
import { ProviderTabs } from '@/app/integration/admin/guides/components/ProviderTabs';
import { StepListPanel } from '@/app/integration/admin/guides/components/StepListPanel';
import { UnsavedChangesModal } from '@/app/integration/admin/guides/components/UnsavedChangesModal';
import { useUnsavedChangesGuard } from '@/app/hooks/useUnsavedChangesGuard';
import { borderColors, cn } from '@/lib/theme';

import type { GuideSlotKey } from '@/lib/constants/guide-registry';
import type { GuideContents } from '@/lib/types/guide';
import type { ProviderTab } from '@/app/integration/admin/guides/types';

// `GuideEditorPanel` pulls in Tiptap (~tens of KB). Mount it lazily so
// the admin shell renders before the editor bundle is fetched, and keep
// the bundle out of any code path that does not select a step.
const GuideEditorPanel = dynamic(
  () =>
    import('@/app/integration/admin/guides/components/GuideEditorPanel').then((m) => ({
      default: m.GuideEditorPanel,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden="true"
        className={cn('h-full border-l animate-pulse', borderColors.default)}
      />
    ),
  },
);

type PendingNav =
  | { kind: 'select-step'; key: GuideSlotKey }
  | { kind: 'switch-provider'; provider: ProviderTab };

export default function GuidesPage() {
  const [provider, setProvider] = useState<ProviderTab>('aws');
  const [selected, setSelected] = useState<GuideSlotKey | null>(null);
  const [draftKo, setDraftKo] = useState('');
  const [draftEn, setDraftEn] = useState('');

  const guard = useUnsavedChangesGuard<PendingNav>();

  const performNavigation = useCallback((target: PendingNav) => {
    if (target.kind === 'select-step') {
      setSelected(target.key);
    } else {
      setProvider(target.provider);
      setSelected(null);
    }
    // Drafts will be re-seeded from the editor's onLoad once the new
    // GET resolves. Reset eagerly so the placeholder render does not
    // briefly flash stale content.
    setDraftKo('');
    setDraftEn('');
  }, []);

  const handleSelectStep = useCallback(
    (key: GuideSlotKey) => {
      guard.requestNavigation({ kind: 'select-step', key }, performNavigation);
    },
    [guard, performNavigation],
  );

  const handleSwitchProvider = useCallback(
    (next: ProviderTab) => {
      guard.requestNavigation({ kind: 'switch-provider', provider: next }, performNavigation);
    },
    [guard, performNavigation],
  );

  const handleLoad = useCallback((contents: GuideContents) => {
    setDraftKo(contents.ko);
    setDraftEn(contents.en);
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <ProviderTabs value={provider} onChange={handleSwitchProvider} />
      <div className="grid grid-cols-[25%_35%_40%] flex-1 overflow-hidden">
        <StepListPanel provider={provider} selectedKey={selected} onSelect={handleSelectStep} />
        {selected ? (
          <GuideEditorPanel
            key={selected}
            slotKey={selected}
            draftKo={draftKo}
            draftEn={draftEn}
            onChangeKo={setDraftKo}
            onChangeEn={setDraftEn}
            onDirtyChange={guard.setDirty}
            onLoad={handleLoad}
          />
        ) : (
          <GuidePlaceholder>편집할 단계를 선택해주세요</GuidePlaceholder>
        )}
        <GuidePlaceholder>미리보기 영역</GuidePlaceholder>
      </div>
      <UnsavedChangesModal
        isOpen={guard.isModalOpen}
        onConfirm={guard.acceptPendingNavigation}
        onCancel={guard.cancelPendingNavigation}
      />
    </div>
  );
}
