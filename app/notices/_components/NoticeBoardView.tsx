'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PassBanner } from '@/app/notices/_components/PassBanner';
import { PostBoardCard } from '@/app/notices/_components/PostBoardCard';
import { PostAccordionRow } from '@/app/notices/_components/PostAccordionRow';
import { listPosts } from '@/app/lib/api/posts';
import { bgColors, cn, postStyles } from '@/lib/theme';
import { parsePostType, type PostSummary, type PostType } from '@/lib/types/post';

/** 카드 한 장이 전체보기로 넘기기 전에 보여 주는 행 수. */
const CARD_ROWS = 5;

/** Category 레일의 "전체" 항목. `null` 은 미분류 게시글을 뜻한다. */
const ALL = '__all__';

export const NoticeBoardView = () => {
  // `?type=` 이 같은 라우트를 2카드 요약 ↔ 한 종류 전체목록으로 바꾼다.
  // 라우트 하나, 데이터 출처 하나 — 전체보기는 별도 페이지가 아니라 이 화면의 한 상태다.
  const focus = parsePostType(useSearchParams().get('type'));

  const [posts, setPosts] = useState<PostSummary[] | null>(null);
  const [category, setCategory] = useState<string>(ALL);

  useEffect(() => {
    let alive = true;
    listPosts()
      .then((loaded) => { if (alive) setPosts(loaded); })
      .catch(() => { if (alive) setPosts([]); });
    return () => { alive = false; };
  }, []);

  // 펼칠 때 404 가 난 행은 목록을 받은 뒤 숨김 처리된 글이다. 열리지 않는 행을
  // 남겨 두는 대신 여기서 뺀다.
  const dropPost = useCallback((postId: number) => {
    setPosts((current) => current?.filter((post) => post.id !== postId) ?? null);
  }, []);

  const byType = (type: PostType) =>
    posts === null ? null : posts.filter((post) => post.type === type);

  const focused = focus ? byType(focus) : null;

  /**
   * Category 레일. 사용자용 `PostCategory` 에는 건수가 없어서(Admin 쪽에만 있다)
   * 받아 온 목록에서 직접 센다 — 계약이 전량을 내려주므로 셀 수 있다.
   */
  const groups = useMemo(() => {
    if (!focused) return [];
    const order: { key: string; label: string; posts: PostSummary[] }[] = [];
    for (const post of focused) {
      const key = post.categoryName ?? '미분류';
      const found = order.find((group) => group.key === key);
      if (found) found.posts.push(post);
      else order.push({ key, label: key, posts: [post] });
    }
    return order;
  }, [focused]);

  // `focused` 가 아니라 `focus` 로 가른다. 목록이 도착하기 전엔 `focused` 가 null 이라
  // 예전에는 2카드 뷰로 떨어졌고, 거기 있는 Pass 배너가 한 프레임 떴다가 사라졌다.
  // 화면이 바뀌는 게 아니라 채워지는 것이므로 골격은 처음부터 같아야 한다.
  if (focus) {
    const loading = focused === null;
    const shown = category === ALL
      ? groups
      : groups.filter((group) => group.key === category);

    /**
     * 보이는 목록의 첫 글은 펼친 채로 시작한다. 계약이 목록에 요약을 주지 않아
     * (tag guide §5) 접힌 목록은 제목만 남는데, 그러면 목록 칸 1630×749 중 글자가
     * 5.4% 만 덮는다(실측). 요약을 새로 만드는 대신 이미 있는 본문을 한 건 편다.
     * 잰 13곳 중 토스페이먼츠는 아예 전 항목의 본문을 목록에 편다.
     */
    const openFirst = shown[0]?.posts[0]?.id;

    return (
      <div className={postStyles.pageFill}>
        <header className={postStyles.pageBand}>
          <h1 className={postStyles.bandTitle}>{focus === 'NOTICE' ? '공지사항' : 'FAQ'}</h1>
          <p className={postStyles.bandSub}>
            Category별로 모아 보여줍니다. 숨김 처리된 게시글은 나오지 않습니다.
          </p>
        </header>

        <div className={postStyles.pageBody}>
          {/* 계약에 페이지네이션이 없어 이 목록은 시간이 갈수록 단조 증가한다.
              레일이 그 길이를 Category 단위로 자르는 유일한 장치다. */}
          <div className={postStyles.grouped}>
            <nav className={postStyles.catNav} aria-label="Category">
              {/* 머리는 목록이 아니라 칸의 것이라, 불러오는 중에도 자리를 지킨다. */}
              <p className={postStyles.catNavHead}>Category</p>
              {/* 선택을 색으로만 말하면 스크린 리더에는 아무 일도 일어나지 않는다
                  (Primer NavList 가 같은 자리에 `aria-current` 를 쓴다). */}
              {loading && [0, 1, 2].map((row) => (
                <div key={row} className={cn(postStyles.catNavItem, 'pointer-events-none')}>
                  <span className={cn('h-3 w-2/3 animate-pulse rounded', bgColors.divider)} />
                </div>
              ))}
              {!loading && (
              <button
                type="button"
                onClick={() => setCategory(ALL)}
                aria-current={category === ALL || undefined}
                className={cn(postStyles.catNavItem, category === ALL && postStyles.catNavItemOn)}
              >
                전체 <span className={postStyles.catNavCount}>{focused.length}</span>
              </button>
              )}
              {!loading && groups.length > 0 && <hr className={postStyles.catNavDivide} />}
              {groups.map((group) => (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => setCategory(group.key)}
                  aria-current={category === group.key || undefined}
                  className={cn(
                    postStyles.catNavItem,
                    category === group.key && postStyles.catNavItemOn,
                  )}
                >
                  {group.label}
                  <span className={postStyles.catNavCount}>{group.posts.length}</span>
                </button>
              ))}
            </nav>
  
            {/* `key` 가 Category 마다 목록을 새로 세운다 — 펼침은 행이 들고 있는
                상태라, 이게 없으면 Category 를 바꿔도 예전에 접힌 채 붙어 있던 행이
                그대로 접혀 있어 "첫 글은 펼쳐져 있다"가 지켜지지 않는다. */}
            <div key={category} className={postStyles.listPane}>
              {loading && [0, 1, 2].map((row) => (
                <div key={row} className={postStyles.row}>
                  <div className={cn('h-4 w-1/3 animate-pulse rounded', bgColors.divider)} />
                </div>
              ))}
              {shown.map((group) => (
                <section key={group.key} className={postStyles.groupSection}>
                  <header className={postStyles.groupHead}>
                    <h2 className={postStyles.groupTitle}>{group.label}</h2>
                    <span className={postStyles.groupCount}>{group.posts.length}건</span>
                  </header>
                  <ul>
                    {group.posts.map((post) => (
                      // 그룹 머리가 Category 를 이미 말했다 — 행에서 한 번 더 말하지 않는다.
                      <PostAccordionRow
                        key={post.id}
                        post={post}
                        onGone={dropPost}
                        showCategory={false}
                        defaultOpen={post.id === openFirst}
                      />
                    ))}
                  </ul>
                </section>
              ))}
              {!loading && shown.length === 0 && (
                <p className="px-[22px] py-10 text-center text-[14px] text-[#6B7280]">
                  등록된 게시글이 없습니다.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={postStyles.page}>
      <PassBanner />
      {/* 공지사항 좌 · FAQ 우. min-w-0 은 카드 쪽에 있어야 긴 제목이 자기 열을 넓혀
          옆 열을 밀지 않는다. */}
      <div className={postStyles.dual}>
        <PostBoardCard
          title="공지사항"
          type="NOTICE"
          posts={byType('NOTICE')}
          limit={CARD_ROWS}
          onGone={dropPost}
        />
        <PostBoardCard
          title="FAQ"
          type="FAQ"
          posts={byType('FAQ')}
          limit={CARD_ROWS}
          onGone={dropPost}
        />
      </div>
    </div>
  );
};
