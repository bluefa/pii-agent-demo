'use client';

/** 협업 채널 관리 modal — Jira issue key + URL (assumed contract §4). */
import { useEffect, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { saveCollaborationChannel, type CollaborationChannel } from '@/app/lib/api/ops';

const TITLE_ID = 'ops-channel-title';

export interface ChannelModalProps {
  open: boolean;
  onClose: () => void;
  targetSourceId: number;
  channel: CollaborationChannel | null;
  onSaved: (channel: CollaborationChannel) => void;
}

export function ChannelModal({
  open,
  onClose,
  targetSourceId,
  channel,
  onSaved,
}: ChannelModalProps): ReactElement | null {
  const [issueKey, setIssueKey] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setIssueKey(channel?.issue_key ?? '');
      setUrl(channel?.url ?? '');
      setError(null);
    }
  }, [open, channel]);

  const save = async (): Promise<void> => {
    const key = issueKey.trim();
    const link = url.trim();
    if (!key || !/^https?:\/\//.test(link)) {
      setError('이슈 키와 http(s)로 시작하는 URL을 입력해 주세요.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onSaved(await saveCollaborationChannel(targetSourceId, { issue_key: key, url: link }));
      onClose();
    } catch {
      setError('저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} labelledBy={TITLE_ID}>
      <h3 id={TITLE_ID} className={pipelineStyles.modal.title}>협업 채널 관리</h3>
      <p className={pipelineStyles.modal.desc}>이 Target Source의 협업 이슈 링크를 관리합니다.</p>

      <label htmlFor="ops-channel-key" className={cn(pipelineStyles.text.subsectionTitle, 'block')}>
        이슈 키
      </label>
      <input
        id="ops-channel-key"
        value={issueKey}
        onChange={(event) => setIssueKey(event.target.value)}
        placeholder="INFRA-2211"
        autoComplete="off"
        className={cn(pipelineStyles.input, 'mt-2 w-full')}
      />
      <label htmlFor="ops-channel-url" className={cn(pipelineStyles.text.subsectionTitle, 'mt-3 block')}>
        URL
      </label>
      <input
        id="ops-channel-url"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://jira.example.com/browse/INFRA-2211"
        autoComplete="off"
        className={cn(pipelineStyles.input, 'mt-2 w-full')}
      />
      {error && (
        <p role="alert" className="mt-2 text-[12px] font-medium text-[var(--pl-err-text)]">
          {error}
        </p>
      )}

      <div className={pipelineStyles.modal.foot}>
        <PlButton variant="secondary" onClick={onClose} disabled={saving}>
          취소
        </PlButton>
        <PlButton variant="primary" onClick={() => void save()} disabled={saving}>
          {saving ? '저장 중…' : '저장'}
        </PlButton>
      </div>
    </ModalShell>
  );
}
