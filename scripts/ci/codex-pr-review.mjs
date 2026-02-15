#!/usr/bin/env node

import { appendFile } from 'node:fs/promises';
import process from 'node:process';

const REQUIRED_ENV = ['GITHUB_TOKEN', 'OPENAI_API_KEY', 'GITHUB_REPOSITORY', 'PR_NUMBER'];
const missingEnv = REQUIRED_ENV.filter((name) => !process.env[name]);

if (missingEnv.length > 0) {
  console.error(`[codex-review] Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(2);
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const REPOSITORY = process.env.GITHUB_REPOSITORY;
const PR_NUMBER = Number(process.env.PR_NUMBER);
const MODEL = process.env.CODEX_MODEL ?? 'gpt-5.3-codex';
const MAX_DIFF_CHARS = Number(process.env.MAX_DIFF_CHARS ?? '140000');
const COMMENT_MARKER = '<!-- codex-pr-review -->';

if (!Number.isInteger(PR_NUMBER) || PR_NUMBER <= 0) {
  console.error(`[codex-review] Invalid PR_NUMBER: ${process.env.PR_NUMBER}`);
  process.exit(2);
}

const [owner, repo] = REPOSITORY.split('/');
if (!owner || !repo) {
  console.error(`[codex-review] Invalid GITHUB_REPOSITORY: ${REPOSITORY}`);
  process.exit(2);
}

const githubRequest = async (path, options = {}) => {
  const response = await fetch(`https://api.github.com${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'codex-pr-review-script',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = payload?.message ?? text ?? 'Unknown GitHub API error';
    throw new Error(`GitHub API ${options.method ?? 'GET'} ${path} failed: ${response.status} ${message}`);
  }

  return payload;
};

const openaiRequest = async (systemPrompt, userPrompt) => {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      reasoning: { effort: 'high' },
      max_output_tokens: 3500,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: systemPrompt }],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: userPrompt }],
        },
      ],
    }),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const errorText = payload?.error?.message ?? text ?? 'Unknown OpenAI API error';
    throw new Error(`OpenAI responses API failed: ${response.status} ${errorText}`);
  }

  return payload;
};

const extractOutputText = (response) => {
  if (typeof response?.output_text === 'string' && response.output_text.trim().length > 0) {
    return response.output_text.trim();
  }

  if (!Array.isArray(response?.output)) {
    return '';
  }

  const chunks = [];
  for (const item of response.output) {
    if (!Array.isArray(item?.content)) {
      continue;
    }

    for (const content of item.content) {
      if (typeof content?.text === 'string') {
        chunks.push(content.text);
      }
    }
  }

  return chunks.join('\n').trim();
};

const parseReviewJson = (rawText) => {
  const trimmed = rawText.trim();
  const candidates = [trimmed];
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Keep trying the next candidate.
    }
  }

  throw new Error('Model output is not valid JSON.');
};

const toStringSafe = (value, fallback = '') => {
  return typeof value === 'string' ? value.trim() : fallback;
};

const toNumberSafe = (value, fallback = null) => {
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const normalizeFinding = (finding, index) => {
  const id = toStringSafe(finding?.id, `FINDING-${index + 1}`);
  const severityRaw = toStringSafe(finding?.severity, 'medium').toLowerCase();
  const severity = ['high', 'medium', 'low'].includes(severityRaw) ? severityRaw : 'medium';

  return {
    id,
    severity,
    file: toStringSafe(finding?.file, 'unknown'),
    line: toNumberSafe(finding?.line),
    issue: toStringSafe(finding?.issue, 'Issue detail missing'),
    suggestion: toStringSafe(finding?.suggestion, 'Suggestion missing'),
  };
};

const normalizeReview = (review) => {
  const blockingInput = Array.isArray(review?.blocking) ? review.blocking : [];
  const nonBlockingInput = Array.isArray(review?.non_blocking) ? review.non_blocking : [];

  return {
    summary: toStringSafe(review?.summary, 'Summary missing'),
    blocking: blockingInput.map((finding, index) => normalizeFinding(finding, index)),
    nonBlocking: nonBlockingInput.map((finding, index) => normalizeFinding(finding, index)),
  };
};

const listPrFiles = async () => {
  const files = [];
  let page = 1;

  while (true) {
    const pageFiles = await githubRequest(`/repos/${owner}/${repo}/pulls/${PR_NUMBER}/files?per_page=100&page=${page}`);
    if (!Array.isArray(pageFiles) || pageFiles.length === 0) {
      break;
    }

    files.push(...pageFiles);
    page += 1;
  }

  return files;
};

const getAgentsRules = async (ref) => {
  const payload = await githubRequest(`/repos/${owner}/${repo}/contents/AGENTS.md?ref=${encodeURIComponent(ref)}`);

  if (typeof payload?.content !== 'string') {
    return 'AGENTS.md content could not be loaded.';
  }

  const decoded = Buffer.from(payload.content, 'base64').toString('utf8');
  return decoded.slice(0, 14000);
};

const formatFinding = (finding, index) => {
  const location = finding.line ? `${finding.file}:${finding.line}` : finding.file;
  return [
    `${index + 1}. [${finding.severity.toUpperCase()}] \`${location}\``,
    `   - 이슈: ${finding.issue}`,
    `   - 제안: ${finding.suggestion}`,
  ].join('\n');
};

const buildReviewComment = ({ headSha, review, reviewedFileCount, truncated }) => {
  const blockingSection =
    review.blocking.length === 0
      ? '- 없음'
      : review.blocking.map((finding, index) => formatFinding(finding, index)).join('\n');

  const nonBlockingSection =
    review.nonBlocking.length === 0
      ? '- 없음'
      : review.nonBlocking.map((finding, index) => formatFinding(finding, index)).join('\n');

  const truncatedLine = truncated
    ? `- 참고: diff 입력이 ${MAX_DIFF_CHARS}자 제한으로 일부 생략되었습니다.`
    : '- 참고: diff 전체 범위가 입력되었습니다.';

  return [
    COMMENT_MARKER,
    '## Codex PR Review',
    '',
    `- 모델: \`${MODEL}\``,
    `- Head SHA: \`${headSha}\``,
    `- 검토 파일 수: ${reviewedFileCount}`,
    truncatedLine,
    '',
    '### 요약',
    review.summary,
    '',
    `### Blocking Findings (${review.blocking.length})`,
    blockingSection,
    '',
    `### Non-blocking Suggestions (${review.nonBlocking.length})`,
    nonBlockingSection,
    '',
    '> 이 코멘트는 최신 커밋 기준으로 자동 갱신됩니다.',
  ].join('\n');
};

const upsertReviewComment = async (body) => {
  const comments = await githubRequest(`/repos/${owner}/${repo}/issues/${PR_NUMBER}/comments?per_page=100`);
  const existing = Array.isArray(comments)
    ? comments.find(
        (comment) => comment?.user?.login === 'github-actions[bot]' && typeof comment?.body === 'string' && comment.body.includes(COMMENT_MARKER),
      )
    : null;

  if (existing?.id) {
    await githubRequest(`/repos/${owner}/${repo}/issues/comments/${existing.id}`, {
      method: 'PATCH',
      body: { body },
    });
    return;
  }

  await githubRequest(`/repos/${owner}/${repo}/issues/${PR_NUMBER}/comments`, {
    method: 'POST',
    body: { body },
  });
};

const writeStepSummary = async (review, reviewedFileCount) => {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) {
    return;
  }

  const lines = [
    '## Codex PR Review Summary',
    '',
    `- Blocking findings: ${review.blocking.length}`,
    `- Non-blocking suggestions: ${review.nonBlocking.length}`,
    `- Reviewed files: ${reviewedFileCount}`,
    '',
    review.summary,
    '',
  ];

  await appendFile(summaryPath, `${lines.join('\n')}\n`, 'utf8');
};

