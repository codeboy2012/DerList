import { isAbsolute, relative, resolve, sep } from 'path';

export type ResolvedUploadPath =
  | { ok: true; absolutePath: string; relativePath: string }
  | { ok: false; reason: 'invalid' | 'outside' };

/**
 * Resolve a request path inside the upload directory safely.
 *
 * Uses `path.relative` rather than string prefixing so it behaves correctly on
 * both POSIX (`/`) and Windows (`\`) filesystems — the previous
 * `startsWith(dir + '/')` check rejected every Windows path.
 *
 * Rejects empty segments, `.`/`..`, NUL bytes, absolute segments, and anything
 * whose resolved location escapes the upload root.
 */
export function resolveUploadPath(uploadDir: string, segments: string[]): ResolvedUploadPath {
  if (!Array.isArray(segments) || segments.length === 0) {
    return { ok: false, reason: 'invalid' };
  }

  for (const segment of segments) {
    if (
      !segment ||
      segment === '.' ||
      segment === '..' ||
      segment.includes('..') ||
      segment.includes('\0') ||
      isAbsolute(segment) ||
      /^[a-zA-Z]:/.test(segment)
    ) {
      return { ok: false, reason: 'invalid' };
    }
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(segments.join('/'));
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  // Decoding can reintroduce traversal sequences (`%2e%2e`), so re-check.
  if (
    decoded.includes('\0') ||
    decoded.includes('..') ||
    decoded.startsWith('/') ||
    decoded.startsWith('\\')
  ) {
    return { ok: false, reason: 'invalid' };
  }

  const root = resolve(uploadDir);
  const absolutePath = resolve(root, decoded);
  const relativePath = relative(root, absolutePath);

  // `relative` returns '' for the root itself, and something starting with
  // '..' (either separator) when the target escapes it.
  if (
    !relativePath ||
    relativePath === '.' ||
    relativePath.startsWith('..') ||
    isAbsolute(relativePath)
  ) {
    return { ok: false, reason: 'outside' };
  }

  return {
    ok: true,
    absolutePath,
    // Normalise to forward slashes: Media.storagePath uses that form.
    relativePath: relativePath.split(sep).join('/'),
  };
}
