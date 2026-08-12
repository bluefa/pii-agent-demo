import { cn, passBannerStyles } from '@/lib/theme';

/**
 * Pass 소개 배너 (`design/notice-faq/notice-faq-screens.html` ①).
 *
 * 계약에 API가 없다 — FAQ & Notices Tag §5 "범위 밖"에서 고정 콘텐츠로 두기로 했다.
 * Admin 편집이 필요해지면 `Admin Guides` Tag(name-keyed content store) 재사용을
 * 먼저 검토한다. 그 전까지 문구는 이 파일이 원본이다.
 */
export const PassBanner = () => (
  <section className={passBannerStyles.root}>
    <span className={passBannerStyles.dots} aria-hidden />
    <span className={passBannerStyles.glow} aria-hidden />
    <span className={passBannerStyles.glowSoft} aria-hidden />
    <div className={passBannerStyles.content}>
      <p className={passBannerStyles.eyebrow}>Introducing Pass</p>
      <p className={passBannerStyles.title}>연동부터 스캔까지, 한 화면에서</p>
      <p className={passBannerStyles.body}>
        클라우드 인프라를 등록하면 Pass가 권한 점검 · Test Connection · PII 스캔까지
        이어서 처리합니다. 담당자가 챙길 일은 승인 하나뿐입니다.
      </p>
    </div>
    <span className={cn(passBannerStyles.cta)}>Pass 알아보기 →</span>
  </section>
);
