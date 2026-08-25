import { describe, expect, it } from 'vitest';
import { BANNER_CTA_TITLE, BANNER_LINK_TITLES } from '@/app/notices/_components/PassBanner';
import { postsSeed } from '@/lib/bff/mock/posts-seed';

/**
 * 배너는 게시글을 제목으로 찾는다 — 계약에 slug 가 없어서다. 제목이 한 글자만
 * 어긋나면 링크는 오류 없이 아무 데도 가지 않으므로, 그 짝을 여기서 잡는다.
 */
describe('PassBanner 링크', () => {
  const noticeTitles = postsSeed
    .filter((post) => post.type === 'NOTICE' && !post.hidden)
    .map((post) => post.titles.ko);

  it.each([...BANNER_LINK_TITLES, BANNER_CTA_TITLE])('"%s" 로 갈 공지가 있다', (title) => {
    expect(noticeTitles).toContain(title);
  });
});
