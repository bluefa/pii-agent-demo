'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';

import { GuidePlaceholder } from '@/app/integration/admin/guides/components/GuidePlaceholder';
import { GuidePreviewPanel } from '@/app/integration/admin/guides/components/GuidePreviewPanel';
import { ProviderTabs } from '@/app/integration/admin/guides/components/ProviderTabs';
import { StepListPanel } from '@/app/integration/admin/guides/components/StepListPanel';
import { UnsavedChangesModal } from '@/app/integration/admin/guides/components/UnsavedChangesModal';
import type { EditorLanguage } from '@/app/integration/admin/guides/components/EditLanguageTabs';
import { useUnsavedChangesGuard } from '@/app/hooks/useUnsavedChangesGuard';
import {
  bgColors,
  borderColors,
  cn,
  pageChromeStyles,
  textColors,
} from '@/lib/theme';

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
  // Single source of truth for "which language am I working in?".
  // Editor lang tabs and preview lang toggle both bind to this so the
  // preview follows the editor automatically (and vice versa).
  const [activeLang, setActiveLang] = useState<EditorLanguage>('ko');

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
      // Re-clicking the active step must not stage a navigation —
      // otherwise the dirty guard would prompt for a discard the user
      // never asked for.
      if (key === selected) return;
      guard.requestNavigation({ kind: 'select-step', key }, performNavigation);
    },
    [guard, performNavigation, selected],
  );

  const handleSwitchProvider = useCallback(
    (next: ProviderTab) => {
      if (next === provider) return;
      guard.requestNavigation({ kind: 'switch-provider', provider: next }, performNavigation);
    },
    [guard, performNavigation, provider],
  );

  const handleLoad = useCallback((contents: GuideContents) => {
    setDraftKo(contents.ko);
    setDraftEn(contents.en);
  }, []);

  return (
    <div
      className={cn(
        'flex flex-col min-h-[calc(100vh-56px)]',
        bgColors.muted,
        textColors.primary,
      )}
    >
      <nav aria-label="breadcrumb" className={pageChromeStyles.breadcrumb}>
        <span>관리자</span>
        <span className={cn('mx-1.5', textColors.quaternary)} aria-hidden="true">›</span>
        <span>가이드 관리</span>
      </nav>
      <h1 className={pageChromeStyles.title}>프로세스 가이드 관리</h1>
      <p className={pageChromeStyles.subtitle}>
        Cloud Provider 별 7단계 프로세스 가이드 본문을 편집합니다. 저장 시 한국어·영어 둘 다 필수입니다.
      </p>
      <ProviderTabs value={provider} onChange={handleSwitchProvider} />
      <div className="px-6 pb-6 pt-4 flex-1 min-h-0">
        <div
          className={cn(
            'grid grid-cols-[25%_35%_40%] h-full min-h-[640px] rounded-xl border overflow-hidden',
            bgColors.surface,
            borderColors.default,
          )}
        >
          <StepListPanel provider={provider} selectedKey={selected} onSelect={handleSelectStep} />
          {selected ? (
            <GuideEditorPanel
              key={selected}
              slotKey={selected}
              draftKo={draftKo}
              draftEn={draftEn}
              activeLang={activeLang}
              onChangeLang={setActiveLang}
              onChangeKo={setDraftKo}
              onChangeEn={setDraftEn}
              onDirtyChange={guard.setDirty}
              onLoad={handleLoad}
            />
          ) : (
            <GuidePlaceholder subtitle="왼쪽 목록에서 편집할 단계를 선택하면 이곳에 가이드 편집 영역이 표시됩니다.">
              편집할 단계를 선택해주세요
            </GuidePlaceholder>
          )}
          <GuidePreviewPanel
            slotKey={selected}
            draftKo={draftKo}
            draftEn={draftEn}
            activeLang={activeLang}
            onChangeLang={setActiveLang}
          />
        </div>
      </div>
      <UnsavedChangesModal
        isOpen={guard.isModalOpen}
        onConfirm={guard.acceptPendingNavigation}
        onCancel={guard.cancelPendingNavigation}
      />
    </div>
  );
}