const run = async () => {
  console.log(`[codex-review] Reviewing PR #${PR_NUMBER} in ${REPOSITORY}`);

  const pr = await githubRequest(`/repos/${owner}/${repo}/pulls/${PR_NUMBER}`);
  const files = await listPrFiles();
  const agentsRules = await getAgentsRules(pr.base.ref);

  const fileSummaries = files.map((file) => ({
    filename: file.filename,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes,
    patch: typeof file.patch === 'string' ? file.patch : '',
  }));

  const patchSections = [];
  let usedChars = 0;
  let truncated = false;

  for (const file of fileSummaries) {
    if (!file.patch) {
      continue;
    }

    const section = `FILE: ${file.filename}\nSTATUS: ${file.status}\nPATCH:\n${file.patch}\n`;
    if (usedChars + section.length > MAX_DIFF_CHARS) {
      truncated = true;
      break;
    }

    patchSections.push(section);
    usedChars += section.length;
  }

  if (patchSections.length === 0) {
    patchSections.push('Patch data is unavailable for this PR. Perform risk-focused review from file metadata.');
  }

  const systemPrompt = [
    'You are a strict senior code reviewer.',
    'Focus on correctness, regressions, security, and missing tests.',
    'Return JSON only.',
  ].join(' ');

  const userPrompt = [
    'Repository review rules (AGENTS.md excerpt):',
    agentsRules,
    '',
    'PR metadata:',
    `- Title: ${pr.title}`,
    `- Number: ${pr.number}`,
    `- Base: ${pr.base.ref}`,
    `- Head: ${pr.head.ref}`,
    '',
    'Changed files:',
    fileSummaries
      .map((file) => `- ${file.filename} (${file.status}, +${file.additions}/-${file.deletions}, ${file.changes} changes)`)
      .join('\n'),
    '',
    'Diff:',
    patchSections.join('\n\n'),
    '',
    'Return STRICT JSON with this shape:',
    '{',
    '  "summary": "string",',
    '  "blocking": [',
    '    {"id":"B1","severity":"high|medium|low","file":"path","line":123,"issue":"...","suggestion":"..."}',
    '  ],',
    '  "non_blocking": [',
    '    {"id":"N1","severity":"high|medium|low","file":"path","line":123,"issue":"...","suggestion":"..."}',
    '  ]',
    '}',
    'Do not include markdown fences.',
  ].join('\n');

  const openaiRaw = await openaiRequest(systemPrompt, userPrompt);
  const rawText = extractOutputText(openaiRaw);

  if (!rawText) {
    throw new Error('Model returned empty output.');
  }

  const parsed = parseReviewJson(rawText);
  const review = normalizeReview(parsed);
  const commentBody = buildReviewComment({
    headSha: pr.head.sha,
    review,
    reviewedFileCount: files.length,
    truncated,
  });

  await upsertReviewComment(commentBody);
  await writeStepSummary(review, files.length);

  console.log(`[codex-review] Blocking findings: ${review.blocking.length}`);
  if (review.blocking.length > 0) {
    process.exit(1);
  }
};

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[codex-review] ${message}`);
  process.exit(2);
});
