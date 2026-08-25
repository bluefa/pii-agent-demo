'use client';

import { passBannerStyles } from '@/lib/theme';

/**
 * 배너가 가리키는 공지 게시글들. 계약에 게시글을 지목할 키가 없어서(FAQ & Notices
 * Tag: id 는 생성 순번이고 안정된 slug 가 없다) 제목으로 찾는다 — Admin 이 제목을
 * 바꾸면 링크는 아무 데도 가지 않는다. 그때 고칠 자리는 이 상수다.
 */
export const BANNER_LINK_TITLES = [
  'PII 모니터링 모듈(PII Agent/SDU) 소개',
  'PII Agent 지원 환경 소개',
  'PII Agent 연동 절차 안내',
  'SDU 연동 절차 안내',
] as const;

/** CTA 가 여는 글. */
export const BANNER_CTA_TITLE = 'PASS 서비스 소개 안내';

interface PassBannerProps {
  /** 아래 목록에서 그 제목의 글로 스크롤하고 아코디언을 편다. */
  onOpenPost: (title: string) => void;
}

/**
 * PASS 온보딩 히어로 배너 — 공지사항 화면 맨 위.
 *
 * 계약에 API가 없다 — FAQ & Notices Tag §5 "범위 밖"에서 고정 콘텐츠로 두기로 했다.
 * Admin 편집이 필요해지면 `Admin Guides` Tag(name-keyed content store) 재사용을
 * 먼저 검토한다. 그 전까지 문구는 이 파일이 원본이다.
 */
export const PassBanner = ({ onOpenPost }: PassBannerProps) => (
  <section className={passBannerStyles.root}>
    <span className={passBannerStyles.dots} aria-hidden />
    <span className={passBannerStyles.glow} aria-hidden />
    <span className={passBannerStyles.blobs} aria-hidden>
      <span className={passBannerStyles.blobA} />
      <span className={passBannerStyles.blobB} />
      <span className={passBannerStyles.blobC} />
    </span>

    <div className={passBannerStyles.content}>
      <p className={passBannerStyles.kicker}>ONBOARDING</p>
      <p className={passBannerStyles.title}>PASS에 오신 것을 환영합니다! 👋</p>
      <p className={passBannerStyles.body}>
        PASS는 담당 시스템의 PII 모니터링 모듈 연동 및 상태 조회를 제공하는 서비스입니다.
      </p>
      <nav className={passBannerStyles.links} aria-label="온보딩 안내 문서">
        {BANNER_LINK_TITLES.map((title) => (
          <button
            key={title}
            type="button"
            onClick={() => onOpenPost(title)}
            className={passBannerStyles.link}
          >
            {title}
          </button>
        ))}
      </nav>
    </div>

    <button
      type="button"
      onClick={() => onOpenPost(BANNER_CTA_TITLE)}
      className={passBannerStyles.cta}
    >
      PASS 소개 ›
    </button>
  </section>
);
