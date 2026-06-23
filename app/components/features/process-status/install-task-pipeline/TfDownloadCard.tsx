'use client';

import { buttonStyles, cn, getButtonClass } from '@/lib/theme';

interface TfDownloadCardProps {
  sizeLabel: string;
  onGuide: () => void;
  onDownload: () => void;
  downloading?: boolean;
}

/**
 * File-download glyph (22×22). v15 markup line 6507 — arrow descending into a
 * document tray; stroke currentColor inherits the #0064FF icon-box color.
 */
const FileDownloadIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="12" y1="18" x2="12" y2="12" />
    <polyline points="9 15 12 18 15 15" />
  </svg>
);

/**
 * v15 `.btn.outline` — no matching `buttonStyles` variant (closest `secondary`
 * is gray-100). Literal v15 tokens: #F7F8FA fill / #191F28 text / hover #ECEEF1,
 * layered on the shared `.btn` geometry (h40 / rounded-12 / 700 / 14px).
 */
const OUTLINE_BTN_CLASS = cn(
  buttonStyles.base,
  'inline-flex items-center gap-1.5 bg-[#F7F8FA] text-[#191F28] border-0 hover:bg-[#ECEEF1]',
);

/**
 * Terraform script download card. v15 `.tf-download-card`
 * (design/v15-extract/06-install.md §7, markup 6505–6526). Presentational only —
 * the caller owns the guide/download intents and the `downloading` flag.
 */
export const TfDownloadCard = ({
  sizeLabel,
  onGuide,
  onDownload,
  downloading = false,
}: TfDownloadCardProps) => (
  <div className="flex items-center gap-4 px-[22px] py-[18px] rounded-xl mb-4 bg-[linear-gradient(135deg,#F0F6FF_0%,#F7FAFF_100%)] shadow-[inset_0_0_0_1.5px_rgba(0,100,255,0.12)]">
    <div className="w-12 h-12 flex-shrink-0 rounded-xl bg-white grid place-items-center text-[#0064FF] shadow-[0_1px_2px_rgba(17,24,39,0.05)]">
      <FileDownloadIcon />
    </div>

    <div className="flex-1 min-w-0 flex flex-col gap-1">
      <div className="text-[15px] font-bold tracking-[-0.02em] text-[#191F28] flex items-center gap-2">
        Terraform Script 다운로드
        <span className="text-[10.5px] font-bold px-2 py-[3px] rounded-full bg-[rgba(0,100,255,0.10)] text-[#0064FF] tracking-[0.02em] font-mono">
          .tf · {sizeLabel}
        </span>
      </div>
      <div className="text-[12.5px] text-[#4E5968] leading-[1.5]">
        수동 설치를 위해 서비스 / BDC 양측에 적용할 Terraform script를 내려받아 직접
        실행해 주세요. 실행 결과는 아래 단계에 자동으로 반영됩니다.
      </div>
    </div>

    <div className="flex gap-2 flex-shrink-0">
      <button type="button" onClick={onGuide} className={OUTLINE_BTN_CLASS}>
        가이드 보기
      </button>
      <button
        type="button"
        onClick={onDownload}
        disabled={downloading}
        className={getButtonClass('primary')}
      >
        {downloading ? '다운로드 중...' : 'Script 다운로드'}
      </button>
    </div>
  </div>
);
