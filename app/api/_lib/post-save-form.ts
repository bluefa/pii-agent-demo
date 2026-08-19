import { BffError } from '@/lib/bff/errors';
import type { PostSaveFile } from '@/lib/types/post';

/**
 * Unwraps a post-save request (multipart/form-data) into the `post` JSON and
 * the `files` parts — docs/bff-api/requests/2026-08-19-faq-notices-be-handoff.md
 * §3.2. Part names and the filename-as-key convention ARE the contract, so a
 * mismatch fails here as a 400 instead of surfacing later as a broken image.
 *
 * Thrown BffErrors are mapped to ProblemDetails by `withV1`, same as the mock's.
 */
export const readPostSaveForm = async <T>(
  request: Request,
): Promise<{ post: T; files: PostSaveFile[] }> => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new BffError(400, 'VALIDATION_FAILED', 'multipart/form-data 본문이 필요합니다');
  }

  const part = form.get('post');
  if (part === null) {
    throw new BffError(400, 'VALIDATION_FAILED', 'post 파트가 필요합니다');
  }
  let post: T;
  try {
    post = JSON.parse(typeof part === 'string' ? part : await part.text()) as T;
  } catch {
    throw new BffError(400, 'VALIDATION_FAILED', 'post 파트가 JSON 이 아닙니다');
  }

  const files: PostSaveFile[] = [];
  for (const filePart of form.getAll('files')) {
    if (typeof filePart === 'string') {
      throw new BffError(400, 'VALIDATION_FAILED', 'files 파트는 파일이어야 합니다');
    }
    files.push({
      key: filePart.name,
      contentType: filePart.type,
      bytes: new Uint8Array(await filePart.arrayBuffer()),
    });
  }

  return { post, files };
};
