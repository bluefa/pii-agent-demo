/**
 * English count nouns only.
 *
 * Korean has no grammatical plural, so a Korean sentence that interpolates a count never
 * had to agree with it — 「계정 1개」 and 「계정 2개」 use the same noun. Every English string
 * in this repo was translated from such a sentence, which is why so many of them hard-coded
 * the plural form and read "1 accounts" at n = 1. English needs the branch the Korean
 * original never needed, and this is that branch.
 *
 * It takes whole words rather than a suffix so it can also carry the verb or pronoun that
 * has to agree alongside the noun ("1 owner is" / "2 owners are").
 */
export const plural = (count: number, one: string, many: string): string =>
  count === 1 ? one : many;
